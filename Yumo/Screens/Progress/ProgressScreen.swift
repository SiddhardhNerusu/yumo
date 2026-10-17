import SwiftUI
import SwiftData

enum ChartRange: String, CaseIterable { case w = "1W", m = "1M", m3 = "3M", all = "All"
    var days: Int? { switch self { case .w: 7; case .m: 30; case .m3: 90; case .all: nil } }
    var label: String { switch self { case .w: "this week"; case .m: "this month"; case .m3: "3 months"; case .all: "all time" } }
}

struct ProgressScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(Session.self) private var session
    @State private var range: ChartRange = .m
    @State private var weights: [WeightEntry] = []
    @State private var logSheet: DayKey? = nil
    @State private var showLog = false
    @State private var showSettings = false
    @State private var days: [(String, Double, Bool)] = []
    @State private var targetKcal = 2400
    @State private var estimates: [WeeklyEstimate] = []
    @State private var showHow = false
    @State private var showNutrients = false
    @State private var checkin = false
    var store: Store { Store(ctx) }
    var profile: UserProfile { store.profile() }
    var lb: Bool { profile.weightUnitLb }
    func disp(_ kg: Double) -> Double { lb ? kg * 2.20462 : kg }
    var unit: String { lb ? "lb" : "kg" }

    var inRange: [WeightEntry] {
        guard let d = range.days else { return weights.reversed() }
        let cutoff = Date().adding(days: -d).dayKey
        return weights.filter { $0.dayKey >= cutoff }.reversed()
    }
    var delta: Double? { let r = inRange; guard let f = r.first, let l = r.last, r.count > 1 else { return nil }; return l.kg - f.kg }
    /// EMA trend (α 0.1) aligned to the points in range; drawn as the primary line once ≥ 7 entries exist (PRODUCT_BRIEF §3.1).
    var movingAverage: [Double?] { weights.count >= 7 ? inRange.map { $0.trendKg.map(disp) } : [] }
    var todayEntry: WeightEntry? { weights.first { $0.dayKey == Date().dayKey } }

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(spacing: Space.cardGap) {
                HStack { Text("Progress").font(.yumo.display).kerning(-0.4); Spacer(); CogButton { showSettings = true } }.frame(height: 56).id("top")
                weightCard.tourAnchor(.weightCard).id(Tour.Anchor.weightCard)
                expenditureCard.tourAnchor(.maintenanceCard).id(Tour.Anchor.maintenanceCard)
                caloriesCard.tourAnchor(.caloriesCard).id(Tour.Anchor.caloriesCard)
                nutrientsRow.tourAnchor(.nutrientsRow).id(Tour.Anchor.nutrientsRow)
            }.padding(.horizontal, Space.gutter).padding(.bottom, Space.bottomClear)
        }
        .onChange(of: Tour.shared.step) { scrollForTour(proxy) }
        .onChange(of: Tour.shared.active) { if Tour.shared.active { scrollForTour(proxy) } }
        .onAppear { Task { try? await Task.sleep(for: .milliseconds(350)); scrollForTour(proxy) } }
        }
        .scrollIndicators(.hidden)
        .onAppear(perform: reload).onChange(of: session.tick) { reload() }
        .onChange(of: Tour.shared.active) { if !Tour.shared.active { reload() } }
        .sheet(item: $logSheet) { k in LogWeightSheet(dayKey: k.id).yumoSheet() }
        .fullScreenCover(isPresented: $showLog) { WeightLogScreen() }
        .fullScreenCover(isPresented: $showSettings) { SettingsScreen() }
        .fullScreenCover(isPresented: $showHow) { HowThisWorksScreen() }
        .fullScreenCover(isPresented: $showNutrients) { ProgressNutrientsScreen() }
        .sheet(isPresented: $checkin) { CheckinSheet().yumoSheet().presentationDetents([.height(520)]) }
    }
    // MARK: Expenditure card (PRODUCT_BRIEF §3)
    var expenditureCard: some View {
        let p = store.profile(); let t = store.targets()
        let formula = Calc.round50(t.tdee)
        let last = estimates.last
        return Button { showHow = true } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Maintenance · measured").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                        HStack(alignment: .firstTextBaseline, spacing: 4) { Text(Fmt.k(p.tdeeMeasured.map { Double(Calc.round50($0)) } ?? Double(formula))).font(.yumo.bigStat).kerning(-0.4).tabular(); Text("kcal").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 6) {
                        if p.weeklyUpdates < 3 { Tag(label: "Estimate") } else if last?.lowData == true { Text("Low data").font(.yumo.tag).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 7).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: Radius.tag).fill(Color.yumo.control)) }
                        if estimates.filter({ !$0.lowData }).count >= 2 { Sparkline(values: estimates.filter { !$0.lowData }.suffix(6).map(\.tdeeSmoothed)) }
                    }
                }
                Text(p.tdeeMeasured != nil ? "from \(p.weeklyUpdates) week\(p.weeklyUpdates == 1 ? "" : "s") of logging · formula said \(Fmt.k(formula))" : "\(t.formula) × \(p.activity.rawValue.formatted()) · measured after your first full week").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
            }.foregroundStyle(Color.yumo.ink).frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 18, leading: 20, bottom: 16, trailing: 20))
        }.buttonStyle(PlainPressStyle())
    }
    var nutrientsRow: some View {
        Button { showNutrients = true } label: {
            HStack { Text("Nutrients").font(.yumo.title); Spacer(); Text("Fibre, sodium, iron + \(Nutrients.all.count - 3) more").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted); Text("›").font(.yumo.title).foregroundStyle(Color.yumo.inkMuted) }
                .foregroundStyle(Color.yumo.ink).frame(height: 52).padding(.horizontal, Space.cardPad).background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).lifted()
        }.buttonStyle(PlainPressStyle())
    }
    /// The tour scrolls each target into view (README §15: the Weight card to the top, the rest centred) — the scrim blocks user scrolling.
    func scrollForTour(_ proxy: ScrollViewProxy) {
        let t = Tour.shared; guard t.active else { return }
        withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.45)) {
            switch t.step { case 7: proxy.scrollTo("top", anchor: .top); case 8: proxy.scrollTo(Tour.Anchor.maintenanceCard, anchor: .center); case 9: proxy.scrollTo(Tour.Anchor.caloriesCard, anchor: .center); case 10: proxy.scrollTo(Tour.Anchor.nutrientsRow, anchor: UnitPoint(x: 0.5, y: 0.6)); default: break }
        }
    }
    func reload() {
        let s = store; weights = s.weights(); targetKcal = s.targets().kcal; estimates = s.weeklyEstimates()
        let wd = DateFormatter(); wd.locale = Locale(identifier: "en_GB"); wd.dateFormat = "EEE"
        days = (0..<7).reversed().map { i in let d = Date().adding(days: -i); return (wd.string(from: d), DayTotals(s.entries(d.dayKey)).kcal, i == 0) }
    }

    var weightCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Weight").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    HStack(alignment: .firstTextBaseline, spacing: 4) { Text(weights.first.map { Fmt.kg(disp($0.kg)) } ?? "–").font(.yumo.statBig).tabular(); Text(unit).font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    TextAction(label: "See all ›") { showLog = true }
                    if let d = delta { (Text("\(range.label) ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(Fmt.delta(disp(d), unit: unit)).font(.yumo.caption).foregroundColor(d < 0 ? .yumo.accent : d > 0 ? .yumo.danger : .yumo.inkMuted)) }
                }
            }
            Segmented(options: ChartRange.allCases.map { ($0, $0.rawValue) }, selection: $range).padding(.top, 14)
            LineChart(points: inRange.map { ($0.date, disp($0.kg)) }, range: range, unit: unit, average: movingAverage).frame(height: 150).padding(.top, 18)
            Text(weights.count <= 1 ? "Your setup weight. The trend starts with your first weigh-in." : weights.count >= 7 ? "Line = 7-day trend · dots = weigh-ins · hold to read a point" : "Hold on the chart to read a point").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity).padding(.top, 8)
            PrimaryButton(label: todayEntry.map { "Edit today · \(Fmt.kg(disp($0.kg))) \(unit)" } ?? (weights.count <= 1 ? "Log your first weight" : "Log today's weight")) { logSheet = DayKey(id: Date().dayKey) }.padding(.top, 14)
        }.card(padding: EdgeInsets(top: 18, leading: 20, bottom: 20, trailing: 20))
    }

    var caloriesCard: some View {
        let logged = days.filter { !$0.2 && $0.1 > 0 }
        let avg = logged.isEmpty ? 0 : logged.map(\.1).reduce(0, +) / Double(logged.count)
        let hit = logged.filter { abs($0.1 - Double(targetKcal)) <= Double(targetKcal) * 0.05 }.count
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Calories · last 7 days").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(avg)).font(.nunito(32, .extrabold)).tabular(); Text("avg / \(Fmt.k(targetKcal))").font(.nunito(15, .semibold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                }
                Spacer(); Text(logged.isEmpty ? "Day 1" : "\(hit) / \(logged.count) days on target").font(.yumo.action).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.top, 2)
            }
            if logged.isEmpty && (days.last?.1 ?? 0) == 0 {
                VStack(spacing: 10) {
                    Text("Your week fills in here.").font(.yumo.subtitle)
                    Button { session.tab = .today } label: { Text("Log today's first meal ›").font(.nunito(14, .extrabold)).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle())
                }.frame(maxWidth: .infinity).frame(height: 130).overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 2) }.overlay(alignment: .bottom) { Rectangle().fill(Color.yumo.hairline).frame(height: 2) }.padding(.top, 16)
            } else { BarRow(days: days).padding(.top, 16) }
        }.card(padding: EdgeInsets(top: 18, leading: 20, bottom: 16, trailing: 20))
    }
}

