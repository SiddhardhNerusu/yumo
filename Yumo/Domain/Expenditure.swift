import Foundation
import SwiftData

/// Adaptive target (PRODUCT_BRIEF §3). Implemented exactly:
/// 1. trend_kg = EMA α 0.1 of daily weigh-ins (Store.recomputeTrend).
/// 2. Every 7 days, on ≥ 5 logged days and ≥ 3 weigh-ins: TDEE_est = mean_intake + Δtrend_kg × 7,700 / 7.
/// 3. TDEE = 0.6·prev + 0.4·est for the first 4 weeks, then 0.75 / 0.25; seeded by Mifflin-St Jeor / Katch-McArdle.
/// 4. target = TDEE − pace × 7,700 / 7, rounded to 50, clamped to the safety floor and to ±150 kcal/week.
/// 5. "Estimate" until 3 weekly updates; "Low data" when < 5 logged days (target does not move).
/// 6. Manual override always wins; the proposal is still shown.
@MainActor
enum Expenditure {
    /// Monday-based week containing the date.
    static func weekStart(_ d: Date) -> Date { let c = Calendar.current; let wd = (c.component(.weekday, from: d) + 5) % 7; return d.startOfDay.adding(days: -wd) }

    static func runIfDue(_ store: Store) {
        let p = store.profile(); guard p.onboarded else { return }
        let thisWeek = weekStart(Date())
        var week = weekStart(p.createdAt).adding(days: 7)      // first full week after sign-up
        let done = Set(store.weeklyEstimates().map(\.weekStart))
        while week < thisWeek {
            let key = week.dayKey
            if !done.contains(key) { evaluate(week: week, store: store) }
            week = week.adding(days: 7)
        }
    }

    static func evaluate(week: Date, store: Store) {
        let p = store.profile()
        let days = (0..<7).map { week.adding(days: $0).dayKey }
        let intakes = days.compactMap { k -> Double? in let t = DayTotals(store.entries(k)); return t.kcal > 0 ? t.kcal : nil }
        let weights = store.weights().filter { $0.dayKey >= days[0] && $0.dayKey <= days[6] }
        let e = WeeklyEstimate(weekStart: week.dayKey)
        e.loggedDays = intakes.count; e.weighIns = weights.count
        let prevTrend = store.latestWeight(before: days[0])?.trendKg
        let endTrend = weights.min { $0.dayKey > $1.dayKey }?.trendKg   // latest in week
        if intakes.count >= 5, weights.count >= 3, let a = prevTrend ?? weights.max { $0.dayKey > $1.dayKey }?.trendKg, let b = endTrend {
            e.meanIntake = intakes.reduce(0, +) / Double(intakes.count)
            e.trendDeltaKg = b - a
            e.tdeeEst = Calc.tdeeEstimate(meanIntake: e.meanIntake, trendDeltaKg: e.trendDeltaKg)
            let seed = p.tdeeMeasured ?? Calc.tdee(bmr: Calc.bmr(sex: p.sex, kg: store.currentKg(), cm: p.heightCm, age: p.age, bodyFat: p.bodyFatPct), activity: p.activity)
            e.tdeeSmoothed = Calc.smooth(prev: seed, est: e.tdeeEst, weeksSoFar: p.weeklyUpdates)
            p.tdeeMeasured = e.tdeeSmoothed; p.weeklyUpdates += 1
            let current = store.targets().kcal
            let proposed = Calc.adaptiveTarget(tdee: e.tdeeSmoothed, mode: p.goalMode, pace: p.paceKgPerWeek, current: current, sex: p.sex)
            if p.adaptiveOn, proposed != current { p.pendingFrom = current; p.pendingTo = proposed; p.pendingWeek = week.dayKey }
        } else {
            e.lowData = true
            if p.adaptiveOn { p.pendingFrom = nil; p.pendingTo = nil; p.pendingWeek = week.dayKey }
        }
        store.ctx.insert(e); store.save()
    }

    static func apply(_ store: Store, accept: Bool) {
        let p = store.profile()
        if accept, let to = p.pendingTo { p.overrideKcal = nil; p.adaptiveTarget = to }
        if let wk = p.pendingWeek, let e = store.weeklyEstimates().first(where: { $0.weekStart == wk }) { e.applied = accept }
        p.lastCheckinAt = Date(); p.pendingFrom = nil; p.pendingTo = nil
        store.save()
    }
    // MARK: Stall rule (PRODUCT_BRIEF §13) — fires only when ALL hold; never auto-applies; never on bulk/maintain; never in the first 8 weeks.
    struct Stall { var weeksFlat: Int; var loggedDays: Int; var totalDays: Int; var withinPct: Double; var cutWeeks: Int; var maintenance: Int }
    static func stallCheck(_ store: Store) -> Stall? {
        let p = store.profile(); guard p.goalMode == .cut, p.stallDecisionWeek != weekStart(Date()).dayKey else { return nil }
        let start = p.cutStartedAt ?? p.createdAt
        let cutWeeks = Int(Date().timeIntervalSince(start) / 604800); guard cutWeeks >= 8 else { return nil }
        let est = store.weeklyEstimates().filter { !$0.lowData }.suffix(3); guard est.count == 3 else { return nil }
        guard est.allSatisfy({ abs($0.trendDeltaKg) < 0.1 }) else { return nil }
        let target = Double(store.targets().kcal)
        let logged = est.reduce(0) { $0 + $1.loggedDays }
        guard Double(logged) / 21 >= 0.85, est.allSatisfy({ abs($0.meanIntake - target) / target <= 0.05 }) else { return nil }
        let within = est.map { abs($0.meanIntake - target) / target }.max() ?? 0
        return Stall(weeksFlat: 3, loggedDays: logged, totalDays: 21, withinPct: within * 100, cutWeeks: cutWeeks, maintenance: Calc.round50(p.tdeeMeasured ?? store.targets().tdee))
    }
    enum StallChoice { case dietBreak, hold, lower }
    static func applyStall(_ store: Store, choice: StallChoice?) {
        let p = store.profile()
        switch choice {
        case .dietBreak: p.dietBreakUntil = Date().adding(days: 14); p.adaptiveTarget = Calc.round50(p.tdeeMeasured ?? store.targets().tdee); p.overrideKcal = nil
        case .lower: p.adaptiveTarget = max(Calc.floor(for: p.sex), store.targets().kcal - 100); p.overrideKcal = nil
        case .hold, .none: break
        }
        p.stallDecisionWeek = weekStart(Date()).dayKey; p.lastCheckinAt = Date(); p.pendingFrom = nil; p.pendingTo = nil
        store.save()
    }
    static func trendLabel(_ e: WeeklyEstimate, pace: Double) -> (String, Bool) {
        let onPace = pace == 0 ? abs(e.trendDeltaKg) < 0.2 : (pace < 0 ? e.trendDeltaKg <= pace * 0.6 : e.trendDeltaKg >= pace * 0.6)
        return (onPace ? "on pace" : (pace < 0 ? "slower than planned" : "behind plan"), onPace)
    }
}
