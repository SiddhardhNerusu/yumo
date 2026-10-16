import Foundation

/// Every number here comes from a published formula (DESIGN_SYSTEM.md › Calculations). Names are shown in the UI.
enum Calc {
    static let kcalPerKg: Double = 7700          // Wishnofsky: 1 kg body fat ≈ 7,700 kcal
    static let floorMen = 1500, floorWomen = 1200 // NIH guidance floors

    /// Mifflin-St Jeor (1990); Katch-McArdle when body fat is known.
    static func bmr(sex: Sex, kg: Double, cm: Int, age: Int, bodyFat: Double?) -> Double {
        if let bf = bodyFat { return 370 + 21.6 * leanMass(kg: kg, bodyFat: bf) }
        let base = 10 * kg + 6.25 * Double(cm) - 5 * Double(age)
        return sex == .male ? base + 5 : base - 161
    }
    static func leanMass(kg: Double, bodyFat: Double) -> Double { kg * (1 - bodyFat / 100) }
    static func formulaName(bodyFat: Double?) -> String { bodyFat == nil ? "Mifflin-St Jeor" : "Katch-McArdle" }
    static func tdee(bmr: Double, activity: Activity) -> Double { bmr * activity.rawValue }
    static func round50(_ v: Double) -> Int { Int((v / 50).rounded() * 50) }
    /// kg/week → kcal/day (negative for a cut).
    static func paceKcal(_ kgPerWeek: Double) -> Int { Int((kgPerWeek * kcalPerKg / 7).rounded()) }
    static func automaticTarget(tdee: Double, mode: GoalMode, pace: Double) -> Int {
        mode == .maintain ? round50(tdee) : round50(tdee + Double(paceKcal(pace)))
    }
    static func floor(for sex: Sex) -> Int { sex == .male ? floorMen : floorWomen }
    /// Protein 2.8 g/kg lean mass (Helms 2014) when body fat is known, else 2.2 g/kg bodyweight capped at 220 g. Fat 0.8 g/kg, min 50 g.
    static func defaultProtein(kg: Double, bodyFat: Double?) -> Int {
        if let bf = bodyFat { return Int((2.8 * leanMass(kg: kg, bodyFat: bf)).rounded()) }
        return min(220, Int((2.2 * kg).rounded()))
    }
    static func defaultFat(kg: Double) -> Int { max(50, Int((0.8 * kg).rounded())) }
    /// Atwater 4/4/9. carbs = (target − 4P − 9F) ÷ 4
    static func carbs(target: Int, protein: Int, fat: Int) -> Int { max(0, (target - 4 * protein - 9 * fat) / 4) }
    static func macroKcal(p: Int, c: Int, f: Int) -> Int { 4 * p + 4 * c + 9 * f }
    static func bodyFatDescription(_ bf: Double) -> String {
        bf <= 12 ? "Visible abs, veins on arms" : bf <= 17 ? "Some ab definition" : bf <= 24 ? "Soft midsection, little definition" : "No visible definition"
    }
}

/// Derived targets for a profile at a weight. Recomputed on any profile/goal/weight change.
struct Targets {
    var bmr: Double; var tdee: Double; var automatic: Int; var kcal: Int; var clamped: Bool
    var protein: Int; var fat: Int; var carbs: Int; var formula: String; var leanMass: Double?; var measured: Double? = nil
    /// Target for a given day when training/rest targets are on.
    func kcal(training: Bool?, profile p: UserProfile) -> Int { guard p.trainingOn, let t = training else { return kcal }; return t ? p.trainingKcal : p.restKcal }
    var sourceLine: String { measured != nil ? "Measured from your logs · adaptive" : "\(formula) × activity" }
    init(profile p: UserProfile, kg: Double) {
        bmr = Calc.bmr(sex: p.sex, kg: kg, cm: p.heightCm, age: p.age, bodyFat: p.bodyFatPct)
        tdee = Calc.tdee(bmr: bmr, activity: p.activity)
        automatic = Calc.automaticTarget(tdee: tdee, mode: p.goalMode, pace: p.paceKgPerWeek)
        var t = p.overrideKcal ?? ((p.adaptiveOn ? p.adaptiveTarget : nil) ?? automatic)
        if let until = p.dietBreakUntil, until > Date(), let m = p.tdeeMeasured { t = Calc.round50(m) }   // diet break: eat at measured maintenance
        let fl = Calc.floor(for: p.sex)
        clamped = t < fl; if clamped { t = fl }
        kcal = t
        formula = Calc.formulaName(bodyFat: p.bodyFatPct)
        measured = p.adaptiveOn ? p.tdeeMeasured : nil
        leanMass = p.bodyFatPct.map { Calc.leanMass(kg: kg, bodyFat: $0) }
        protein = p.macrosCustomised ? p.proteinG : Calc.defaultProtein(kg: kg, bodyFat: p.bodyFatPct)
        fat = p.macrosCustomised ? p.fatG : Calc.defaultFat(kg: kg)
        carbs = p.carbsG ?? Calc.carbs(target: t, protein: protein, fat: fat)
    }
}

// MARK: - Rev 2 additions (PRODUCT_BRIEF §3, §5)
extension Calc {
    static let emaAlpha = 0.1                      // Hacker's Diet trend weight
    static let maxWeeklyChange = 150               // ±150 kcal change per week (no whiplash)
    /// Recompute trend_kg over an ascending list of (dayKey, kg). Missing days carry the trend forward.
    static func emaTrend(_ entries: [(String, Double)]) -> [String: Double] {
        var out: [String: Double] = [:]; var t: Double? = nil
        for (k, kg) in entries { t = t.map { $0 + emaAlpha * (kg - $0) } ?? kg; out[k] = t }
        return out
    }
    /// Weekly expenditure estimate: mean intake + Δtrend × 7,700 / 7.
    static func tdeeEstimate(meanIntake: Double, trendDeltaKg: Double) -> Double { meanIntake + trendDeltaKg * kcalPerKg / 7 }
    /// Smoothing: 0.6/0.4 for the first 4 weeks, then 0.75/0.25.
    static func smooth(prev: Double, est: Double, weeksSoFar: Int) -> Double { weeksSoFar < 4 ? 0.6 * prev + 0.4 * est : 0.75 * prev + 0.25 * est }
    /// Adaptive target from measured TDEE, clamped to the floor and to ±150 kcal vs the current target.
    static func adaptiveTarget(tdee: Double, mode: GoalMode, pace: Double, current: Int, sex: Sex) -> Int {
        var t = automaticTarget(tdee: tdee, mode: mode, pace: pace)
        t = min(current + maxWeeklyChange, max(current - maxWeeklyChange, t))
        return max(floor(for: sex), round50(Double(t)))
    }
    /// Training/rest split: protein and fat constant, carbs absorb the difference.
    static func carbsFor(kcal: Int, protein: Int, fat: Int) -> Int { carbs(target: kcal, protein: protein, fat: fat) }
    static func weeklyAverage(training: Int, rest: Int, days: [Bool]) -> Int { let n = days.filter { $0 }.count; return Int((Double(training * n + rest * (7 - n)) / 7).rounded()) }
}
