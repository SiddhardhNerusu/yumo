import Foundation
import SwiftData

enum Meal: String, Codable, CaseIterable, Identifiable { case breakfast = "Breakfast", lunch = "Lunch", dinner = "Dinner", snacks = "Snacks"
    var id: String { rawValue }
    /// Pre-selection by time of day: <11 Breakfast, <15 Lunch, <21 Dinner, else Snacks.
    static func forNow(_ d: Date = Date()) -> Meal { let h = Calendar.current.component(.hour, from: d); return h < 11 ? .breakfast : h < 15 ? .lunch : h < 21 ? .dinner : .snacks }
}
enum Sex: String, Codable, CaseIterable { case male = "Male", female = "Female" }
enum GoalMode: String, Codable, CaseIterable { case cut = "Cut", maintain = "Maintain", bulk = "Bulk" }
enum Activity: Double, Codable, CaseIterable, Identifiable { case sedentary = 1.2, light = 1.375, moderate = 1.55, active = 1.725, veryActive = 1.9
    var id: Double { rawValue }
    var name: String { switch self { case .sedentary: "Sedentary"; case .light: "Light"; case .moderate: "Moderate"; case .active: "Active"; case .veryActive: "Very active" } }
    var sub: String { switch self { case .sedentary: "Desk job, no sessions"; case .light: "1–2 sessions a week"; case .moderate: "3–4 sessions a week"; case .active: "5–6 sessions a week"; case .veryActive: "Daily hard training or physical job" } }
}
enum FoodSource: String, Codable { case off, usda, user, usdaBranded = "usda_branded", cofid }
enum FoodTier: String, Codable { case generic, chain, branded, user }

struct Serving: Codable, Hashable { var label: String; var grams: Double }

