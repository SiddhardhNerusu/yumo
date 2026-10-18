import SwiftUI
import SwiftData

/// Progress › Maintenance (REV10_SPEC §6) — replaces "How this works". Hero card (44/800 measured value, 4-week bars, three tiles), "This week" card, footer; ⓘ → "How it's worked out" sheet.
struct MaintenanceScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    var back = "Progress"
    @State private var showHow = false
    var store: Store { Store(ctx) }
    var body: some View {
        let week = Review.week(store, weekStart: Expenditure.weekStart(Date()).adding(days: -7))
        VStack(spacing: 0) {
            PageHeader(back: back, title: "Maintenance", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    MaintenanceHero(week: week, estimates: store.weeklyEstimates(), onInfo: { showHow = true })
                    ThisWeekCard(week: week, caption: "Last week")
                    Text("Updates every Monday with your weekly review. Needs 5+ logged days and 3+ weigh-ins.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).lineSpacing(4).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4).padding(.top, 2)
                }.padding(EdgeInsets(top: 12, leading: Space.gutter, bottom: 40, trailing: Space.gutter))
            }.scrollIndicators(.hidden)
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .sheet(isPresented: $showHow) { HowWorkedOutSheet(week: week).yumoSheet().presentationDetents([.large]) }
    }
}

/// §6.1 hero card: caption · 44/800 value + "kcal a day" · ⓘ right; four weekly bars (last 4 measured weeks, current accent, past accent.soft); Logged · Weigh-ins · Confidence tiles.
struct MaintenanceHero: View {
    var week: Review.Week; var estimates: [WeeklyEstimate]; var onInfo: (() -> Void)? = nil; var note: String? = nil
    var body: some View {
        let bars = Array(estimates.filter { !$0.lowData && $0.weekStart <= week.weekStart.dayKey }.suffix(4))
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(week.measured ? "Maintenance · measured" : "Maintenance · \(week.estimate == nil && week.previous == nil ? "formula" : "estimate")").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(week.maintenance)).font(.yumo.statBig).kerning(-1).tabular().foregroundStyle(Color.yumo.ink); Text("kcal a day").font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted) }
                }
                Spacer()
                if let onInfo { InfoButton(action: onInfo).frame(width: 24, height: 24).padding(.top, -4).padding(.trailing, -6) }
            }
            if let note { Text(note).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).lineSpacing(3).padding(.top, 8).fixedSize(horizontal: false, vertical: true) }
            if bars.count >= 2 { WeeklyBars(values: bars.map { $0.tdeeSmoothed }).padding(.top, 14) }
            HStack(spacing: 10) {
                tile("Logged", "\(week.loggedCount)", "/ 7 days")
                tile("Weigh-ins", "\(week.weighIns)", "/ 7")
                tile("Confidence", week.confidence, nil, accent: true)
            }.padding(.top, 14)
        }.card(padding: EdgeInsets(top: 18, leading: 20, bottom: 20, trailing: 20))
    }
    /// radius.tile 14, padding 10 12: label 12/700 muted; value 17/800 ink + 13/700 muted suffix. Confidence = tint fill, accent.edge value.
    func tile(_ label: String, _ value: String, _ suffix: String?, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted)
            HStack(alignment: .firstTextBaseline, spacing: 3) { Text(value).font(.yumo.title).tabular().foregroundStyle(accent ? Color.yumo.accentEdge : .yumo.ink); if let suffix { Text(suffix).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted) } }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
        .background(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous).fill(accent ? Color.yumo.accentTint : .yumo.bg))
    }
}

/// §6.1 weekly bars: 120 pt chart, up to four bars 44 wide radius 8 evenly spaced, y-range rounded to the hundred (≥ 300 wide), value label 11/800 on a surface backing 16 pt above each bar, "Wk n" 11/700 muted below. Current week accent, past accent.soft.
struct WeeklyBars: View {
    var values: [Double]
    @State private var grown = false
    var body: some View {
        let mn = values.min() ?? 0, mx = values.max() ?? 1
        var lo = floor((mn - 50) / 100) * 100, hi = ceil((mx + 50) / 100) * 100
        if hi - lo < 300 { let pad = (300 - (hi - lo)) / 2; lo -= pad; hi += pad }
        let range = max(1, hi - lo)
        return GeometryReader { g in
            let gap = (g.size.width - 44 * CGFloat(values.count)) / CGFloat(values.count)
            HStack(alignment: .bottom, spacing: gap) {
                ForEach(Array(values.enumerated()), id: \.offset) { i, v in
                    let h = max(4, CGFloat((v - lo) / range) * 90)
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        Text(Fmt.k(v)).font(.yumo.axis).tabular().foregroundStyle(Color.yumo.ink).padding(.horizontal, 3).padding(.vertical, 1).background(RoundedRectangle(cornerRadius: 3).fill(Color.yumo.surface)).padding(.bottom, 4)
                        RoundedRectangle(cornerRadius: Radius.bar, style: .continuous).fill(i == values.count - 1 ? Color.yumo.accent : .yumo.accentSoft).frame(width: 44, height: h).scaleEffect(y: grown ? 1 : 0, anchor: .bottom)
                            .animation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.5).delay(Double(i) * 0.05), value: grown)   // motion.chartIn
                        Text("Wk \(i + 1)").font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted).padding(.top, 6)
                    }.frame(width: 44)
                }
            }.padding(.horizontal, gap / 2).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }.frame(height: 120).onAppear { grown = true }
    }
}

