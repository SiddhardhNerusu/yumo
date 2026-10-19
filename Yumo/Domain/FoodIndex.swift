import Foundation
import SwiftData

/// THE food search. One scorer ranks everything the app can show for a typed line — the local catalogue (generic, chains, your foods,
/// scanned products) and Open Food Facts results — so every list in the app agrees on what "closest match" means.
///
/// Built from the standard retrieval recipe (BM25-style term rarity, coverage, typeahead prefix, fuzzy as a last resort):
/// 1. Coverage first: a row that names more of the typed words always ranks above one that names fewer. A row must name at least
///    half of them (rounded up) to show at all — "tempura chicken chunks" by a brand called Rooster never answers "potato albert red rooster".
/// 2. Then score: each typed word scores (match quality × rarity × position). Exact word 1.0, prefix 0.85 (0.6 for 1–2 letters, the
///    word still being typed), edit-distance fuzzy 0.5 (≥ 4 letters, distance 1 up to 5 letters / 2 beyond). Rarity = log(1 + N / df):
///    "rooster" outweighs "potato". The first typed word is the head noun and counts 1.5×. Brand words count 0.9×.
/// 3. Bonuses: the whole line as a prefix of the name +2, contained +1; your own history log(1 + useCount) × 1.2; raw rows +0.4
///    (ingredients you weigh); long names lose 0.01 per character so "Potatoes" beats "Sweet Potato Fries - Albert Bartlett" on a tie.
/// Pure and value-typed: the Snapshot is searched on a background task; the index rebuilds when the food count changes.
final class FoodIndex: @unchecked Sendable {
    struct Entry: Sendable { let id: String; let name: String; let words: [String]; let brand: [String]; let tier: FoodTier; let raw: Bool; let useCount: Int; let macrosUnknown: Bool }
    struct Hit: Sendable { let id: String; let matched: Double; let score: Double }
    struct Snapshot: Sendable {
        let entries: [Entry]; let df: [String: Int]; let n: Int
        func rarity(_ w: String) -> Double { log(1 + Double(max(1, n)) / Double((df[w] ?? 0) + 1)) }
    }
    static let shared = FoodIndex()
    private var snap = Snapshot(entries: [], df: [:], n: 0)
    private var builtCount = -1
    private let lock = NSLock()

    /// Phrase synonyms (whole-query prefix) come from Store.synonyms; these are per word. A value may hold several words
    /// ("potato old") or be empty (a word to drop). UK potato varieties have no rows anywhere; CoFID files them as old / new / red.
    static let tokenSynonyms: [String: String] = [
        "maris": "potato old", "piper": "", "king": "potato old", "edward": "", "edwards": "", "desiree": "potato old", "rooster": "potato red", "estima": "potato old", "wilja": "potato old",
        "charlotte": "potato new", "jersey": "potato new", "royals": "", "royal": "", "albert": "potato", "bartlett": "",
        "potatoes": "potato", "spuds": "potato", "spud": "potato", "yoghurt": "yogurt", "brocolli": "broccoli", "brocoli": "broccoli", "zucchini": "courgette", "eggplant": "aubergine",
    ]
    /// Light plural stemming so "potatoes" and "potato", "fries" and "fry" are the same word (standard IR; nothing cleverer is needed for food names).
    /// Spelling / plural normalisations — a known word. Everything else in tokenSynonyms is a variety or brand with a nutritional fallback,
    /// and still counts as uncovered so the packaged lookup leads.
    static let spellings: Set<String> = ["potatoes", "spuds", "spud", "yoghurt", "brocolli", "brocoli", "zucchini", "eggplant"]
    nonisolated static func stem(_ w: String) -> String {
        guard w.count > 4 else { return w }
        if w.hasSuffix("ies") { return String(w.dropLast(3)) + "y" }
        for suf in ["oes", "ses", "xes", "ches", "shes"] where w.hasSuffix(suf) { return String(w.dropLast(2)) }
        if w.hasSuffix("s"), !w.hasSuffix("ss") { return String(w.dropLast()) }
        return w
    }
    nonisolated static func words(_ s: String) -> [String] { s.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map { stem(String($0)) } }

    /// Rebuilds when the number of foods changed (catalogue sync, a scanned product, a created food, delete account).
    @MainActor func refresh(_ store: Store) {
        let count = (try? store.ctx.fetchCount(FetchDescriptor<Food>())) ?? 0
        guard count != builtCount else { return }
        var df: [String: Int] = [:]
        let built = store.foods().map { f -> Entry in
            let w = FoodIndex.words(f.name + " " + (f.state ?? "")), b = FoodIndex.words(f.brand ?? "")
            for x in Set(w + b) { df[x, default: 0] += 1 }
            return Entry(id: f.id, name: f.name, words: w, brand: b, tier: f.tier, raw: f.state?.lowercased() == "raw", useCount: f.useCount, macrosUnknown: f.macrosUnknown)
        }
        lock.lock(); snap = Snapshot(entries: built, df: df, n: built.count); builtCount = count; lock.unlock()
    }
    func invalidate() { lock.lock(); builtCount = -1; lock.unlock() }
    var snapshot: Snapshot { lock.lock(); defer { lock.unlock() }; return snap }
    @MainActor func snapshot(_ store: Store) -> Snapshot { refresh(store); return snapshot }

