import Foundation
import SwiftData

/// Weekly review (REV10_SPEC §7) — lifecycle and the numbers behind the five pages. Replaces the Sunday check-in.
@MainActor
enum Review {
    enum Scenario { case loss, stall, gain }

    struct DayStat: Identifiable { var id: String { key }; let key: String; let date: Date; let logged: Bool; let kcal: Double; let p: Double; let c: Double; let f: Double }
    struct FoodShare { let name: String; let grams: Double; let macro: Double; let days: Int }

    // MARK: Lifecycle (§7.1)
    static func mondaySix(_ weekStart: Date) -> Date { Calendar.current.date(bySettingHour: 6, minute: 0, second: 0, of: weekStart) ?? weekStart }

    /// Call on every return to Today. Returns true while a review is pending (the chip shows, the review can reopen).
    /// Opens on/after Monday 06:00 for the week just ended, only when that week has ≥ 5 logged days; expires Tuesday 06:00 untouched.
    static func refresh(_ store: Store, now: Date = Date()) -> Bool {
        let p = store.profile(); guard p.onboarded else { return false }
        let thisWeek = Expenditure.weekStart(now), lastWeek = thisWeek.adding(days: -7)
        let opens = mondaySix(thisWeek), expires = opens.adding(days: 1)
        guard now >= opens, lastWeek >= Expenditure.weekStart(p.createdAt) else { return false }
        if p.reviewWeek != lastWeek.dayKey {
            let logged = store.loggedDays(from: lastWeek.dayKey, to: lastWeek.adding(days: 6).dayKey).count
            p.reviewWeek = lastWeek.dayKey; p.reviewOpened = false; p.reviewPage = 0
            p.reviewDone = logged < 5      // a week with < 5 logged days has no review — skip silently
            store.save()
        }
        if p.reviewDone || now >= expires { return false }
        return true
    }
    static func finish(_ store: Store) { let p = store.profile(); p.reviewDone = true; p.reviewPage = 0; store.save() }

    // MARK: The week
    struct Week {
        var weekStart: Date
        var days: [DayStat]
        var entries: [FoodEntry]
        var target: Int; var proteinGoal: Int; var carbsGoal: Int; var fatGoal: Int
        var estimate: WeeklyEstimate?; var previous: WeeklyEstimate?
        var trendDelta: Double?
        var sinceStartKg: Double?
        var lossRun: Int
        var scenario: Scenario
        var stall: Expenditure.Stall?
        var pace: Double
        var nowKg: Double
        var pastWeeks: [Double]          // trend at the end of each of the last 4 weeks, oldest first
        var proposal: Int?               // the adaptive proposal for this week, if any
        var maintenance: Int             // measured when the week qualified, else the smoothed value so far, else the formula
        var measured: Bool
        var confidence: String           // High / Medium / Low (see confidence(_:_:))
        var weighIns: Int

        var loggedDays: [DayStat] { days.filter(\.logged) }
        var loggedCount: Int { loggedDays.count }
        func avg(_ f: (DayStat) -> Double) -> Double { let l = loggedDays; return l.isEmpty ? 0 : l.map(f).reduce(0, +) / Double(l.count) }
        var kcalAvg: Double { avg(\.kcal) }
        var pAvg: Double { avg(\.p) }
        var cAvg: Double { avg(\.c) }
        var fAvg: Double { avg(\.f) }
        /// Protein counts as hit at goal − 5 g (the same rule the solver uses); carbs within ±20 g; fat within ±10 g.
        func hit(_ macro: Macro, _ d: DayStat) -> Bool {
            switch macro { case .protein: d.p >= Double(proteinGoal) - 5; case .carbs: abs(d.c - Double(carbsGoal)) <= 20; case .fat: abs(d.f - Double(fatGoal)) <= 10 }
        }
        var proteinHitDays: Int { loggedDays.filter { hit(.protein, $0) }.count }
        var kcalOnTargetDays: Int { loggedDays.filter { abs($0.kcal - Double(target)) <= 100 }.count }
        var endDate: Date { Date().startOfDay.adding(days: 42) }
        var endKg: Double { nowKg + pace * 6 }
        var weekLabel: String { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "d MMM"; return "Week of \(f.string(from: weekStart))" }