/// §6.2 "This week": Average eaten · Trend change · Maintenance, label 15/700 + sub 12/700 muted, value 17/800 right.
struct ThisWeekCard: View {
    var week: Review.Week; var caption = "This week"
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(caption).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.bottom, 4)
            row("Average eaten", "\(week.loggedCount) logged day\(week.loggedCount == 1 ? "" : "s")", week.loggedCount > 0 ? "\(Fmt.k(week.kcalAvg)) kcal" : "—").hairline()
            row("Trend change", "7-day smoothed", week.trendDelta.map { Fmt.delta($0) } ?? "—").hairline()
            row("Maintenance", "What you ate, plus what came off your body", Fmt.k(week.maintenance))
        }.card(padding: EdgeInsets(top: 16, leading: 20, bottom: 6, trailing: 20))
    }
    func row(_ label: String, _ sub: String, _ value: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) { Text(label).font(.yumo.subtitle).foregroundStyle(Color.yumo.ink); Text(sub).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) }
            Spacer(minLength: 8); Text(value).font(.yumo.title).tabular().foregroundStyle(Color.yumo.ink)
        }.padding(.vertical, 11)
    }
}

/// §6.4 "How it's worked out": four steps, "This week, in numbers", formula footer.
struct HowWorkedOutSheet: View {
    @Environment(\.dismiss) private var dismiss
    var week: Review.Week
    var body: some View {
        let lost = -(week.trendDelta ?? 0)
        let fatWeek = (lost * Calc.kcalPerKg / 100).rounded() * 100, fatDay = (fatWeek / 7).rounded()
        let eaten = week.kcalAvg
        VStack(spacing: 0) {
            SheetHeader(title: "How it's worked out", onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    VStack(spacing: 0) {
                        step(1, "Smooth your weight.", "Daily weigh-ins become a 7-day trend so water weight doesn't move the number.").hairline()
                        step(2, "Add up the week.", "What you ate on average, and how much the trend moved.").hairline()
                        step(3, "Work out maintenance.", "Weight you lost was fat you burned — 1 kg is about 7,700 kcal. What you ate plus what you burned from fat is what you really use in a day.").hairline()
                        step(4, "Propose a target.", "Maintenance minus your pace, every Monday. Never more than 150 kcal a week, only after you say yes.")
                    }.card(padding: EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
                    if week.measured, let e = week.estimate {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("This week, in numbers").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.bottom, 4)
                            row("Eaten", "\(week.loggedCount) logged days", "\(Fmt.k(eaten)) / day").hairline()
                            row(lost >= 0 ? "Lost" : "Gained", "≈ \(Fmt.k(abs(fatWeek))) kcal of body fat, \(Fmt.k(abs(fatDay))) a day", Review.kg2(lost) + " kg").hairline()
                            row("\(Fmt.k(eaten)) \(fatDay >= 0 ? "+" : "−") \(Fmt.k(abs(fatDay)))", week.previous != nil ? "averaged with last week → \(Fmt.k(Calc.round50(e.tdeeSmoothed)))" : "your first measured week", Fmt.k(e.tdeeEst))
                        }.card(padding: EdgeInsets(top: 16, leading: 20, bottom: 6, trailing: 20))
                    }
                    Text("First two weeks use the Mifflin-St Jeor formula while it learns.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 4)
                }.padding(Space.gutter).padding(.bottom, 24)
            }
        }.background(Color.yumo.bg)
    }
    func step(_ n: Int, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(n)").font(.nunito(14, .black)).foregroundStyle(Color.yumo.accent).frame(width: 28, height: 28).background(Circle().fill(Color.yumo.accentTint))
            (Text(title).font(.nunito(15, .extrabold)) + Text(" " + body).font(.nunito(15, .semibold))).foregroundStyle(Color.yumo.ink).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12)
    }
    func row(_ label: String, _ sub: String, _ value: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) { Text(label).font(.yumo.subtitle).tabular().foregroundStyle(Color.yumo.ink); Text(sub).font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted) }
            Spacer(minLength: 8); Text(value).font(.yumo.title).tabular().foregroundStyle(Color.yumo.ink)
        }.padding(.vertical, 11)
    }
}