    /// Query → words: phrase synonyms, then per-word synonyms, de-duplicated, order kept (the first word is the head noun).
    /// The typed word stays in the list next to its expansion ("rooster" → rooster, potato, red): the catalogue matches the expansion,
    /// a packaged product matches the word itself, and both are scored by the same rule.
    nonisolated static func tokens(_ query: String) -> [String] {
        var q = query.trimmingCharacters(in: .whitespaces).lowercased(); guard !q.isEmpty else { return [] }
        for (k, v) in Store.synonyms where q == k || q.hasPrefix(k + " ") { q = v + q.dropFirst(k.count) }
        var seen = Set<String>()
        return q.split(separator: " ").flatMap { raw -> [String] in
            let w = stem(String(raw)); let syn = tokenSynonyms[String(raw)] ?? tokenSynonyms[w]
            return (syn == nil ? [w] : [w] + syn!.split(separator: " ").map { stem(String($0)) })
        }.filter { !$0.isEmpty && seen.insert($0).inserted }
    }
    /// The typed words as typed (stemmed), without expansions — what "uncovered" and the second packaged lookup use.
    nonisolated static func typedWords(_ query: String) -> [String] { words(query) }
    /// The best match of one typed word against a word list: (quality, the word it hit).
    nonisolated static func match(_ t: String, in words: [String]) -> (Double, String)? {
        var best: (Double, String)? = nil
        for w in words {
            let q: Double
            if w == t { q = 1.0 } else if w.hasPrefix(t) { q = t.count >= 3 ? 0.85 : 0.6 }
            // fuzzy: same first letter (typos rarely hit it), one edit up to 7 letters, two beyond — "brest" → "breast", never "potato" → "tomato"
            else if t.count >= 4, w.first == t.first, abs(w.count - t.count) <= 2, Store.lev(t, w) <= (t.count <= 7 ? 1 : 2) { q = 0.5 } else { continue }
            if q > (best?.0 ?? 0) { best = (q, w) }
        }
        return best
    }
    /// Score any candidate (a catalogue row or an online product) for a token list. nil = below the coverage bar.
    nonisolated static func score(name: String, words: [String], brand: [String], raw: Bool, useCount: Int, toks: [String], rarity: (String) -> Double) -> (matched: Double, score: Double)? {
        guard !toks.isEmpty else { return nil }
        var matched = 0.0, total = 0.0
        for (i, t) in toks.enumerated() {
            var best = match(t, in: words).map { ($0.0, rarity($0.1)) }
            if let b = match(t, in: brand) { let s = (b.0, rarity(b.1)); if best == nil || s.0 * s.1 > best!.0 * best!.1 { best = s } }   // a brand word is as good as a name word
            guard let (q, r) = best else { continue }
            // a 1–2 letter word is still being typed: it counts half, and never earns a rarity bonus ("ro" must not pick "round")
            let short = t.count < 3
            matched += short ? 0.5 : 1; total += q * (short ? min(r, 1) : r) * (i == 0 ? 1.5 : 1.0)
        }
        let need = Double(max(1, (toks.count + 1) / 2))
        guard matched >= need else { return nil }
        let cover = matched / Double(toks.count)
        let lower = name.lowercased(), line = toks.joined(separator: " ")
        total += cover * cover * 2 + (lower.hasPrefix(line) ? 2 : lower.contains(line) ? 1 : 0) + log(1 + Double(useCount)) * 1.2 + (raw ? 0.4 : 0) - Double(name.count) * 0.02
        return (matched, total)
    }
}

extension FoodIndex.Snapshot {
    /// Ranked catalogue hits for a typed line.
    func search(_ query: String, tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = [], limit: Int = 60) -> [FoodIndex.Hit] {
        let toks = FoodIndex.tokens(query); guard !toks.isEmpty else { return [] }
        var hits: [FoodIndex.Hit] = []
        for e in entries where tiers.contains(e.tier) && !e.macrosUnknown && !exclude.contains(e.id) {
            if let (m, s) = FoodIndex.score(name: e.name, words: e.words, brand: e.brand, raw: e.raw, useCount: e.useCount, toks: toks, rarity: rarity) { hits.append(.init(id: e.id, matched: m, score: s)) }
        }
        hits.sort { $0.matched != $1.matched ? $0.matched > $1.matched : $0.score > $1.score }
        return Array(hits.prefix(limit))
    }
    /// Online products through the same scorer. Words the catalogue doesn't know ("albert") are rare by definition.
    func rank(_ products: [OpenFoodFacts.Product], query: String) -> [OpenFoodFacts.Product] {
        let toks = FoodIndex.tokens(query); guard !toks.isEmpty else { return products }
        let scored: [(OpenFoodFacts.Product, Double, Double)] = products.compactMap { p in
            FoodIndex.score(name: p.name, words: FoodIndex.words(p.name), brand: FoodIndex.words(p.brand ?? ""), raw: false, useCount: 0, toks: toks, rarity: rarity).map { (p, $0.matched, $0.score) }
        }
        return scored.sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.2 > $1.2 }.map(\.0)
    }
    /// The typed words (≥ 3 letters, after synonyms) that no catalogue row carries — a variety, a brand. When any exist, packaged results lead.
    func uncovered(_ query: String) -> [String] {
        query.lowercased().split(separator: " ").map(String.init).filter { raw in
            let t = FoodIndex.stem(raw)
            guard t.count >= 3, !FoodIndex.spellings.contains(raw), !FoodIndex.spellings.contains(t), Store.synonyms[raw] == nil else { return false }   // a spelling synonym is a known word
            return !entries.contains { e in e.words.contains { $0.hasPrefix(t) } || e.brand.contains { $0.hasPrefix(t) } }
        }
    }
}
