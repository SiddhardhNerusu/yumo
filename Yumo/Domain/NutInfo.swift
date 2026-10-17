import Foundation

/// What each nutrient does, how to fix a shortfall, and the best everyday sources (rev 5 Nutrients rows). Copy from the handoff prototype.
enum NutInfo {
    struct Info { var why: String; var foods: [(String, String, String)]; var over: String? = nil; var low: String? = nil }
    static let table: [String: Info] = [
        "fibre": Info(why: "Keeps you full on a cut and your gut regular. Target 14 g per 1,000 kcal.", foods: [("Oats", "80 g", "8 g"), ("Chickpeas", "150 g", "11 g"), ("Broccoli", "150 g", "4 g"), ("Sweet potato", "200 g", "6 g")]),
        "sodium_mg": Info(why: "Drives water retention and blood pressure. Sudden swings make the scale lie for a day or two.", foods: [("Chicken tikka pieces", "150 g", "1.1 g"), ("Rice cakes", "4", "0.4 g"), ("Peanut butter", "32 g", "0.2 g")], over: "Highest sources this week on the right. Swap one and the scale settles in 2–3 days."),
        "iron_mg": Info(why: "Carries oxygen to muscle. Low iron shows up as flat sessions and fatigue.", foods: [("Chicken thigh", "200 g", "2.6 mg"), ("Chickpeas", "150 g", "4.4 mg"), ("Oats", "80 g", "3.4 mg"), ("Salmon fillet", "150 g", "0.5 mg")]),
        "potassium_mg": Info(why: "Balances sodium, supports contraction and recovery.", foods: [("Sweet potato", "200 g", "950 mg"), ("Banana", "1 medium", "420 mg"), ("Salmon fillet", "150 g", "550 mg"), ("Greek yoghurt 0%", "200 g", "280 mg")]),
        "calcium_mg": Info(why: "Bone density and contraction. Hard to hit without dairy.", foods: [("Greek yoghurt 0%", "200 g", "220 mg"), ("Oat milk", "300 ml", "360 mg"), ("Broccoli", "150 g", "70 mg")]),
        "vit_d_ug": Info(why: "Testosterone, bone and immune support. Nearly impossible from food alone in winter — most lifters supplement 1,000–2,000 IU.", foods: [("Salmon fillet", "150 g", "16 µg"), ("Whole eggs", "×3", "3 µg"), ("Oat milk", "300 ml", "4.5 µg")], low: "One 150 g salmon fillet covers today. Or a daily 25 µg (1,000 IU) D3 — cheap and reliable."),
        "magnesium_mg": Info(why: "Sleep, cramps, recovery. Cutting diets run low because intake drops with calories.", foods: [("Oats", "80 g", "140 mg"), ("Peanut butter", "32 g", "55 mg"), ("Chickpeas", "150 g", "70 mg"), ("Banana", "1 medium", "32 mg")]),
        "sat_fat": Info(why: "Keep under 10 % of calories. Needed for hormones in moderation; not a target to hit.", foods: [("Chicken thigh", "200 g", "5 g"), ("Salmon fillet", "150 g", "4 g"), ("Peanut butter", "32 g", "3 g")], over: "Swap thigh for breast on one meal and you are under the limit."),
        "zinc_mg": Info(why: "Testosterone, immune function, recovery. You sweat it out in training.", foods: [("Chicken thigh", "200 g", "4.6 mg"), ("Oats", "80 g", "3.2 mg"), ("Chickpeas", "150 g", "2.3 mg")]),
        "vit_c_mg": Info(why: "Collagen and iron absorption — pair with your iron sources.", foods: [("Broccoli", "150 g", "130 mg"), ("Sweet potato", "200 g", "40 mg"), ("Banana", "1 medium", "10 mg")]),
        "b12_ug": Info(why: "Energy and red blood cells. Animal foods only; above target is fine.", foods: [("Salmon fillet", "150 g", "4.8 µg"), ("Chicken breast", "200 g", "0.7 µg"), ("Greek yoghurt 0%", "200 g", "1.5 µg")]),
        "folate_ug": Info(why: "Cell repair. Comes from greens and legumes, which cutting diets skimp on.", foods: [("Chickpeas", "150 g", "260 µg"), ("Broccoli", "150 g", "95 µg"), ("Oats", "80 g", "45 µg")]),
    ]
    static func info(_ key: String) -> Info? { table[key] }
}
