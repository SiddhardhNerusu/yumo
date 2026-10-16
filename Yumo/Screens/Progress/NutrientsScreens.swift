import SwiftUI
import SwiftData

/// Progress › Nutrients: 7- or 30-day averages vs DRI targets. Danger only over a UL or under 50 % of RDA for the whole window.
struct ProgressNutrientsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    @State private var window = 7
    @State private var tick = 0
    var store: Store { Store(ctx) }
    struct Row: Identifiable { var n: Nutrient; var avg: Double?; var goal: Double?; var ul: Double?; var daysWithData: Int; var id: String { n.key } }
    var rows: [Row] {
        let p = store.profile(); let t = store.targets()
        let days = (0..<window).map { Date().adding(days: -$0).dayKey }
        let perDay = days.map { store.entries($0) }.filter { !$0.isEmpty }
        return Nutrients.all.map { n in
            var vals: [Double] = []
            for es in perDay { let v = es.compactMap { $0.micro(n.key) }; if !v.isEmpty { vals.append(v.reduce(0, +)) } }
            let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
            return Row(n: n, avg: vals.isEmpty ? nil : vals.reduce(0, +) / Double(vals.count), goal: goal, ul: ul, daysWithData: vals.count)
        }
    }
    var body: some View {
        let p = store.profile()
        VStack(spacing: 0) {
            PageHeader(back: "Progress", title: "Nutrients", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            Segmented(options: [(7, "7 days"), (30, "30 days")], selection: $window).padding(.horizontal, Space.gutter).padding(.top, 6)
            ScrollView {
                ListCard {
                    ForEach(rows) { r in
                        let ref = r.goal ?? r.ul
                        let pct = (r.avg != nil && ref != nil && ref! > 0) ? r.avg! / ref! : nil
                        let danger = (r.avg != nil && r.ul != nil && r.avg! > r.ul!) || (pct != nil && r.goal != nil && pct! < 0.5 && r.daysWithData >= min(window, 7))
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.n.name).font(.yumo.bodyStrong).foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                                    Text(r.avg.map { "avg \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)" + (ref.map { " of \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)" } ?? "") + " · \(r.daysWithData) of \(window) days had data" } ?? "— · no data yet").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                                }
                                Spacer()
                                Text(pct.map { "\(Int(($0 * 100).rounded())) %" } ?? "—").font(.yumo.title).tabular().foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                            }
                            if let pct { Bar(fraction: min(1, pct), height: 5, fill: danger ? .yumo.danger : .yumo.ink) }
                        }
                        .padding(.vertical, 10).padding(.trailing, Space.cardPad).hairline()
                        .contextMenu {
                            if p.pinnedNutrients.contains(r.n.key) { Button("Unpin") { p.pinnedNutrients.removeAll { $0 == r.n.key }; store.save(); toaster.show("Unpinned \(r.n.name)"); tick += 1 } }
                            else if p.pinnedNutrients.count < 3 { Button("Pin to Today") { p.pinnedNutrients.append(r.n.key); p.showNutrientsOnToday = true; store.save(); toaster.show("Pinned \(r.n.name)"); tick += 1 } }
                        }
                    }
                }.padding(Space.gutter).padding(.bottom, 40)
                Text("Targets: NIH Dietary Reference Intakes (RDA/AI, UL). Fibre 14 g per 1,000 kcal; sodium limit 2,300 mg; saturated fat under 10 % of calories. Unknown values are left out of averages.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, Space.gutter + 4).padding(.bottom, 30)
            }
        }.id(tick).background(Color.yumo.bg.ignoresSafeArea())
    }
}

