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
    static let tokenSynonyms: [String: String] = [
        "maris": "old", "piper": "old", "king": "old", "edward": "old", "edwards": "old", "desiree": "old", "rooster": "old", "estima": "old", "wilja": "old",
        "charlotte": "new", "jersey": "new", "royals": "new", "royal": "new", "baby": "new",
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

    /// Prefix or edit-distance match per token (distance 1 up to 5 letters, 2 beyond); every token must match.
    /// Rank: your most-logged first, then raw rows, then exact-prefix hits, then shorter names. Pure, so it runs on any thread.
    static func search(_ query: String, in entries: [Entry], tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = [], limit: Int = 60) -> [String] {
        var q = query.trimmingCharacters(in: .whitespaces).lowercased(); guard !q.isEmpty else { return [] }
        for (k, v) in Store.synonyms where q == k || q.hasPrefix(k + " ") { q = v + q.dropFirst(k.count) }
        let toks = q.split(separator: " ").map { tokenSynonyms[String($0)] ?? String($0) }.filter { !$0.isEmpty }
        guard !toks.isEmpty else { return [] }
        var scored: [(Entry, Int)] = []
        for e in entries where tiers.contains(e.tier) && !e.macrosUnknown && !exclude.contains(e.id) {
            var score = 0, ok = true
            for t in toks {
                if e.words.contains(where: { $0.hasPrefix(t) }) { score += 2; continue }
                if t.count >= 4 {
                    let tol = t.count <= 5 ? 1 : 2
                    if e.words.contains(where: { w in abs(w.count - t.count) <= 2 && Store.lev(t, w) <= tol }) { score += 1; continue }
                }
                ok = false; break
            }
            if ok { scored.append((e, score * 10 + (e.raw ? 3 : 0))) }
        }
        scored.sort { a, b in
            if a.0.useCount != b.0.useCount { return a.0.useCount > b.0.useCount }
            if a.1 != b.1 { return a.1 > b.1 }
            return a.0.name.count < b.0.name.count
        }
        return scored.prefix(limit).map(\.0.id)
    }
}
