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
        ctx.insert(f); try? ctx.save(); return f
    }
    func mostLogged(limit: Int = 10) -> [Food] { Array(foods().filter { $0.useCount > 0 }.prefix(limit)) }
    /// Grouped search (PRODUCT_BRIEF §2): your foods → generic (one per canonical) → branded.
    func groupedSearch(_ q: String) -> (your: [Food], generic: [Food], chain: [Food], branded: [Food]) { groupedSearch(q, in: foods()) }
    /// Same search over an already-fetched list (type-to-log resolves several words against one fetch).
    func groupedSearch(_ q: String, in all: [Food]) -> (your: [Food], generic: [Food], chain: [Food], branded: [Food]) {
        let needle = q.lowercased()
        let words = needle.split(separator: " ").map(String.init)
        func matches(_ f: Food) -> Bool { let hay = (f.name + " " + (f.brand ?? "") + " " + (f.state ?? "") + " " + f.aliases).lowercased(); return words.allSatisfy { hay.contains($0) } }
        func rank(_ a: Food, _ b: Food) -> Bool { a.useCount != b.useCount ? a.useCount > b.useCount : (a.name.lowercased().hasPrefix(needle) != b.name.lowercased().hasPrefix(needle) ? a.name.lowercased().hasPrefix(needle) : a.name.count < b.name.count) }
        let all = all.filter(matches)
        return (all.filter { $0.tier == .user }.sorted(by: rank), Array(all.filter { $0.tier == .generic }.sorted(by: rank).prefix(40)), all.filter { $0.tier == .chain }.sorted(by: rank), all.filter { $0.tier == .branded }.sorted(by: rank))
    }
    // MARK: Trend (EMA α 0.1) — recomputed on every weight save/delete
    func recomputeTrend() {
        let asc = weights().reversed()
        let t = Calc.emaTrend(asc.map { ($0.dayKey, $0.kg) })
        for w in asc { w.trendKg = t[w.dayKey] }
        try? ctx.save()
    }
    // MARK: Training/rest day flag
    func isTraining(_ dayKey: String) -> Bool? {
        let p = profile(); guard p.trainingOn else { return nil }
        if let f = try? ctx.fetch(FetchDescriptor<DayFlag>(predicate: #Predicate { $0.dayKey == dayKey })).first { return f.isTraining }
        let wd = (Calendar.current.component(.weekday, from: Date.fromKey(dayKey)) + 5) % 7   // Monday = 0
        return p.trainingDays[wd]
    }
    func setTraining(_ dayKey: String, _ on: Bool) {
        if let f = try? ctx.fetch(FetchDescriptor<DayFlag>(predicate: #Predicate { $0.dayKey == dayKey })).first { f.isTraining = on } else { ctx.insert(DayFlag(dayKey: dayKey, isTraining: on)) }
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
        for f in (try? ctx.fetch(FetchDescriptor<DayFlag>())) ?? [] { ctx.delete(f) }
        try? ctx.save(); UserDefaults.standard.removeObject(forKey: Catalogue.versionKey)
    }
    private func entries() -> [FoodEntry] { (try? ctx.fetch(FetchDescriptor<FoodEntry>())) ?? [] }
}

struct DayTotals { var kcal = 0.0, p = 0.0, c = 0.0, f = 0.0
    init(_ es: [FoodEntry]) { for e in es { kcal += e.kcal; p += e.p; c += e.c; f += e.f } }
}
