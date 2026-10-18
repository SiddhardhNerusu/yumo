import Foundation
import SwiftData

/// Supplements (rev 9, README §7d). The nutrient-feeding catalogue: usual dose, unit, and what each dose counts toward, in the app's nutrient units
/// (µg for vitamins A/D/K/B12/folate/selenium, mg otherwise). Label values are typical UK retail products; the user edits the dose.
enum Supplements {
    struct Item: Identifiable, Hashable { let id: String; let name: String; let dose: Double; let unit: String; let nutrients: [String: Double]; let aliases: [String]
        func hash(into h: inout Hasher) { h.combine(id) }
        static func == (a: Item, b: Item) -> Bool { a.id == b.id }
        var countsToward: String { nutrients.count == 1 ? (Nutrients.by(nutrients.keys.first!)?.name.components(separatedBy: " (").first ?? "") : "\(nutrients.count) nutrients" }
    }
    static let units = ["µg", "mg", "g", "IU", "tablet", "capsule", "scoop"]
    /// The nutrient-feeding catalogue ships as data (`Resources/Catalogue/supplements.json`, the `GET /supplements/catalogue` shape, versioned like foods),
    /// not as Swift literals. Stack items are created client-side from typed text with tier "stack" and no nutrients.
    private struct JSONItem: Decodable { let id: String; let name: String; let tier: String; let usualDose: Double; let unit: String; let nutrients: [String: Double]; let aliases: [String] }
    private struct JSONFile: Decodable { let version: String; let items: [JSONItem] }
    static let catalogue: [Item] = {
        guard let url = Bundle.main.url(forResource: "supplements", withExtension: "json"), let data = try? Data(contentsOf: url), let f = try? JSONDecoder().decode(JSONFile.self, from: data) else { return [] }
        return f.items.filter { $0.tier == "nutrient" }.map { Item(id: $0.id, name: $0.name, dose: $0.usualDose, unit: $0.unit, nutrients: $0.nutrients, aliases: $0.aliases) }
    }()
    static var catalogueVersion: String { (Bundle.main.url(forResource: "supplements", withExtension: "json").flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONDecoder().decode(JSONFile.self, from: $0) })?.version ?? "" }
    /// Everything the user types that is not above becomes a stack item: name + dose + unit + days, no nutrient mapping, no claims.
    static let stackSuggestions = ["Creatine", "Ashwagandha", "Tongkat ali", "Pre-workout", "Beta-alanine", "Citrulline", "Collagen", "Glucosamine", "Melatonin", "Probiotic", "Turmeric", "CoQ10", "L-theanine", "Glycine", "Taurine"]

    /// Fuzzy search over the catalogue: tokens prefix-match or sit within edit distance 1 (≤ 5 letters) / 2 of a word in the name or an alias.
    @MainActor static func search(_ query: String) -> [Item] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased(); guard !q.isEmpty else { return [] }
        let toks = q.split(separator: " ").map(String.init)
        var out: [(Item, Int)] = []
        for it in catalogue {
            let words = (it.name.lowercased() + " " + it.aliases.joined(separator: " ")).split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init)
            var score = 0, ok = true
            for t in toks { if words.contains(where: { $0.hasPrefix(t) }) { score += 2; continue }; let tol = t.count <= 5 ? 1 : 2; if t.count >= 4, words.contains(where: { Store.lev(t, $0) <= tol }) { score += 1; continue }; ok = false; break }
            if ok { out.append((it, score)) }
        }
        return out.sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.0.name.count < $1.0.name.count }.map(\.0)
    }
    /// Nutrient amounts for a chosen dose: scaled linearly from the catalogue dose when the unit matches, else the catalogue amounts as-is.
    static func amounts(for item: Item, dose: Double, unit: String) -> [String: Double] {
        guard unit == item.unit, item.dose > 0 else { return item.nutrients }
        return item.nutrients.mapValues { $0 * dose / item.dose }
    }
    static func formatDose(_ v: Double, unit: String) -> String {
        let n = v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
        let num = Int(v) >= 1000 && v == v.rounded() ? Fmt.k(v) : n
        return "\(num) \(unit)"
    }
    static let dayLetters = ["M", "T", "W", "T", "F", "S", "S"]
    /// Monday = 0 … Sunday = 6
    static func weekdayIndex(_ d: Date) -> Int { (Calendar.current.component(.weekday, from: d) + 5) % 7 }
}

