import Foundation
import SwiftData
import SwiftUI
import CryptoKit

/// Queries and mutations over the SwiftData container. The app never blocks on the network.
@MainActor
struct Store {
    let ctx: ModelContext
    init(_ ctx: ModelContext) { self.ctx = ctx }

    // MARK: Profile
    func profile() -> UserProfile {
        if let p = try? ctx.fetch(FetchDescriptor<UserProfile>()).first { return p }
        let p = UserProfile(); ctx.insert(p); try? ctx.save(); return p
    }
    func latestWeight(before dayKey: String? = nil) -> WeightEntry? {
        var d = FetchDescriptor<WeightEntry>(sortBy: [SortDescriptor(\.dayKey, order: .reverse)])
        if let k = dayKey { d.predicate = #Predicate { $0.dayKey < k } }
        d.fetchLimit = 1
        return try? ctx.fetch(d).first
    }
    func currentKg() -> Double { latestWeight()?.kg ?? 80 }
    func targets() -> Targets { Targets(profile: profile(), kg: currentKg()) }

    // MARK: Days
    func entries(_ dayKey: String) -> [FoodEntry] {
        let d = FetchDescriptor<FoodEntry>(predicate: #Predicate { $0.dayKey == dayKey }, sortBy: [SortDescriptor(\.loggedAt)])
        return (try? ctx.fetch(d)) ?? []
    }
    func log(food: Food, meal: Meal, dayKey: String, quantity: Double = 1, serving: Serving? = nil) -> FoodEntry {
        let e = FoodEntry(dayKey: dayKey, meal: meal, food: food, quantity: quantity, serving: serving ?? food.defaultServing)
        food.lastUsedAt = Date(); food.useCount += 1
        ctx.insert(e); try? ctx.save(); return e
    }
    func remove(_ e: FoodEntry) { ctx.delete(e); try? ctx.save() }
    func save() { try? ctx.save() }
    /// Day keys in [from, to] that have at least one food (week strip, calendar, streak).
    func loggedDays(from: String, to: String) -> Set<String> {
        let d = FetchDescriptor<FoodEntry>(predicate: #Predicate { $0.dayKey >= from && $0.dayKey <= to })
        return Set(((try? ctx.fetch(d)) ?? []).map(\.dayKey))
    }
    /// Consecutive logged days ending today (or yesterday when today is still empty).
    func streak(today: String) -> Int {
        let start = Date.fromKey(today).adding(days: -400).dayKey
        let logged = loggedDays(from: start, to: today)
        var d = Date.fromKey(today); if !logged.contains(today) { d = d.adding(days: -1) }
        var n = 0; while logged.contains(d.dayKey) { n += 1; d = d.adding(days: -1) }
        return n
    }
    // MARK: Fuzzy catalogue search (rev 6, `yumo-catalog.js`): every token must prefix-match a word of the name/state or sit within
    // edit distance 1 (≤ 5 letters) / 2 of one; synonyms first; exact-prefix hits rank above fuzzy ones, then shorter names.
    nonisolated static let synonyms: [String: String] = ["protein powder": "whey", "protein": "whey", "shake": "whey", "pb": "peanut butter", "yoghurt": "yogurt", "spuds": "potato", "fries": "chips", "zucchini": "courgette", "eggplant": "aubergine", "rocket": "salad", "lettuce": "salad", "brocolli": "broccoli", "brocoli": "broccoli", "potatoes": "potato"]
    nonisolated static func lev(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b); if abs(a.count - b.count) > 2 { return 9 }
        var prev = Array(0...b.count), cur = Array(repeating: 0, count: b.count + 1)
        for i in 1...max(1, a.count) where i <= a.count { cur[0] = i; for j in 1...max(1, b.count) where j <= b.count { cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)) }; swap(&prev, &cur) }
        return a.isEmpty ? b.count : prev[b.count]
    }
    /// Fuzzy catalogue search on the in-memory FoodIndex (see FoodIndex.search for the rules). Main-thread convenience; views search off-thread via `fuzzyIDs`.
    func fuzzySearch(_ query: String, tiers: Set<FoodTier> = [.generic, .user], exclude: Set<String> = []) -> [Food] {
        foods(ids: FoodIndex.shared.snapshot(self).search(query, tiers: tiers, exclude: exclude).map(\.id))
    }
    /// Foods for a list of ids, in that order (one fetch).
    func foods(ids: [String]) -> [Food] {
        guard !ids.isEmpty else { return [] }
        let set = Set(ids)
        let hits = (try? ctx.fetch(FetchDescriptor<Food>(predicate: #Predicate { set.contains($0.id) }))) ?? []
        let by = Dictionary(uniqueKeysWithValues: hits.map { ($0.id, $0) })
        return ids.compactMap { by[$0] }
    }
    /// The most recent logged instance of a meal within the last 14 days before `dayKey` (rev 6 swipe row).
    func recentMeal(_ meal: Meal, before dayKey: String) -> (entries: [FoodEntry], daysAgo: Int)? {
        var d = Date.fromKey(dayKey)
        for i in 1...14 { d = d.adding(days: -1); let es = entries(d.dayKey).filter { $0.meal == meal }; if !es.isEmpty { return (es, i) } }
        return nil
    }
    // MARK: Staples (rev 5)
    func staples() -> [Staple] { (try? ctx.fetch(FetchDescriptor<Staple>(sortBy: [SortDescriptor(\.order)]))) ?? [] }
    func addStaple(_ f: Food, maxG: Double? = nil) { guard !staples().contains(where: { $0.foodId == f.id }) else { return }; ctx.insert(Staple(foodId: f.id, maxG: maxG, order: (staples().map(\.order).max() ?? -1) + 1)); save() }
    func removeStaple(_ s: Staple) { ctx.delete(s); save() }
    /// Any food logged on a day before `dayKey` (first-run rules, README §1).
    func hasHistory(before dayKey: String) -> Bool { ((try? ctx.fetchCount(FetchDescriptor<FoodEntry>(predicate: #Predicate { $0.dayKey < dayKey }))) ?? 0) > 0 }

    // MARK: Weights
    func weights() -> [WeightEntry] { (try? ctx.fetch(FetchDescriptor<WeightEntry>(sortBy: [SortDescriptor(\.dayKey, order: .reverse)]))) ?? [] }
    func weight(_ dayKey: String) -> WeightEntry? { try? ctx.fetch(FetchDescriptor<WeightEntry>(predicate: #Predicate { $0.dayKey == dayKey })).first }
    @discardableResult func saveWeight(dayKey: String, kg: Double, photo: Data?) -> WeightEntry {
        let w = weight(dayKey) ?? { let n = WeightEntry(dayKey: dayKey, kg: kg); ctx.insert(n); return n }()
        w.kg = kg; w.loggedAt = Date(); if let photo { w.photo = photo }
        try? ctx.save(); recomputeTrend(); return w
    }
    func deleteWeight(_ w: WeightEntry) { ctx.delete(w); try? ctx.save(); recomputeTrend() }

    // MARK: Foods
    func foods() -> [Food] { (try? ctx.fetch(FetchDescriptor<Food>(sortBy: [SortDescriptor(\.useCount, order: .reverse)]))) ?? [] }
    func food(barcode: String) -> Food? { try? ctx.fetch(FetchDescriptor<Food>(predicate: #Predicate { $0.barcode == barcode })).first }
    func food(id: String) -> Food? { try? ctx.fetch(FetchDescriptor<Food>(predicate: #Predicate { $0.id == id })).first }
    func search(_ q: String) -> [Food] {
        let needle = q.lowercased()
        return foods().filter { $0.name.lowercased().contains(needle) || ($0.brand?.lowercased().contains(needle) ?? false) }
    }
    func upsert(_ f: Food) -> Food {
        if let bc = f.barcode, let existing = food(barcode: bc) { return existing }
        ctx.insert(f); try? ctx.save(); FoodIndex.shared.invalidate(); return f
    }
    func mostLogged(limit: Int = 10) -> [Food] { Array(foods().filter { $0.useCount > 0 }.prefix(limit)) }
    /// Grouped search (PRODUCT_BRIEF §2): your foods → generic (one per canonical) → branded.
    /// Grouped by tier, every group ranked by the one scorer (FoodIndex). No cap: every variant shows.
    func groupedSearch(_ q: String) -> (your: [Food], generic: [Food], chain: [Food], branded: [Food]) {
        let hits = FoodIndex.shared.snapshot(self).search(q, tiers: [.user, .generic, .chain, .branded], limit: 400)
        let all = foods(ids: hits.map(\.id))
        return (all.filter { $0.tier == .user }, all.filter { $0.tier == .generic }, all.filter { $0.tier == .chain }, all.filter { $0.tier == .branded })
    }
    /// Same search over an already-fetched list (type-to-log resolves several words against one fetch).
    func groupedSearch(_ q: String, in all: [Food]) -> (your: [Food], generic: [Food], chain: [Food], branded: [Food]) {
        let needle = q.lowercased()
        let words = needle.split(separator: " ").map(String.init)
        func matches(_ f: Food) -> Bool { let hay = (f.name + " " + (f.brand ?? "") + " " + (f.state ?? "") + " " + f.aliases).lowercased(); return words.allSatisfy { hay.contains($0) } }
        let first = words.first ?? needle
        func tier(_ f: Food) -> Int { let n = f.name.lowercased(); if n.hasPrefix(needle) { return 0 }; if n.split(separator: " ").contains(where: { $0.hasPrefix(first) }) { return 1 }; return 2 }
        func rank(_ a: Food, _ b: Food) -> Bool { if a.useCount != b.useCount { return a.useCount > b.useCount }; let ta = tier(a), tb = tier(b); if ta != tb { return ta < tb }; return a.name.count < b.name.count }
        let all = all.filter(matches)
        return (all.filter { $0.tier == .user }.sorted(by: rank), all.filter { $0.tier == .generic }.sorted(by: rank) /* every variant shows — no cap */, all.filter { $0.tier == .chain }.sorted(by: rank), all.filter { $0.tier == .branded }.sorted(by: rank))
    }
    // MARK: Trend (EMA α 0.1) — recomputed on every weight save/delete
    func recomputeTrend() {
        let asc = weights().reversed()
        let t = Calc.emaTrend(asc.map { ($0.dayKey, $0.kg) })
        for w in asc { w.trendKg = t[w.dayKey] }
        try? ctx.save()
    }
    func weeklyEstimates() -> [WeeklyEstimate] { (try? ctx.fetch(FetchDescriptor<WeeklyEstimate>(sortBy: [SortDescriptor(\.weekStart)]))) ?? [] }

    // MARK: Saved meals
    func savedMeals() -> [SavedMeal] { (try? ctx.fetch(FetchDescriptor<SavedMeal>(sortBy: [SortDescriptor(\.createdAt)]))) ?? [] }
    func savedMeal(matching entries: [FoodEntry]) -> SavedMeal? {
        let set = Set(entries.compactMap { $0.food?.id })
        return savedMeals().first { Set($0.items.map(\.foodId)) == set && !set.isEmpty }
    }
    func saveMeal(name: String, meal: Meal, entries: [FoodEntry]) -> SavedMeal {
        let m = SavedMeal(name: name, meal: meal, items: entries.compactMap { e in e.food.map { SavedItem(foodId: $0.id, quantity: e.quantity, servingLabel: e.servingLabel, servingGrams: e.servingGrams) } })
        ctx.insert(m); try? ctx.save(); return m
    }
    func delete(_ m: SavedMeal) { ctx.delete(m); try? ctx.save() }
    func logSavedMeal(_ m: SavedMeal, meal: Meal, dayKey: String) {
        for it in m.items { if let f = food(id: it.foodId) { _ = log(food: f, meal: meal, dayKey: dayKey, quantity: it.quantity, serving: Serving(label: it.servingLabel, grams: it.servingGrams)) } }
    }

    // MARK: Account (local; replace with the REST backend when it exists)
    static func hash(_ password: String, salt: String) -> String { SHA256.hash(data: Data((salt + password).utf8)).map { String(format: "%02x", $0) }.joined() }
    func deleteEverything() {
        for e in entries() { ctx.delete(e) }
        for w in weights() { ctx.delete(w) }
        for f in foods() { ctx.delete(f) }
        for m in savedMeals() { ctx.delete(m) }
        if let p = try? ctx.fetch(FetchDescriptor<UserProfile>()).first { ctx.delete(p) }
        for e in weeklyEstimates() { ctx.delete(e) }
        try? ctx.save(); UserDefaults.standard.removeObject(forKey: Catalogue.versionKey); FoodIndex.shared.invalidate()
    }
    private func entries() -> [FoodEntry] { (try? ctx.fetch(FetchDescriptor<FoodEntry>())) ?? [] }
}

struct DayTotals { var kcal = 0.0, p = 0.0, c = 0.0, f = 0.0
    init(_ es: [FoodEntry]) { for e in es { kcal += e.kcal; p += e.p; c += e.c; f += e.f } }
}
