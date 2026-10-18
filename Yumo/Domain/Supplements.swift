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
    /// A "multivitamin" tablet at common UK RDA-level amounts (12 nutrients).
    static let multi: [String: Double] = ["vit_a_ug": 800, "vit_c_mg": 80, "vit_d_ug": 10, "vit_e_mg": 12, "b1_mg": 1.1, "b2_mg": 1.4, "b3_mg": 16, "b6_mg": 1.4, "folate_ug": 200, "b12_ug": 2.5, "zinc_mg": 10, "iron_mg": 14]
    static let catalogue: [Item] = [
        Item(id: "d3", name: "Vitamin D3", dose: 25, unit: "µg", nutrients: ["vit_d_ug": 25], aliases: ["d3", "vitamin d", "vit d", "cholecalciferol"]),
        Item(id: "d3_1000", name: "Vitamin D3 1,000 IU", dose: 1000, unit: "IU", nutrients: ["vit_d_ug": 25], aliases: ["d3", "vitamin d", "1000 iu"]),
        Item(id: "d3_4000", name: "Vitamin D3 4,000 IU", dose: 4000, unit: "IU", nutrients: ["vit_d_ug": 100], aliases: ["d3", "vitamin d", "4000 iu"]),
        Item(id: "d3k2", name: "Vitamin D3 + K2", dose: 1, unit: "capsule", nutrients: ["vit_d_ug": 25, "vit_k_ug": 100], aliases: ["d3 k2", "vitamin d k2"]),
        Item(id: "vitc", name: "Vitamin C", dose: 500, unit: "mg", nutrients: ["vit_c_mg": 500], aliases: ["vit c", "ascorbic acid", "vitamin c"]),
        Item(id: "vitc1000", name: "Vitamin C 1,000 mg", dose: 1000, unit: "mg", nutrients: ["vit_c_mg": 1000], aliases: ["vit c", "vitamin c"]),
        Item(id: "b12", name: "Vitamin B12", dose: 1000, unit: "µg", nutrients: ["b12_ug": 1000], aliases: ["b12", "cobalamin", "methylcobalamin"]),
        Item(id: "bcomplex", name: "B-complex", dose: 1, unit: "tablet", nutrients: ["b1_mg": 25, "b2_mg": 25, "b3_mg": 50, "b6_mg": 25, "folate_ug": 400, "b12_ug": 100, "choline_mg": 50], aliases: ["b complex", "vitamin b", "b vitamins"]),
        Item(id: "folate", name: "Folic acid", dose: 400, unit: "µg", nutrients: ["folate_ug": 400], aliases: ["folate", "folic", "b9"]),
        Item(id: "b6", name: "Vitamin B6", dose: 10, unit: "mg", nutrients: ["b6_mg": 10], aliases: ["b6", "pyridoxine"]),
        Item(id: "vita", name: "Vitamin A", dose: 800, unit: "µg", nutrients: ["vit_a_ug": 800], aliases: ["vit a", "retinol", "vitamin a"]),
        Item(id: "vite", name: "Vitamin E", dose: 100, unit: "mg", nutrients: ["vit_e_mg": 100], aliases: ["vit e", "tocopherol", "vitamin e"]),
        Item(id: "k2", name: "Vitamin K2", dose: 100, unit: "µg", nutrients: ["vit_k_ug": 100], aliases: ["k2", "mk-7", "mk7", "vitamin k"]),
        Item(id: "multi", name: "Multivitamin", dose: 1, unit: "tablet", nutrients: multi, aliases: ["multi", "multivit", "a-z", "centrum", "wellman", "wellwoman"]),
        Item(id: "multi_min", name: "Multivitamin & minerals", dose: 1, unit: "tablet", nutrients: multi.merging(["magnesium_mg": 100, "calcium_mg": 160, "selenium_ug": 55]) { a, _ in a }, aliases: ["multi", "multivitamin minerals", "a-z", "centrum"]),
        Item(id: "iron", name: "Iron", dose: 14, unit: "mg", nutrients: ["iron_mg": 14], aliases: ["ferrous", "iron tablet", "ferrous sulphate", "ferrous fumarate"]),
        Item(id: "iron_gentle", name: "Gentle iron (bisglycinate)", dose: 20, unit: "mg", nutrients: ["iron_mg": 20], aliases: ["iron", "bisglycinate", "gentle iron"]),
        Item(id: "mag", name: "Magnesium", dose: 300, unit: "mg", nutrients: ["magnesium_mg": 300], aliases: ["mag", "magnesium citrate", "magnesium glycinate", "magnesium bisglycinate", "zma"]),
        Item(id: "mag_malate", name: "Magnesium malate", dose: 400, unit: "mg", nutrients: ["magnesium_mg": 400], aliases: ["mag", "magnesium"]),
        Item(id: "zinc", name: "Zinc", dose: 15, unit: "mg", nutrients: ["zinc_mg": 15], aliases: ["zinc picolinate", "zinc citrate", "zma"]),
        Item(id: "zma", name: "ZMA", dose: 1, unit: "capsule", nutrients: ["zinc_mg": 10, "magnesium_mg": 150, "b6_mg": 3.5], aliases: ["zma", "zinc magnesium"]),
        Item(id: "calcium", name: "Calcium", dose: 500, unit: "mg", nutrients: ["calcium_mg": 500], aliases: ["calcium carbonate", "calcium citrate"]),
        Item(id: "cald", name: "Calcium + vitamin D", dose: 1, unit: "tablet", nutrients: ["calcium_mg": 600, "vit_d_ug": 10], aliases: ["calcium d", "adcal"]),
        Item(id: "selenium", name: "Selenium", dose: 100, unit: "µg", nutrients: ["selenium_ug": 100], aliases: ["selenium"]),
        Item(id: "potassium", name: "Potassium", dose: 99, unit: "mg", nutrients: ["potassium_mg": 99], aliases: ["potassium citrate", "potassium chloride"]),
        Item(id: "electrolytes", name: "Electrolytes", dose: 1, unit: "scoop", nutrients: ["sodium_mg": 500, "potassium_mg": 200, "magnesium_mg": 60], aliases: ["electrolyte", "lmnt", "hydration tabs", "sis hydro", "rehydration"]),
        Item(id: "choline", name: "Choline", dose: 250, unit: "mg", nutrients: ["choline_mg": 250], aliases: ["choline bitartrate", "alpha gpc", "citicoline"]),
        Item(id: "omega3", name: "Omega-3 fish oil", dose: 1000, unit: "mg", nutrients: ["poly": 0.6], aliases: ["omega", "fish oil", "epa", "dha", "cod liver oil", "krill"]),
        Item(id: "codliver", name: "Cod liver oil", dose: 1000, unit: "mg", nutrients: ["poly": 0.25, "vit_a_ug": 800, "vit_d_ug": 5], aliases: ["cod liver", "omega", "fish oil"]),
        Item(id: "psyllium", name: "Psyllium husk", dose: 5, unit: "g", nutrients: ["fibre": 4], aliases: ["psyllium", "fibre supplement", "fiber", "husk"]),
        Item(id: "inulin", name: "Inulin", dose: 5, unit: "g", nutrients: ["fibre": 4.5], aliases: ["inulin", "prebiotic fibre", "fibre"]),
        Item(id: "caffeine", name: "Caffeine tablet", dose: 200, unit: "mg", nutrients: ["caffeine_mg": 200], aliases: ["caffeine", "pro plus", "pre workout caffeine"]),
        Item(id: "salt", name: "Salt tablet", dose: 1, unit: "tablet", nutrients: ["sodium_mg": 400], aliases: ["salt", "sodium tablet", "saltstick"]),
    ]
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
