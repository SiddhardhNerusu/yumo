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

struct Serving: Codable, Hashable { var label: String; var grams: Double
    /// Millilitres in one serving when the label is a volume ("100 ml", "1 × 250ml", "1 can (330 ml)") — drinks are logged in ml (20 Oct).
    /// `grams` stays the weight that volume has, so every macro is still per gram.
    var ml: Double? {
        guard let r = label.range(of: #"(\d+(?:\.\d+)?)\s*ml\b"#, options: [.regularExpression, .caseInsensitive]) else { return nil }
        return Double(label[r].lowercased().replacingOccurrences(of: "ml", with: "").trimmingCharacters(in: .whitespaces))
    }
}

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
    // rev 2 — nutrients (PRODUCT_BRIEF §4)
    var nutrientTargetsData: Data = Data()  // [key: [rda, ul]] overrides
    var pinnedNutrientsData: Data = Data()  // [key] ≤ 3
    var showNutrientsOnToday: Bool = false
    var isPlus: Bool = true                 // every feature unlocked in v1
    var typeItHintSeen: Bool = false        // first-time line under the Type it field (Features.typeIt)
    var swipeHintSeen: Bool = false          // the "Yesterday's …" row nudges once (rev 5)
    var planEdited: Bool = false             // Your plan macros were dragged in onboarding (rev 5)
    var tourDone: Bool = false               // first-run guided tour (README §15)
    var suppNudgeAnswered: [String] = []     // nutrient keys whose "Taking a supplement?" nudge was answered (rev 9); never asked twice
    var tourStep: Int? = nil                 // persists if the app is killed mid-tour
    var cutStartedAt: Date? = nil           // for the stall rule (cutting ≥ 8 weeks)
    var stallDecisionWeek: String? = nil    // week the user answered the stall check-in
    var dietBreakUntil: Date? = nil         // diet break: target = measured maintenance until this date
    // rev 10 §7 — weekly review lifecycle
    var reviewWeek: String? = nil           // week (Monday key) the current review is for
    var reviewDone: Bool = true             // Apply / Keep / stall choice made (or the week had < 5 logged days)
    var reviewOpened: Bool = false          // auto-presented once; afterwards only the chip reopens it
    var reviewPage: Int = 0                 // reopens where you left off
    init() {}
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
    var lastServingLabel: String? = nil   // the amount you logged last time (20 Oct): Recent rows and the Food page open on it
    var lastServingGrams: Double? = nil
    var lastQuantity: Double? = nil
    var mlDensity: Double? = nil          // g per ml for drinks (20 Oct): amounts are in ml, macros stay per 100 g. nil = weighed in grams
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
        let sv = Serving(label: servingLabel, grams: servingGrams)
        let total = sv.ml.map { "\(Fmt.g($0 * quantity)) ml" } ?? "\(Fmt.g(grams)) g"   // a drink reads in ml: 2.5 × "100 ml" is "250 ml", not its 257 g
        let plain = servingLabel.hasSuffix(" g") || sv.ml != nil   // weighed foods unchanged: "1 medium · 118 g" × 2 reads "236 g"
        if plain || quantity == 1 && servingLabel.hasPrefix("1 ") == false { return total }
        let unit = servingLabel.replacingOccurrences(of: #"^1 ×? ?"#, with: "", options: .regularExpression).components(separatedBy: " · ").first ?? servingLabel
        return "\(quantity.formatted()) \(unit) · \(total)"
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

    /// Units people count (20 Oct): a serving whose label starts "1 <word>" where the word is a piece, not a cut you weigh.
    /// "1 medium · 118 g" and "1 scoop · 30 g" are portions; "1 breast · 174 g" is not — you weigh chicken. Nor is a US cup:
    /// "1 cup whole kernels · 157 g" opened almonds on 953 kcal; it stays in the unit picker, the default is 100 g.
    static let countedUnits: Set<String> = ["small", "medium", "large", "extra", "egg", "slice", "item", "bar", "biscuit", "cookie", "cracker", "roll", "bun", "wrap", "pot", "can", "bottle", "sachet", "scoop", "tbsp", "tsp", "portion", "serving", "pack", "packet", "bag", "tin", "tub", "stick", "square", "cube", "sprig", "clove", "leaf", "head", "ear", "pod", "fruit", "nut", "date", "fig", "wedge", "sheet", "rasher", "sausage", "burger", "patty"]
    var portions: [Serving] {
        servings.filter { sv in
            guard !(sv.label.hasSuffix(" g") || sv.label.hasSuffix(" ml")) || sv.label.hasPrefix("1 ") else { return false }
            let unit = sv.label.replacingOccurrences(of: #"^1 ×? ?"#, with: "", options: .regularExpression).components(separatedBy: " · ").first?.lowercased() ?? ""
            let words = Set(unit.split(separator: " ").map(String.init))
            return tier != .generic || !words.isDisjoint(with: Food.countedUnits)
        }
    }
    /// The bare amount a food is measured in: 100 ml of a drink (weighing what 100 ml of it weighs), else 100 g.
    var plainServing: Serving { mlDensity.map { Serving(label: "100 ml", grams: 100 * $0) } ?? Serving(label: "100 g", grams: 100) }
    /// What the page opens on and + logs: 100 g for anything you weigh, 100 ml for a drink; the real unit for things you count and for chain / packaged portions.
    var quickServing: Serving {
        if tier == .chain || tier == .branded { return defaultServing }
        // a catalogue row's first serving may be its everyday UK portion in plain grams ("30 g" of almonds, tools/portions.csv, 21 Oct):
        // the page opens on it, the stepper moves by half of it, + logs it; 100 g stays in the unit picker
        if let first = servings.first, first.ml == nil, first.grams != 100, first.label.range(of: #"^\d+(\.\d+)? g$"#, options: .regularExpression) != nil { return first }
        return portions.first ?? plainServing
    }
    /// The amount you logged last time, else quickServing × 1. "250 g" of chicken stays 250 g in Recent and on the page.
    var quickAmount: (serving: Serving, quantity: Double) {
        if let l = lastServingLabel, let g = lastServingGrams, let q = lastQuantity, g > 0, q > 0 { return (Serving(label: l, grams: g), q) }
        return (quickServing, 1)
    }
    var quickGrams: Double { quickAmount.serving.grams * quickAmount.quantity }
    var quickAmountLabel: String {
        let (sv, q) = quickAmount
        if let ml = sv.ml { return "\(Fmt.g(ml * q)) ml" }   // 2.5 × "100 ml" reads "250 ml", never its grams
        if sv.label.hasSuffix(" g") || q != 1 { return "\(Fmt.g(sv.grams * q)) g" }
        return sv.label
    }
    /// "Raw" · "Grilled" · "Boiled" · "Dry" — the one word for the state switch on the Food page.
    /// Words that describe how a food was cooked rather than what it is — ignored when matching a food to its other states.
    static let cookingWords: Set<String> = ["raw", "uncooked", "dry", "dried", "cooked", "boiled", "baked", "roasted", "roast", "grilled", "fried", "braised", "steamed", "poached", "stewed", "microwaved", "barbecued", "smoked", "in", "unsalted", "salted", "water", "oil", "corn", "sunflower", "rapeseed", "lard", "dripping", "blended", "vegetable", "with", "without", "skin", "drained", "frozen", "canned", "heated", "oven", "reheated"]
    var stateLabel: String? {
        let s = (state ?? name).lowercased()   // CoFID sometimes puts the method in the name with no state
        if s.isEmpty { return nil }
        // a cooking method wins over "dry": "dry roasted" almonds are Roasted, not the Dry base state (21 Oct)
        for (k, v) in [("raw", "Raw"), ("grilled", "Grilled"), ("roasted", "Roasted"), ("roast", "Roasted"), ("baked", "Baked"), ("boiled", "Boiled"), ("fried", "Fried"), ("braised", "Braised"), ("steamed", "Steamed"), ("poached", "Poached"), ("stewed", "Stewed"), ("microwaved", "Microwaved"), ("barbecued", "Barbecued"), ("smoked", "Smoked"), ("toasted", "Toasted"), ("canned", "Canned"), ("frozen", "Frozen"), ("uncooked", "Dry"), ("dry", "Dry"), ("cooked", "Cooked")] where s.contains(k) { return v }
        return nil
    }
}
@Model final class PrepDay {
    @Attribute(.unique) var dayKey: String = ""
    var modeRaw: String = "prepped"
    var itemsData: Data = Data()
    var keepData: Data = Data()
    var loggedData: Data = Data()   // foodId → grams this sheet logged today (21 Oct): only these are netted off a weighed amount, never a meal you added by hand
    var swaps: Int = 0
    init(dayKey: String) { self.dayKey = dayKey }
    var logged: [String: Double] { get { (try? JSONDecoder().decode([String: Double].self, from: loggedData)) ?? [:] } set { loggedData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
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

/// Supplement (rev 9, README §7d). Two tiers: nutrient-feeding (counts toward nutrients on the days taken) or stack-only (kept on the list, changes nothing).
@Model final class Supplement {
    @Attribute(.unique) var id: String = UUID().uuidString
    var name: String = ""
    var tierRaw: String = "stack"            // nutrient | stack
    var dose: Double = 0
    var unit: String = "mg"
    var daysData: Data = Data()              // [Bool × 7], Monday first
    var nutrientsData: Data = Data()         // [key: amount per dose]
    var catalogueId: String? = nil
    var order: Int = 0
    var createdAt: Date = Date()
    init(name: String, tier: String, dose: Double, unit: String, days: [Bool], nutrients: [String: Double], catalogueId: String?, order: Int) {
        self.name = name; tierRaw = tier; self.dose = dose; self.unit = unit; self.days = days; self.nutrients = nutrients; self.catalogueId = catalogueId; self.order = order
    }
    var isNutrient: Bool { tierRaw == "nutrient" }
    var days: [Bool] { get { let d = (try? JSONDecoder().decode([Bool].self, from: daysData)) ?? []; return d.count == 7 ? d : Array(repeating: true, count: 7) } set { daysData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
    /// Per-dose nutrient amounts in the app's nutrient units, scaled to the chosen dose by `Supplements.amounts`.
    var nutrients: [String: Double] { get { (try? JSONDecoder().decode([String: Double].self, from: nutrientsData)) ?? [:] } set { nutrientsData = (try? JSONEncoder().encode(newValue)) ?? Data() } }
    var everyDay: Bool { days.allSatisfy { $0 } }
    var daysLabel: String { everyDay ? "daily" : "\(days.filter { $0 }.count) days a week" }
    var doseLabel: String { Supplements.formatDose(dose, unit: unit) }
}