struct DayKey: Identifiable { var id: String }

/// 3 grid lines, right-aligned labels (34pt column), accent line through every point, ink-outlined dots, scrub with dashed guide + tooltip.
struct LineChart: View {
    var points: [(Date, Double)]; var range: ChartRange; var unit: String; var average: [Double?] = []
    @State private var scrub: Int? = nil
    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { g in
                let W = g.size.width - 34, H = g.size.height
                let vals = points.map(\.1)
                let lo = (vals.min() ?? 80) - 0.3, hi = (vals.max() ?? 90) + 0.3
                let x: (Int) -> CGFloat = { i in points.count < 2 ? W / 2 : 6 + CGFloat(i) * (W - 12) / CGFloat(points.count - 1) }
                let y: (Double) -> CGFloat = { v in hi == lo ? H / 2 : 10 + CGFloat((hi - v) / (hi - lo)) * (H - 20) }
                ZStack(alignment: .topLeading) {
                    ForEach([hi, (hi + lo) / 2, lo], id: \.self) { v in
                        Path { p in p.move(to: CGPoint(x: 0, y: y(v))); p.addLine(to: CGPoint(x: W, y: y(v))) }.stroke(Color.yumo.track, lineWidth: 1)
                        Text(String(format: "%.1f", v)).font(.yumo.axis).tabular().foregroundStyle(Color.yumo.inkMuted).frame(width: 34, alignment: .trailing).position(x: W + 17, y: y(v))
                    }
                    let trend = average.count == points.count && points.count > 1
                    if trend {
                        Path { p in var started = false; for (i, a) in average.enumerated() { guard let a else { continue }; let c = CGPoint(x: x(i), y: y(a)); if started { p.addLine(to: c) } else { p.move(to: c); started = true } } }
                            .stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    } else if points.count > 1 {
                        Path { p in for (i, pt) in points.enumerated() { let c = CGPoint(x: x(i), y: y(pt.1)); i == 0 ? p.move(to: c) : p.addLine(to: c) } }
                            .stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    }
                    ForEach(points.indices, id: \.self) { i in
                        Circle().fill(Color.yumo.surface).stroke(Color.yumo.ink, lineWidth: 2).frame(width: 6, height: 6).position(x: x(i), y: y(points[i].1))
                    }
                    if let s = scrub, points.indices.contains(s) {
                        Path { p in p.move(to: CGPoint(x: x(s), y: -6)); p.addLine(to: CGPoint(x: x(s), y: H)) }.stroke(Color.yumo.ink, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                        Circle().fill(Color.yumo.accent).stroke(Color.white, lineWidth: 3).frame(width: 12, height: 12).position(x: x(s), y: y(points[s].1))
                        Text("\(Fmt.kg(points[s].1)) \(unit) · \(Fmt.dayFormatter.string(from: points[s].0))").font(.yumo.footnote).tabular().foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.yumo.ink)).fixedSize()
                            .position(x: min(max(70, x(s)), W - 70), y: -14)
                    }
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { v in guard points.count > 0 else { return }; let i = points.indices.min { abs(x($0) - v.location.x) < abs(x($1) - v.location.x) }; scrub = i }.onEnded { _ in scrub = nil })
            }
            HStack { ForEach(ticks, id: \.self) { t in Text(t); if t != ticks.last { Spacer() } } }.font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted).padding(.trailing, 34)
        }
    }
    var ticks: [String] {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_GB")
        let today = Date().startOfDay
        switch range {
        case .w: f.dateFormat = "EEE"; return (1...6).reversed().map { f.string(from: today.adding(days: -$0)) } + ["Today"]
        case .m: f.dateFormat = "d MMM"; return [30, 23, 16, 9].map { f.string(from: today.adding(days: -$0)) } + ["Today"]
        case .m3: f.dateFormat = "d MMM"; return [90, 62, 34].map { f.string(from: today.adding(days: -$0)) } + ["Today"]
        case .all: f.dateFormat = "d MMM yy"; guard let first = points.first?.0 else { return ["Today"] }; return [f.string(from: first), "Today"]
        }
    }
}

/// 7 bars, value above each (today's ink), past days accent-soft, today accent, 8pt top radius. No goal line.
struct BarRow: View {
    var days: [(String, Double, Bool)]
    var body: some View {
        let mx = max(1, days.map(\.1).max() ?? 1)
        VStack(spacing: 6) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                    VStack(spacing: 4) {
                        Text(d.1 > 0 ? Fmt.k(d.1) : "–").font(.yumo.axis).tabular().foregroundStyle(d.2 ? Color.yumo.ink : .yumo.inkMuted)
                        UnevenRoundedRectangle(topLeadingRadius: Radius.bar, topTrailingRadius: Radius.bar).fill(d.2 ? Color.yumo.accent : .yumo.accentSoft).frame(height: max(4, 72 * d.1 / mx)).animation(Motion.bar, value: d.1)
                    }.frame(maxWidth: .infinity)
                }
            }.frame(height: 96, alignment: .bottom)
            HStack(spacing: 8) { ForEach(Array(days.enumerated()), id: \.offset) { _, d in Text(d.0).font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity) } }
        }
    }
}