@Model final class UserProfile {
    var username: String = ""
    var passwordHash: String = ""
    var sex: Sex = Sex.male
    var age: Int = 28
    var heightCm: Int = 180
    var bodyFatPct: Double? = nil
    var activity: Activity = Activity.moderate
    var weightUnitLb: Bool = false
    var volumeUnitFlOz: Bool = false
    var goalMode: GoalMode = GoalMode.cut
    var paceKgPerWeek: Double = -0.5
    var overrideKcal: Int? = nil
    var proteinG: Int = 0
    var fatG: Int = 0
    var carbsG: Int? = nil   // nil = auto (fills the rest)
    var macrosCustomised: Bool = false
    var reminderWeightOn: Bool = false
    var reminderWeightMinutes: Int = 7 * 60 + 30
    var reminderDinnerOn: Bool = false
    var reminderDinnerMinutes: Int = 20 * 60
    var onboarded: Bool = false
    var createdAt: Date = Date()
    // rev 2 — adaptive target (PRODUCT_BRIEF §3)
    var adaptiveOn: Bool = true
    var adaptiveTarget: Int? = nil          // last applied adaptive target (replaces the formula once set)
    var tdeeMeasured: Double? = nil         // smoothed weekly estimate, nil until the first week ran
    var weeklyUpdates: Int = 0              // how many weekly updates have run (confidence)
    var lastCheckinAt: Date? = nil
    var pendingFrom: Int? = nil             // proposal: target from → to
    var pendingTo: Int? = nil
    var pendingWeek: String? = nil
    // rev 2 — training/rest days (PRODUCT_BRIEF §5)
    var trainingOn: Bool = false
    var trainingKcal: Int = 0
    var restKcal: Int = 0
    var trainingDaysData: Data = Data()     // [Bool] ×7, Monday first
    // rev 2 — nutrients (PRODUCT_BRIEF §4)
    var nutrientTargetsData: Data = Data()  // [key: [rda, ul]] overrides
    var pinnedNutrientsData: Data = Data()  // [key] ≤ 3
    var showNutrientsOnToday: Bool = false
    var isPlus: Bool = true                 // every feature unlocked in v1
    var typeItHintSeen: Bool = false        // first-time line under the Type it field
    var swipeHintSeen: Bool = false          // the "Yesterday's …" row nudges once (rev 5)
    var planEdited: Bool = false             // Your plan macros were dragged in onboarding (rev 5)
    var tourDone: Bool = false               // first-run guided tour (README §15)
    var tourStep: Int? = nil                 // persists if the app is killed mid-tour
    var cutStartedAt: Date? = nil           // for the stall rule (cutting ≥ 8 weeks)
    var stallDecisionWeek: String? = nil    // week the user answered the stall check-in
    var dietBreakUntil: Date? = nil         // diet break: target = measured maintenance until this date
    init() {}
    var trainingDays: [Bool] { get { (try? JSONDecoder().decode([Bool].self, from: trainingDaysData)) ?? [true, true, false, true, true, false, false] } set { trainingDaysData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
    var nutrientOverrides: [String: [Double?]] { get { (try? JSONDecoder().decode([String: [Double?]].self, from: nutrientTargetsData)) ?? [:] } set { nutrientTargetsData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
    var pinnedNutrients: [String] { get { (try? JSONDecoder().decode([String].self, from: pinnedNutrientsData)) ?? [] } set { pinnedNutrientsData = (try? JSONEncoder().encode(Array(newValue.prefix(3)))) ?? Data() } }
}

@Model final class Food {
    @Attribute(.unique) var id: String = UUID().uuidString
    var barcode: String? = nil
    var name: String = ""
    var brand: String? = nil
    var sourceRaw: String = FoodSource.user.rawValue
    var servingsData: Data = Data()
    var kcal100: Double = 0
    var p100: Double = 0
    var c100: Double = 0
    var f100: Double = 0
    var fibre100: Double? = nil
    var sugar100: Double? = nil
    var salt100: Double? = nil
    var satFat100: Double? = nil
    var lastUsedAt: Date? = nil
    var useCount: Int = 0
    var fetchedAt: Date = Date()
    // rev 2
    var tierRaw: String = FoodTier.user.rawValue
    var canonicalId: String? = nil
    var state: String? = nil                // raw | cooked (method)
    var sourceRef: String? = nil            // "USDA FDC 171477", "Open Food Facts · updated 12 Sep"
    var microsData: Data = Data()           // [key: per-100 g] — Nutrients.keys; absent = unknown ("—")
    var aliases: String = ""
    var macrosUnknown: Bool = false       // chain items where only kcal is published
    init(name: String, brand: String? = nil, barcode: String? = nil, source: FoodSource, servings: [Serving], kcal100: Double, p100: Double, c100: Double, f100: Double) {
        self.name = name; self.brand = brand; self.barcode = barcode; self.sourceRaw = source.rawValue; self.servings = servings
        self.kcal100 = kcal100; self.p100 = p100; self.c100 = c100; self.f100 = f100
    }
    var source: FoodSource { get { FoodSource(rawValue: sourceRaw) ?? .user } set { sourceRaw = newValue.rawValue } }
    var servings: [Serving] {
        get { (try? JSONDecoder().decode([Serving].self, from: servingsData)) ?? [Serving(label: "100 g", grams: 100)] }
        set { servingsData = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }
    var defaultServing: Serving { servings.first ?? Serving(label: "100 g", grams: 100) }
    func kcal(for grams: Double) -> Double { kcal100 * grams / 100 }
    var tier: FoodTier { get { FoodTier(rawValue: tierRaw) ?? .user } set { tierRaw = newValue.rawValue } }
    var micros: [String: Double] {
        get { var m = (try? JSONDecoder().decode([String: Double].self, from: microsData)) ?? [:]; if let v = fibre100 { m["fibre"] = m["fibre"] ?? v }; if let v = sugar100 { m["sugars"] = m["sugars"] ?? v }; if let v = satFat100 { m["sat_fat"] = m["sat_fat"] ?? v }; if let v = salt100 { m["sodium_mg"] = m["sodium_mg"] ?? v * 400 }; return m }
        set { microsData = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }
    /// "USDA FDC 171477 · raw" / "Fage · Open Food Facts" — the source line under every number (brief §6).
    var sourceLine: String {
        switch tier {
        case .generic: return [sourceRef ?? "USDA FoodData Central", state].compactMap { $0 }.joined(separator: " · ")
        case .chain: return sourceRef ?? "\(brand ?? "Chain") nutrition information"
        case .branded: return [brand, source == .off ? "Open Food Facts" : "USDA Branded Foods"].compactMap { $0 }.joined(separator: " · ")
        case .user: return "Your food"
        }
    }
}

@Model final class FoodEntry {
    var id: String = UUID().uuidString
    var dayKey: String = ""
    var mealRaw: String = Meal.breakfast.rawValue
    var food: Food? = nil
    var foodName: String = ""
    var quantity: Double = 1
    var servingLabel: String = ""
    var servingGrams: Double = 100
    var loggedAt: Date = Date()
    init(dayKey: String, meal: Meal, food: Food, quantity: Double, serving: Serving) {
        self.dayKey = dayKey; self.mealRaw = meal.rawValue; self.food = food; self.foodName = food.name; self.quantity = quantity; self.servingLabel = serving.label; self.servingGrams = serving.grams
    }
    var meal: Meal { get { Meal(rawValue: mealRaw) ?? .breakfast } set { mealRaw = newValue.rawValue } }
    var grams: Double { get { servingGrams * quantity } set { quantity = servingGrams > 0 ? newValue / servingGrams : 1 } }
    var kcal: Double { (food?.kcal100 ?? 0) * grams / 100 }
    var p: Double { (food?.p100 ?? 0) * grams / 100 }
    var c: Double { (food?.c100 ?? 0) * grams / 100 }
    var f: Double { (food?.f100 ?? 0) * grams / 100 }
    /// "80 g", "1 medium · 118 g", "150 g × 2"
    /// Rev 2: the real amount — "120 g", "1.5 scoop · 45 g".
    var amountLabel: String {
        let plain = servingLabel.hasSuffix(" g") || servingLabel.hasSuffix(" ml")
        if plain || quantity == 1 && servingLabel.hasPrefix("1 ") == false { return "\(Fmt.g(grams)) \(servingLabel.hasSuffix(" ml") ? "ml" : "g")" }
        let unit = servingLabel.replacingOccurrences(of: #"^1 ×? ?"#, with: "", options: .regularExpression).components(separatedBy: " · ").first ?? servingLabel
        return "\(quantity.formatted()) \(unit) · \(Fmt.g(grams)) g"
    }
    func micro(_ key: String) -> Double? { food?.micros[key].map { $0 * grams / 100 } }
}

@Model final class WeightEntry {
    @Attribute(.unique) var dayKey: String = ""
    var kg: Double = 0
    var trendKg: Double? = nil              // EMA α 0.1 (Hacker's Diet), carried forward over missing days
    @Attribute(.externalStorage) var photo: Data? = nil
    var loggedAt: Date = Date()
    init(dayKey: String, kg: Double) { self.dayKey = dayKey; self.kg = kg }
    var date: Date { Date.fromKey(dayKey) }
}

struct SavedItem: Codable, Hashable { var foodId: String; var quantity: Double; var servingLabel: String; var servingGrams: Double }
@Model final class SavedMeal {
    var id: String = UUID().uuidString
    var name: String = ""
    var mealRaw: String = Meal.breakfast.rawValue
    var itemsData: Data = Data()
    var createdAt: Date = Date()
    init(name: String, meal: Meal, items: [SavedItem]) { self.name = name; self.mealRaw = meal.rawValue; self.items = items }
    var meal: Meal { Meal(rawValue: mealRaw) ?? .breakfast }
    var items: [SavedItem] { get { (try? JSONDecoder().decode([SavedItem].self, from: itemsData)) ?? [] } set { itemsData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
}

/// Per-day override of the training/rest tag (default comes from the weekly schedule).
@Model final class DayFlag {
    @Attribute(.unique) var dayKey: String = ""
    var isTraining: Bool = false
    init(dayKey: String, isTraining: Bool) { self.dayKey = dayKey; self.isTraining = isTraining }
}

/// One row per weekly expenditure estimate (PRODUCT_BRIEF §3.2).
@Model final class WeeklyEstimate {
    @Attribute(.unique) var weekStart: String = ""
    var meanIntake: Double = 0
    var trendDeltaKg: Double = 0
    var tdeeEst: Double = 0
    var tdeeSmoothed: Double = 0
    var loggedDays: Int = 0
    var weighIns: Int = 0
    var lowData: Bool = false
    var applied: Bool = false
    var createdAt: Date = Date()
    init(weekStart: String) { self.weekStart = weekStart }
}

/// Type-to-log learned pattern: key = "word|meal" or "word|*" (PRODUCT_BRIEF §11). Silent at n ≥ 3; a different pick resets n to 1.
@Model final class LearnedPattern {
    @Attribute(.unique) var key: String = ""
    var foodId: String = ""
    var n: Int = 0
    var updatedAt: Date = Date()
    init(key: String, foodId: String, n: Int) { self.key = key; self.foodId = foodId; self.n = n }
}

/// User-added shorthand (seeded table lives in TypeToLog.aliases).
@Model final class UserAlias {
    @Attribute(.unique) var shorthand: String = ""
    var canonical: String = ""
    init(shorthand: String, canonical: String) { self.shorthand = shorthand; self.canonical = canonical }
}

/// Balance the day — prepped list for a day (PRODUCT_BRIEF §12).
struct PrepItem: Codable, Hashable, Identifiable { var id = UUID(); var text: String; var grams: Double; var foodId: String? = nil; var carried: Bool? = nil }
extension Food {
    /// Rev 6: every list renders the part before the first comma as the name and the rest (plus the state) as the detail line. Never a bare name.
    static func split(_ name: String, state: String? = nil) -> (name: String, detail: String) {
        let parts = name.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let n = parts.first ?? name; var d = parts.dropFirst().joined(separator: ", ")
        if let st = state, !st.isEmpty { d = d.isEmpty ? st : d + " · " + st }
        return (n, d)
    }
    var shortName: String { Food.split(name, state: state).name }
    var detail: String { Food.split(name, state: state).detail }
}
@Model final class PrepDay {
    @Attribute(.unique) var dayKey: String = ""
    var modeRaw: String = "prepped"
    var itemsData: Data = Data()
    var keepData: Data = Data()
    var swaps: Int = 0
    init(dayKey: String) { self.dayKey = dayKey }
    var items: [PrepItem] { get { (try? JSONDecoder().decode([PrepItem].self, from: itemsData)) ?? [] } set { itemsData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
    var keep: Set<String> { get { Set((try? JSONDecoder().decode([String].self, from: keepData)) ?? []) } set { keepData = (try? JSONEncoder().encode(Array(newValue))) ?? Data() } }
}

/// Staple (rev 5): a food the user eats most weeks. No amounts — the solver sizes it; an optional daily Max caps it.
@Model final class Staple {
    @Attribute(.unique) var foodId: String = ""
    var maxG: Double? = nil
    var order: Int = 0
    var createdAt: Date = Date()
    init(foodId: String, maxG: Double? = nil, order: Int) { self.foodId = foodId; self.maxG = maxG; self.order = order }
}
