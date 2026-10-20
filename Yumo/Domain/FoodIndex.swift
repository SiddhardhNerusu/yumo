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
    struct Entry: Sendable { let id: String; let name: String; let words: [String]; let brand: [String]; let tier: FoodTier; let raw: Bool; let useCount: Int; let macrosUnknown: Bool; let prior: Double }
    struct Hit: Sendable { let id: String; let matched: Double; let score: Double }
    struct Snapshot: Sendable {
        let entries: [Entry]; let df: [String: Int]; let n: Int
        func rarity(_ w: String) -> Double { log(1 + Double(max(1, n)) / Double((df[w] ?? 0) + 1)) }
    }
    static let shared = FoodIndex()
    private var snap = Snapshot(entries: [], df: [:], n: 0)
    private var builtCount = -1
    private var building: Task<Snapshot, Never>? = nil
    private var buildingCount = -1
    private let lock = NSLock()

    /// Phrase synonyms (whole-query prefix) come from Store.synonyms; these are per word. A value may hold several words
    /// ("potato old") or be empty (a word to drop). UK potato varieties have no rows anywhere; CoFID files them as old / new / red.
    static let tokenSynonyms: [String: String] = [
        "maris": "potato old", "desiree": "potato old", "rooster": "potato red", "estima": "potato old", "wilja": "potato old",
        "charlotte": "potato new", "albert": "potato",
        "potatoes": "potato", "spuds": "potato", "spud": "potato", "yoghurt": "yogurt", "brocolli": "broccoli", "brocoli": "broccoli", "zucchini": "courgette", "eggplant": "aubergine",
    ]
    /// Light plural stemming so "potatoes" and "potato", "fries" and "fry" are the same word (standard IR; nothing cleverer is needed for food names).
    /// Two-word varieties expand only as a phrase: "king" alone is king prawns, "jersey" alone is Jersey milk (20 Oct).
    static let varietyPhrases: [String: String] = [
        "king edward": "potato old", "king edwards": "potato old", "maris piper": "potato old",
        "jersey royal": "potato new", "jersey royals": "potato new", "albert bartlett": "potato",
    ]
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

    /// Query-independent prior (the "is anyone likely to want this row" half of a search engine, PageRank's job). Until aggregate usage
    /// exists, it comes from the data: by-products and offal rank down, common cuts and whole foods up. (A +0.3 for rows with a counted portion
    /// was dropped 20 Oct: it lifted almond butter's "1 tbsp" over plain almonds; the common-foods words already do that job.)
    static let byProducts: Set<String> = ["skin", "feet", "foot", "giblets", "giblet", "neck", "back", "gizzard", "heart", "liver", "kidney", "tail", "head", "bone", "fat", "separable", "tip", "tips", "carcass", "blood", "tongue", "tripe", "brain", "lung", "marrow", "trimmings", "rind", "dripping", "drippings", "lard", "tallow", "suet", "stock", "leaves", "stalk", "stalks", "peel", "shell", "husk", "bran", "flour", "powder", "dried", "dehydrated", "freeze", "baby", "food", "infant", "formula", "canned", "tinned", "unenriched", "enriched", "industrial", "restaurant", "fast"]
    static let staples: Set<String> = ["breast", "thigh", "leg", "drumstick", "wing", "mince", "ground", "fillet", "steak", "chop", "loin", "sirloin", "rump", "whole", "egg", "white", "brown", "basmati", "rolled", "porridge", "greek", "natural", "semi", "skimmed", "cheddar", "banana", "apple", "avocado", "broccoli", "spinach", "sweet", "olive", "peanut", "almond"]
    /// A word straight after "with" / "without" / "no" only says how the food comes ("Apples, gala, with skin"), so neither side counts it
    /// (20 Oct: the skin penalty sank raw apples). Boosts also skip a word after "and": "Almonds, flaked and ground" isn't ground meat —
    /// but "Chicken breast, meat and skin" keeps its penalty, it is the skin-on cut.
    nonisolated static func prior(name: String) -> Double {
        let all = words(name)
        func counted(after qualifiers: Set<String>) -> Set<String> { Set(all.indices.filter { $0 == 0 || !qualifiers.contains(all[$0 - 1]) }.map { all[$0] }) }
        var p = 0.0
        p -= Double(min(2, counted(after: ["with", "without", "no"]).intersection(byProducts).count)) * 1.2
        p += Double(min(2, counted(after: ["with", "without", "no", "and", "plus"]).intersection(staples).count)) * 0.5
        return p
    }

    /// Rebuilds when the number of foods changed (catalogue sync, a scanned product, a created food, delete account).
    @MainActor func refresh(_ store: Store) {
        let count = (try? store.ctx.fetchCount(FetchDescriptor<Food>())) ?? 0
        guard count != builtCount else { return }
        let s = FoodIndex.makeSnapshot(store.foods())
        lock.withLock { snap = s; builtCount = count }
    }
    /// Off the main thread (19–20 Oct: a main-thread build on the first keystroke froze typing for seconds): a background ModelContext reads
    /// every food once. Searches await the up-to-date snapshot; the lists keep what they show until it lands, so nothing flashes empty.
    func snapshot(for container: ModelContainer, count: Int) async -> Snapshot {
        enum Step { case ready(Snapshot), wait(Task<Snapshot, Never>) }
        let step: Step = lock.withLock {
            if count == builtCount { return .ready(snap) }
            if let t = building, buildingCount == count { return .wait(t) }
            let t = Task.detached(priority: .userInitiated) { FoodIndex.build(container) }
            building = t; buildingCount = count
            return .wait(t)
        }
        switch step {
        case .ready(let s): return s
        case .wait(let t):
            let s = await t.value
            lock.withLock { if buildingCount == count { snap = s; builtCount = count; building = nil } }
            return s
        }
    }
    nonisolated static func build(_ container: ModelContainer) -> Snapshot {
        let ctx = ModelContext(container)
        return makeSnapshot((try? ctx.fetch(FetchDescriptor<Food>())) ?? [])
    }
    /// A log bumps that food's history boost without rebuilding the index.
    func noteUse(id: String, useCount: Int) {
        lock.withLock {
            guard let i = snap.entries.firstIndex(where: { $0.id == id }) else { return }
            var es = snap.entries; let e = es[i]
            es[i] = Entry(id: e.id, name: e.name, words: e.words, brand: e.brand, tier: e.tier, raw: e.raw, useCount: useCount, macrosUnknown: e.macrosUnknown, prior: e.prior)
            snap = Snapshot(entries: es, df: snap.df, n: snap.n)
        }
    }
    nonisolated static func makeSnapshot(_ foods: [Food]) -> Snapshot {
        var df: [String: Int] = [:]
        let built = foods.map { f -> Entry in
            let w = FoodIndex.words(f.name + " " + (f.state ?? "") + " " + f.aliases), b = FoodIndex.words(f.brand ?? "")   // aliases: "nuts" still finds Almonds (20 Oct)
            for x in Set(w + b) { df[x, default: 0] += 1 }
            return Entry(id: f.id, name: f.name, words: w, brand: b, tier: f.tier, raw: f.state?.lowercased() == "raw", useCount: f.useCount, macrosUnknown: f.macrosUnknown, prior: FoodIndex.prior(name: f.name) - Double(f.state.flatMap { $0.lowercased() == "raw" ? nil : $0.count + 3 } ?? 0) * 0.02)   // a cooked / processed state lengthens the description: "Almonds" beats "Almonds · toasted" on a tie; raw is a base state
        }
        return Snapshot(entries: built, df: df, n: built.count)
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
        let raws = q.split(separator: " ").map(String.init)
        var words: [String] = []; var i = 0
        while i < raws.count {
            if i + 1 < raws.count, let v = varietyPhrases[raws[i] + " " + raws[i + 1]] { words += [raws[i], raws[i + 1]] + v.split(separator: " ").map(String.init); i += 2; continue }
            words.append(raws[i]); i += 1
        }
        var seen = Set<String>()
        return words.flatMap { raw -> [String] in
            let w = stem(raw); let syn = tokenSynonyms[raw] ?? tokenSynonyms[w]
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
    nonisolated static func score(name: String, words: [String], brand: [String], raw: Bool, useCount: Int, prior: Double = 0, toks: [String], rarity: (String) -> Double) -> (matched: Double, score: Double)? {
        guard !toks.isEmpty else { return nil }
        var matched = 0.0, total = 0.0, weight = 0.0
        for (i, t) in toks.enumerated() {
            weight += t.count < 3 ? 0.5 : 1
            // a prefix / fuzzy hit on a rarer word ("egg" → "eggnog") never earns more rarity than the typed word itself has
            let own = rarity(t)
            func r(_ hit: String) -> Double { hit == t ? own : min(own, rarity(hit)) }
            var best = match(t, in: words).map { ($0.0, r($0.1)) }
            if let b = match(t, in: brand) { let s = (b.0, r(b.1)); if best == nil || s.0 * s.1 > best!.0 * best!.1 { best = s } }   // a brand word is as good as a name word
            guard let (q, r) = best else { continue }
            // a 1–2 letter word is still being typed: it counts half, and never earns a rarity bonus ("ro" must not pick "round")
            let short = t.count < 3
            matched += short ? 0.5 : 1; total += q * (short ? min(r, 1) : r) * (i == 0 ? 1.5 : 1.0)
        }
        // at least half the typed weight, a 1–2 letter word weighing ½ — "po" alone shows every po… row (it used to need a whole
        // word, so two letters always read "No generic match"); for whole words this is the old rule: one of two, two of three
        guard matched >= max(0.5, weight / 2) else { return nil }
        let cover = matched / weight
        let lower = name.lowercased(), line = toks.joined(separator: " ")
        total += cover * cover * 2 + (lower.hasPrefix(line) ? 2 : lower.contains(line) ? 1 : 0) + log(1 + Double(useCount)) * 1.2 + (raw ? 0.4 : 0) + prior - Double(name.count) * 0.02
        return (matched, total)
    }
}

extension FoodIndex.Snapshot {
    /// Ranked catalogue hits for a typed line.
    func search(_ query: String, tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = [], limit: Int = 60) -> [FoodIndex.Hit] {
        let toks = FoodIndex.tokens(query); guard !toks.isEmpty else { return [] }
        var hits: [FoodIndex.Hit] = []
        for e in entries where tiers.contains(e.tier) && !e.macrosUnknown && !exclude.contains(e.id) {
            if let (m, s) = FoodIndex.score(name: e.name, words: e.words, brand: e.brand, raw: e.raw, useCount: e.useCount, prior: e.prior, toks: toks, rarity: rarity) { hits.append(.init(id: e.id, matched: m, score: s)) }
        }
        hits.sort { $0.matched != $1.matched ? $0.matched > $1.matched : $0.score > $1.score }
        return Array(hits.prefix(limit))
    }
    /// Online products through the same scorer. Words the catalogue doesn't know ("albert") are rare by definition.
    func rank(_ products: [OpenFoodFacts.Product], query: String) -> [OpenFoodFacts.Product] {
        let toks = FoodIndex.tokens(query); guard !toks.isEmpty else { return products }
        let typed = FoodIndex.words(query)   // as typed, without synonym expansions
        let scored: [(OpenFoodFacts.Product, Double, Double)] = products.compactMap { p in
            let brandWords = FoodIndex.words(p.brand ?? "")
            let own = FoodIndex.words(p.name).filter { !brandWords.contains($0) }   // what the product is, without the shop
            guard !own.isEmpty else { return nil }   // a product named only after its shop ("Tesco") says nothing about the food
            // a shop-only match never answers a food query: "tesco chicken" must name chicken; "tesco" alone lists the shop's products
            let shopQuery = typed.allSatisfy { FoodIndex.match($0, in: brandWords) != nil }
            if !shopQuery, !toks.contains(where: { FoodIndex.match($0, in: own) != nil }) { return nil }
            return FoodIndex.score(name: p.name, words: FoodIndex.words(p.name), brand: FoodIndex.words(p.brand ?? ""), raw: false, useCount: 0, toks: toks, rarity: rarity).map { (p, $0.matched, $0.score) }
        }
        // identical records (same name, brand, pack size and nutrition) are one product entered twice — show it once
        var seen = Set<String>()
        let ordered = scored.sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.2 > $1.2 }.map(\.0)
        return ordered.filter { p in
            let macros = "\(Int(p.kcal100))|\(Int(p.p100))|\(Int(p.c100))|\(Int(p.f100))"
            let key = p.name.lowercased() + "|" + (p.brand ?? "").lowercased() + "|" + (p.quantity ?? "") + "|" + macros
            return seen.insert(key).inserted
        }
    }
    /// The typed words (≥ 3 letters, after synonyms) that no catalogue row carries — a variety, a brand. When any exist, packaged results lead.
    func uncovered(_ query: String) -> [String] {
        let raws = query.lowercased().split(separator: " ").map(String.init)
        var variety = Set<String>()
        for (a, b) in zip(raws, raws.dropFirst()) where FoodIndex.varietyPhrases[a + " " + b] != nil { variety.insert(a); variety.insert(b) }
        return raws.filter { raw in
            let t = FoodIndex.stem(raw)
            guard t.count >= 3, !FoodIndex.spellings.contains(raw), !FoodIndex.spellings.contains(t), Store.synonyms[raw] == nil else { return false }   // a spelling synonym is a known word
            // a variety or brand word: the tables only hold its fallback ("rooster" would otherwise pass as a typo of "roaster")
            if variety.contains(raw) || FoodIndex.tokenSynonyms[raw] != nil { return true }
            // covered by a prefix on any word, or by a fuzzy hit ("chcieken" is a typo of chicken, not a brand)
            return !entries.contains { e in FoodIndex.match(t, in: e.words) != nil || FoodIndex.match(t, in: e.brand) != nil }
        }
    }
}