/// Weekly check-in (PRODUCT_BRIEF §3 UI): one sheet, two cards, Apply / Keep.
struct CheckinSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var showHow = false
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile()
        let e = store.weeklyEstimates().first { $0.weekStart == p.pendingWeek }
        VStack(spacing: 0) {
            SheetHeader(title: "Your week", onClose: { Expenditure.apply(store, accept: false); dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            VStack(spacing: Space.cardGap) {
                if let e, !e.lowData {
                    let (label, ok) = Expenditure.trendLabel(e, pace: p.paceKgPerWeek)
                    ListCard {
                        SettingsRow(label: "Trend") { HStack(spacing: 6) { Text(Fmt.delta(e.trendDeltaKg)).font(.yumo.title).tabular(); Text(label).font(.yumo.caption).foregroundStyle(ok ? Color.yumo.accent : .yumo.inkMuted) } }.hairline()
                        SettingsRow(label: "Logged") { Text("\(e.loggedDays) of 7 days").font(.yumo.title).tabular() }.hairline()
                        SettingsRow(label: "Maintenance") { Text("≈ \(Fmt.k(Calc.round50(e.tdeeSmoothed))) kcal").font(.yumo.title).tabular() }
                    }
                    if let from = p.pendingFrom, let to = p.pendingTo {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Target").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                            Text("\(Fmt.k(from)) → \(Fmt.k(to))").font(.yumo.bigStat).kerning(-0.4).tabular()
                        }.frame(maxWidth: .infinity, alignment: .leading).card()
                        PrimaryButton(label: "Apply \(Fmt.k(to))") { Expenditure.apply(store, accept: true); toaster.show("Target \(Fmt.k(to))"); session.changed(); dismiss() }
                        SecondaryButton(label: "Keep \(Fmt.k(from))", size: .regular) { Expenditure.apply(store, accept: false); dismiss() }
                    } else {
                        Text("Right on target. Nothing to change this week.").font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted)
                        PrimaryButton(label: "OK") { Expenditure.apply(store, accept: false); dismiss() }
                    }
                } else {
                    Text("Not enough logged days to adjust. Target stays \(Fmt.k(store.targets().kcal)).").font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).card()
                    PrimaryButton(label: "OK") { Expenditure.apply(store, accept: false); dismiss() }
                }
                TextAction(label: "How this works") { showHow = true }
            }.padding(Space.gutter)
            Spacer()
        }
        .background(Color.yumo.bg)
        .fullScreenCover(isPresented: $showHow) { HowThisWorksScreen() }
    }
}

/// One paragraph + the four steps, in plain words.
struct HowThisWorksScreen: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Back", title: "How this works", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("A formula guesses your maintenance within about 10–15 %. Your logs can measure it. Every week Yumo compares what you ate with how your weight trend moved and works out what you actually burn, then nudges your target.").font(.yumo.subtitle).foregroundStyle(Color.yumo.ink)
                    step(1, "Trend weight", "Each weigh-in moves a smoothed trend line by a tenth of the gap (exponential moving average, α 0.1, as in The Hacker's Diet). Water weight stops mattering.")
                    step(2, "Weekly expenditure", "On weeks with at least 5 logged days and 3 weigh-ins: maintenance = average intake + (trend change in kg × 7,700) ÷ 7.")
                    step(3, "Smoothing", "The new estimate is blended with the previous one: 60/40 for the first four weeks, then 75/25. The first value is seeded by the Mifflin-St Jeor or Katch-McArdle formula.")
                    step(4, "New target", "Measured maintenance minus your pace (kg per week × 7,700 ÷ 7), rounded to 50, never below the safety floor, and never more than 150 kcal different from last week.")
                    Text("Honest limits: it needs regular weigh-ins and honest logging. The first two weeks are a formula, not a measurement, and a manual override always wins.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.top, 4)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
    func step(_ n: Int, _ t: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").font(.yumo.title).foregroundStyle(.white).frame(width: 28, height: 28).background(Circle().fill(Color.yumo.accent))
            VStack(alignment: .leading, spacing: 4) { Text(t).font(.yumo.title); Text(body).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }
        }.card(padding: EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
    }
}