        /// "Where your protein came from": the week's foods ranked by that macro. Value = amount eaten over the week.
        func foods(for macro: Macro) -> [FoodShare] {
            var acc: [String: (grams: Double, macro: Double, days: Set<String>)] = [:]
            for e in entries {
                let name = Food.split(e.foodName, state: e.food?.state).name
                let m: Double = macro == .protein ? e.p : macro == .carbs ? e.c : e.f
                var cur = acc[name] ?? (0, 0, [])
                cur.grams += e.quantity * e.servingGrams; cur.macro += m; cur.days.insert(e.dayKey); acc[name] = cur
            }
            return acc.map { FoodShare(name: $0.key, grams: $0.value.grams, macro: $0.value.macro, days: $0.value.days.count) }.filter { $0.macro > 0 }.sorted { $0.macro > $1.macro }.prefix(3).map { $0 }
        }
        func macroTotal(_ macro: Macro) -> Double { loggedDays.map { macro == .protein ? $0.p : macro == .carbs ? $0.c : $0.f }.reduce(0, +) }
    }
    enum Macro: String, CaseIterable { case protein = "Protein", carbs = "Carbs", fat = "Fat" }

    static func amount(_ grams: Double) -> String { grams >= 1000 ? String(format: "%.1f kg", grams / 1000).replacingOccurrences(of: ".0 kg", with: " kg") : "\(Int(grams.rounded())) g" }

    static func week(_ store: Store, weekStart: Date) -> Week {
        let p = store.profile(), t = store.targets()
        let keys = (0..<7).map { weekStart.adding(days: $0) }
        var entries: [FoodEntry] = []
        let days: [DayStat] = keys.map { d in let es = store.entries(d.dayKey); entries += es; let tot = DayTotals(es); return DayStat(key: d.dayKey, date: d, logged: tot.kcal > 0, kcal: tot.kcal, p: tot.p, c: tot.c, f: tot.f) }
        let ests = store.weeklyEstimates()
        let est = ests.first { $0.weekStart == weekStart.dayKey }
        let prev = ests.filter { !$0.lowData && $0.weekStart < weekStart.dayKey }.last
        let weights = store.weights()
        let weekWeights = weights.filter { $0.dayKey >= keys[0].dayKey && $0.dayKey <= keys[6].dayKey }
        var delta: Double? = (est?.lowData == false) ? est?.trendDeltaKg : nil
        if delta == nil, let a = store.latestWeight(before: keys[0].dayKey)?.trendKg, let b = weekWeights.max(by: { $0.dayKey < $1.dayKey })?.trendKg { delta = b - a }
        let latest = weights.first
        let nowKg = latest?.trendKg ?? latest?.kg ?? store.currentKg()
        let first = weights.last
        let since: Double? = first.map { nowKg - $0.kg }
        var run = 0
        for e in ests.filter({ !$0.lowData && $0.weekStart <= weekStart.dayKey }).reversed() { if e.trendDeltaKg < 0 { run += 1 } else { break } }
        let stall = Expenditure.stallCheck(store)
        let scenario: Scenario = stall != nil ? .stall : ((delta ?? 0) > 0 ? .gain : .loss)
        let past: [Double] = (0..<4).map { i in let end = weekStart.adding(days: 6 - 7 * (3 - i)); return store.latestWeight(before: end.adding(days: 1).dayKey).map { $0.trendKg ?? $0.kg } ?? nowKg }
        let proposal = (p.pendingWeek == weekStart.dayKey) ? p.pendingTo : nil
        let measured = est?.lowData == false
        let maint = measured ? Calc.round50(est!.tdeeSmoothed) : Calc.round50(p.tdeeMeasured ?? t.tdee)
        return Week(weekStart: weekStart, days: days, entries: entries, target: t.kcal, proteinGoal: t.protein, carbsGoal: t.carbs, fatGoal: t.fat,
                    estimate: est, previous: prev, trendDelta: delta, sinceStartKg: since, lossRun: max(run, (delta ?? 0) < 0 ? 1 : 0), scenario: scenario, stall: stall,
                    pace: p.paceKgPerWeek, nowKg: nowKg, pastWeeks: past, proposal: proposal, maintenance: maint, measured: measured,
                    confidence: confidence(est, updates: p.weeklyUpdates), weighIns: weekWeights.count)
    }
    /// Confidence (§6.1, aligned with the adaptive-target code): Low = the week did not qualify (< 5 logged days or < 3 weigh-ins, the number is an estimate);
    /// Medium = qualified but fewer than 3 weekly updates so far ("Estimate"); High = qualified with 3+ weekly updates.
    static func confidence(_ e: WeeklyEstimate?, updates: Int) -> String { guard let e, !e.lowData else { return "Low" }; return updates >= 3 ? "High" : "Medium" }

