import Foundation
import SwiftData

/// In-memory search index over the food catalogue. Built once per launch (and whenever the food count changes), searched off the main thread.
/// Before this the fuzzy matcher re-fetched every Food object and re-split every name on each keystroke — the "typing is super laggy" bug.
final class FoodIndex: @unchecked Sendable {
    struct Entry: Sendable { let id: String; let name: String; let words: [String]; let tier: FoodTier; let raw: Bool; let useCount: Int; let macrosUnknown: Bool }
    static let shared = FoodIndex()
    private var entries: [Entry] = []
    private var builtCount = -1
    private let lock = NSLock()

    /// Per-token synonyms, applied after the phrase synonyms: UK potato varieties don't exist as catalogue rows, CoFID files them as "old" / "new".
    /// A value may hold several words ("potato old") or be empty (a word to drop, "piper").
    static let tokenSynonyms: [String: String] = [
        "maris": "potato old", "piper": "", "king": "potato old", "edward": "", "edwards": "", "desiree": "potato old", "rooster": "potato red", "estima": "potato old", "wilja": "potato old",
        "charlotte": "potato new", "jersey": "potato new", "royals": "", "royal": "", "albert": "potato", "bartlett": "",
        "potatoes": "potato", "spuds": "potato", "spud": "potato", "yoghurt": "yogurt", "brocolli": "broccoli", "brocoli": "broccoli", "zucchini": "courgette", "eggplant": "aubergine",
    ]

    /// Rebuilds when the number of foods changed (catalogue sync, a scanned product, a created food, delete account).
    @MainActor func refresh(_ store: Store) {
        let n = (try? store.ctx.fetchCount(FetchDescriptor<Food>())) ?? 0
        guard n != builtCount else { return }
        let built = store.foods().map { f in
            Entry(id: f.id, name: f.name, words: (f.name + " " + (f.state ?? "")).lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init),
                  tier: f.tier, raw: f.state?.lowercased() == "raw", useCount: f.useCount, macrosUnknown: f.macrosUnknown)
        }
        lock.lock(); entries = built; builtCount = n; lock.unlock()
    }
    func invalidate() { lock.lock(); builtCount = -1; lock.unlock() }
    var snapshot: [Entry] { lock.lock(); defer { lock.unlock() }; return entries }

    struct Hit: Sendable { let id: String; let matched: Int }
    /// Every word is scored: prefix match on a word of name + state (2), or edit distance 1 (≤ 5 letters) / 2 (longer, ≥ 4 letters) (1).
    /// A row is returned when at least one word matches — MFP-style: you always see every row the catalogue has for "potato", and the
    /// half-typed or unknown words ("ro", "albert") only affect the order. Rank: words matched → your most-logged → raw rows → score → shorter name.
    static func search(_ query: String, in entries: [Entry], tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = [], limit: Int = 60) -> [String] {
        searchHits(query, in: entries, tiers: tiers, exclude: exclude, limit: limit).map(\.id)
    }
    static func searchHits(_ query: String, in entries: [Entry], tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = [], limit: Int = 60) -> [Hit] {
        var q = query.trimmingCharacters(in: .whitespaces).lowercased(); guard !q.isEmpty else { return [] }
        for (k, v) in Store.synonyms where q == k || q.hasPrefix(k + " ") { q = v + q.dropFirst(k.count) }
        var seen = Set<String>()
        let toks = q.split(separator: " ").flatMap { (tokenSynonyms[String($0)] ?? String($0)).split(separator: " ").map(String.init) }.filter { !$0.isEmpty && seen.insert($0).inserted }
        guard !toks.isEmpty else { return [] }
        var scored: [(Entry, Int, Int)] = []   // entry, words matched, score
        for e in entries where tiers.contains(e.tier) && !e.macrosUnknown && !exclude.contains(e.id) {
            var score = 0, matched = 0
            for t in toks {
                if e.words.contains(where: { $0.hasPrefix(t) }) { score += 2; matched += 1; continue }
                if t.count >= 4 {
                    let tol = t.count <= 5 ? 1 : 2
                    if e.words.contains(where: { w in abs(w.count - t.count) <= 2 && Store.lev(t, w) <= tol }) { score += 1; matched += 1 }
                }
            }
            if matched > 0 { scored.append((e, matched, score * 10 + (e.raw ? 3 : 0))) }
        }
        scored.sort { a, b in
            if a.1 != b.1 { return a.1 > b.1 }
            if a.0.useCount != b.0.useCount { return a.0.useCount > b.0.useCount }
            if a.2 != b.2 { return a.2 > b.2 }
            return a.0.name.count < b.0.name.count
        }
        return scored.prefix(limit).map { Hit(id: $0.0.id, matched: $0.1) }
    }
    /// How many of the query's words the best catalogue row matched, against the words typed — < 1 means the catalogue has no row for part of it.
    static func coverage(_ query: String, hits: [Hit]) -> Double {
        let n = max(1, query.split(separator: " ").count)
        return Double(hits.first?.matched ?? 0) / Double(n)
    }
}
