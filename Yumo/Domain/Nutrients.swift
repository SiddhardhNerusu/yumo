import Foundation

/// Micronutrient panel (PRODUCT_BRIEF §4). Stored per 100 g on Food.micros; nil = unknown, shown as "—", never 0.
/// Targets default to NIH Dietary Reference Intakes (RDA/AI, 19–50 y unless noted; Institute of Medicine / NASEM DRI tables).
/// UL where defined. Fibre 14 g per 1,000 kcal (DRI AI basis); sodium limit 2,300 mg (CDRR); saturated fat < 10 % of kcal (DGA).
struct Nutrient: Identifiable {
    let key: String; let name: String; let unit: String; let fdc: String
    /// (male, female) RDA/AI; nil = no target (value shown only)
    let rda: (Double, Double)?; let ul: Double?
    var id: String { key }
    func rdaFor(sex: Sex, age: Int) -> Double? {
        guard let r = rda else { return nil }
        var v = sex == .male ? r.0 : r.1
        if key == "iron_mg", sex == .female, age > 50 { v = 8 }
        if key == "magnesium_mg", age > 30 { v = sex == .male ? 420 : 320 }
        if key == "b6_mg", age > 50 { v = sex == .male ? 1.7 : 1.5 }
        if key == "vit_d_ug", age > 70 { v = 20 }
        if key == "calcium_mg", (sex == .female && age > 50) || age > 70 { v = 1200 }
        return v
    }
}
enum Nutrients {
    static let all: [Nutrient] = [
        Nutrient(key: "fibre", name: "Fibre", unit: "g", fdc: "291", rda: (38, 25), ul: nil),        // overridden by 14 g / 1,000 kcal
        Nutrient(key: "sugars", name: "Sugars", unit: "g", fdc: "269", rda: nil, ul: nil),
        Nutrient(key: "sat_fat", name: "Saturated fat", unit: "g", fdc: "606", rda: nil, ul: nil),   // UL = 10 % kcal, computed
        Nutrient(key: "mono", name: "Monounsaturated fat", unit: "g", fdc: "645", rda: nil, ul: nil),
        Nutrient(key: "poly", name: "Polyunsaturated fat", unit: "g", fdc: "646", rda: nil, ul: nil),
        Nutrient(key: "trans", name: "Trans fat", unit: "g", fdc: "605", rda: nil, ul: nil),
        Nutrient(key: "cholesterol_mg", name: "Cholesterol", unit: "mg", fdc: "601", rda: nil, ul: nil),
        Nutrient(key: "sodium_mg", name: "Sodium", unit: "mg", fdc: "307", rda: (1500, 1500), ul: 2300),
        Nutrient(key: "potassium_mg", name: "Potassium", unit: "mg", fdc: "306", rda: (3400, 2600), ul: nil),
        Nutrient(key: "calcium_mg", name: "Calcium", unit: "mg", fdc: "301", rda: (1000, 1000), ul: 2500),
        Nutrient(key: "iron_mg", name: "Iron", unit: "mg", fdc: "303", rda: (8, 18), ul: 45),
        Nutrient(key: "magnesium_mg", name: "Magnesium", unit: "mg", fdc: "304", rda: (400, 310), ul: nil),
        Nutrient(key: "zinc_mg", name: "Zinc", unit: "mg", fdc: "309", rda: (11, 8), ul: 40),
        Nutrient(key: "phosphorus_mg", name: "Phosphorus", unit: "mg", fdc: "305", rda: (700, 700), ul: 4000),
        Nutrient(key: "selenium_ug", name: "Selenium", unit: "µg", fdc: "317", rda: (55, 55), ul: 400),
        Nutrient(key: "vit_a_ug", name: "Vitamin A", unit: "µg", fdc: "320", rda: (900, 700), ul: 3000),
        Nutrient(key: "vit_c_mg", name: "Vitamin C", unit: "mg", fdc: "401", rda: (90, 75), ul: 2000),
        Nutrient(key: "vit_d_ug", name: "Vitamin D", unit: "µg", fdc: "328", rda: (15, 15), ul: 100),
        Nutrient(key: "vit_e_mg", name: "Vitamin E", unit: "mg", fdc: "323", rda: (15, 15), ul: 1000),
        Nutrient(key: "vit_k_ug", name: "Vitamin K", unit: "µg", fdc: "430", rda: (120, 90), ul: nil),
        Nutrient(key: "b1_mg", name: "Thiamin (B1)", unit: "mg", fdc: "404", rda: (1.2, 1.1), ul: nil),
        Nutrient(key: "b2_mg", name: "Riboflavin (B2)", unit: "mg", fdc: "405", rda: (1.3, 1.1), ul: nil),
        Nutrient(key: "b3_mg", name: "Niacin (B3)", unit: "mg", fdc: "406", rda: (16, 14), ul: 35),
        Nutrient(key: "b6_mg", name: "Vitamin B6", unit: "mg", fdc: "415", rda: (1.3, 1.3), ul: 100),
        Nutrient(key: "folate_ug", name: "Folate (B9)", unit: "µg", fdc: "417", rda: (400, 400), ul: 1000),
        Nutrient(key: "b12_ug", name: "Vitamin B12", unit: "µg", fdc: "418", rda: (2.4, 2.4), ul: nil),
        Nutrient(key: "choline_mg", name: "Choline", unit: "mg", fdc: "421", rda: (550, 425), ul: 3500),
        Nutrient(key: "water_g", name: "Water", unit: "g", fdc: "255", rda: nil, ul: nil),
        Nutrient(key: "caffeine_mg", name: "Caffeine", unit: "mg", fdc: "262", rda: nil, ul: 400),
        Nutrient(key: "alcohol_g", name: "Alcohol", unit: "g", fdc: "221", rda: nil, ul: nil),
    ]
    static func by(_ key: String) -> Nutrient? { all.first { $0.key == key } }
    /// Effective (target, ul) for a profile at a calorie target, with user overrides.
    static func target(_ n: Nutrient, profile p: UserProfile, kcal: Int) -> (Double?, Double?) {
        if let o = p.nutrientOverrides[n.key], o.count == 2 { return (o[0], o[1]) }
        if n.key == "fibre" { return (Double(kcal) / 1000 * 14, nil) }
        if n.key == "sat_fat" { return (nil, Double(kcal) * 0.10 / 9) }
        return (n.rdaFor(sex: p.sex, age: p.age), n.ul)
    }
    static func format(_ v: Double, unit: String) -> String { unit == "g" ? String(format: v < 10 ? "%.1f" : "%.0f", v) : String(format: v < 10 ? "%.1f" : "%.0f", v) }
}