    static let words = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]
    static func word(_ n: Int) -> String { n < words.count ? words[n] : "\(n)" }
    static func kg2(_ v: Double) -> String { String(format: "%.2f", abs(v)) }
    static func kg1(_ v: Double) -> String { String(format: "%.1f", abs(v)) }
    static func dayName(_ d: Date) -> String { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "EEEE"; return f.string(from: d) }
    static func longDate(_ d: Date) -> String { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "d MMMM"; return f.string(from: d) }
    static func shortDate(_ d: Date) -> String { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "d MMM"; return f.string(from: d) }

    // MARK: Copy (§7.3, §7.5, §7.6, §7.7, §7.8 — positive first, honest always; never "slipped", "missed", "failed", "only")
    static func headline(_ w: Week) -> String {
        switch w.scenario {
        case .loss: return "That's a good week."
        case .stall, .gain: return w.sinceStartKg.map { $0 < -0.05 ? "Still \(kg1($0)) kg down." : "Holding steady." } ?? "Holding steady."
        }
    }
    static func sub(_ w: Week) -> String {
        switch w.scenario {
        case .loss:
            guard w.trendDelta != nil else { return "You logged \(w.loggedCount) days. Weigh in a few times next week and Yumo can measure what changed." }
            let since = w.sinceStartKg.map { $0 < -0.05 ? " \(kg1($0)) kg down since you started." : "" } ?? ""
            return (w.lossRun >= 2 ? "\(word(w.lossRun)) weeks in a row now." : "Your first full week down.") + since
        case .stall: return "Flat three weeks running — but you logged \(w.loggedCount) days and held your numbers. That is the hard part."
        case .gain: return "One week up is usually water, salt or a big weekend — not fat. You logged \(w.loggedCount) days and hit protein on \(w.proteinHitDays). Nothing changes this week."
        }
    }
    static func macroNote(_ w: Week, _ m: Macro) -> String {
        let hits = w.loggedDays.filter { w.hit(m, $0) }.count, n = w.loggedCount
        switch m {
        case .protein: return "\(hits) / \(n) days at \(w.proteinGoal) g"
        case .carbs: return hits == n ? "within 20 g all week" : "within 20 g on \(hits) of \(n) days"
        case .fat: return hits == n ? "within 10 g all week" : "within 10 g on \(hits) of \(n) days"
        }
    }
    static func calorieNote(_ w: Week) -> String {
        let over = w.loggedDays.filter { $0.kcal - Double(w.target) > 100 }, under = w.loggedDays.filter { Double(w.target) - $0.kcal > 100 }
        var parts: [String] = []
        for d in over { parts.append("\(dayName(d.date)) ran \(Fmt.k(d.kcal - Double(w.target))) over") }
        for d in under { parts.append("\(dayName(d.date)) came in \(Fmt.k(Double(w.target) - d.kcal)) under") }
        var s = parts.isEmpty ? "Every logged day sat inside 100 of \(Fmt.k(w.target))." : parts.joined(separator: "; ") + "; the rest sat inside 100 of \(Fmt.k(w.target))."
        let unlogged = w.days.filter { !$0.logged }
        if unlogged.count == 1 { s += " \(dayName(unlogged[0].date)) wasn't logged, so it doesn't count either way." }
        else if unlogged.count > 2 { s += " \(unlogged.count) days weren't logged, so they don't count either way." }
        else if unlogged.count == 2 { s += " \(dayName(unlogged[0].date)) and \(dayName(unlogged[1].date)) weren't logged, so they don't count either way." }
        return s
    }
    static func maintenanceNote(_ w: Week) -> String {
        guard w.measured, let prev = w.previous else { return w.measured ? "Your first measured week." : "A formula for now — the measured number needs 5 logged days and 3 weigh-ins in a week." }
        let d = w.maintenance - Calc.round50(prev.tdeeSmoothed)
        if d < 0 { return "\(Fmt.k(-d)) lower than last week — normal as you get lighter." }
        if d > 0 { return "\(Fmt.k(d)) higher than last week." }
        return "Same as last week."
    }
    static func why(_ w: Week, hasStaples: Bool) -> String {
        guard let delta = w.trendDelta else { return "No weigh-ins this week, so the target stays where it is. Protein stays at \(w.proteinGoal) g." }
        let rate = kg2(delta), paceS = kg1(w.pace)
        let staples = hasStaples ? " I prepped… rebalances your staples from tomorrow." : ""
        guard let to = w.proposal, to != w.target else { return "You're at \(rate) kg a week against \(paceS). Protein stays at \(w.proteinGoal) g." }
        let diff = abs(to - w.target)
        if to < w.target { return "You're at \(rate) kg a week; \(diff) fewer gets you to \(paceS). Protein stays at \(w.proteinGoal) g.\(staples)" }
        return "You're at \(rate) kg a week, faster than \(paceS); \(diff) more eases it back. Protein stays at \(w.proteinGoal) g.\(staples)"
    }
}