extension Store {
    func supplements() -> [Supplement] { (try? ctx.fetch(FetchDescriptor<Supplement>(sortBy: [SortDescriptor(\.order)]))) ?? [] }
    func addSupplement(_ s: Supplement) { s.order = (supplements().map(\.order).max() ?? -1) + 1; ctx.insert(s); save() }
    func removeSupplement(_ s: Supplement) { ctx.delete(s); save() }
    /// Nutrient amounts the supplements add on a given day (weekday-based), in nutrient units. Supplements never add calories.
    func supplementAmounts(on dayKey: String) -> [String: Double] {
        let wd = Supplements.weekdayIndex(Date.fromKey(dayKey)); var out: [String: Double] = [:]
        for s in supplements() where s.isNutrient && s.days[wd] { for (k, v) in s.nutrients { out[k, default: 0] += v } }
        return out
    }
    /// The nutrient-feeding supplements that count toward a nutrient key.
    func supplementsFeeding(_ key: String) -> [Supplement] { supplements().filter { $0.isNutrient && ($0.nutrients[key] ?? 0) > 0 } }
    /// Day total for a nutrient = food + supplements taken that weekday. nil when no entry carries the value and no supplement feeds it.
    func nutrientTotal(_ key: String, dayKey: String, entries: [FoodEntry]) -> Double? {
        let food = entries.compactMap { $0.micro(key) }
        let supp = supplementAmounts(on: dayKey)[key]
        if food.isEmpty && supp == nil { return nil }
        return food.reduce(0, +) + (supp ?? 0)
    }
}

/// Weekly nutrient status (rev 9, README §7c). Low = 7-day average < 50 % of target with data on ≥ 5 days (ink + amber dot, never red).
/// Over = above the upper limit on ≥ 4 of 7 days (red). One bad day never shows. Food + supplements, per day.
struct NutrientWeek: Identifiable {
    var n: Nutrient; var avg: Double?; var goal: Double?; var ul: Double?; var daysWithData: Int; var overDays: Int; var suppPerDay: Double; var window: Int
    var id: String { n.key }
    var ref: Double? { goal ?? ul }
    var pct: Double? { guard let a = avg, let r = ref, r > 0 else { return nil }; return a / r }
    var isLimit: Bool { goal == nil && ul != nil }
    var over: Bool { ul != nil && overDays >= max(1, Int((Double(min(window, 7)) * 4.0 / 7.0).rounded())) }
    var low: Bool { guard let p = pct, goal != nil else { return false }; return p < 0.5 && daysWithData >= min(window, 5) }
    var onTrack: Bool { !over && !low }
    var hasTarget: Bool { ref != nil }
}
extension Store {
    func nutrientWeek(window: Int = 7, ending: Date = Date()) -> [NutrientWeek] {
        let p = profile(); let t = targets()
        let days = (0..<window).map { ending.adding(days: -$0).dayKey }
        let perDay: [(String, [FoodEntry])] = days.map { ($0, entries($0)) }.filter { !$0.1.isEmpty }
        let supps = supplements().filter(\.isNutrient)
        return Nutrients.all.map { n in
            let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
            var vals: [Double] = [], overDays = 0, suppSum = 0.0
            for (dk, es) in perDay {
                if let v = nutrientTotal(n.key, dayKey: dk, entries: es) { vals.append(v); if let u = ul, v > u { overDays += 1 } }
            }
            // supplement contribution per day (average across the days of the week it is taken)
            for s in supps { if let a = s.nutrients[n.key] { suppSum += a * Double(s.days.filter { $0 }.count) / 7 } }
            return NutrientWeek(n: n, avg: vals.isEmpty ? nil : vals.reduce(0, +) / Double(vals.count), goal: goal, ul: ul, daysWithData: vals.count, overDays: overDays, suppPerDay: suppSum, window: window)
        }
    }
    /// Low in each of the last two 7-day windows and nothing feeds it: the one-time "Taking a supplement?" nudge (README §7c).
    func nudgeCandidates() -> [Nutrient] {
        let p = profile()
        let w1 = nutrientWeek(), w2 = nutrientWeek(ending: Date().adding(days: -7))
        return w1.filter { a in a.low && (w2.first { $0.n.key == a.n.key }?.low ?? false) && supplementsFeeding(a.n.key).isEmpty && !p.suppNudgeAnswered.contains(a.n.key) && Supplements.catalogue.contains { $0.nutrients[a.n.key] != nil } }.map(\.n)
    }
}
