import SwiftUI
import SwiftData

/// Progress › Nutrients: 7- or 30-day averages vs DRI targets. Danger only over a UL or under 50 % of RDA for the whole window.
struct ProgressNutrientsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    @State private var window = 7
    @State private var tick = 0
    @State private var open: String? = nil
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
                let all = rows, pinnedKeys = p.pinnedNutrients
                let pinned = all.filter { pinnedKeys.contains($0.n.key) }, rest = all.filter { !pinnedKeys.contains($0.n.key) }
                VStack(alignment: .leading, spacing: 12) {
                    if !pinned.isEmpty { VStack(alignment: .leading, spacing: 0) { Overline(text: "Pinned to Today").padding(.top, 10).padding(.bottom, 2); ForEach(pinned) { r in nutrientRow(r, p) } }.padding(.leading, Space.cardPad).listCard() }
                    VStack(spacing: 0) { ForEach(rest) { r in nutrientRow(r, p) } }.padding(.leading, Space.cardPad).listCard()
                    Text("Tap any nutrient for what it does, how to fix it and the best foods.\nTargets: NIH DRI for \(p.sex == .male ? "male" : "female"), \(p.age) · edit in Settings › Nutrients\nRed only when over a limit or under half the target all week").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 4)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }.id(tick).background(Color.yumo.bg.ignoresSafeArea())
    }
    /// One nutrient: name · avg of target · % · bar; tap unfolds (motion.expand) what it does, how to fix it and the best sources.
    @ViewBuilder func nutrientRow(_ r: Row, _ p: UserProfile) -> some View {
        let ref = r.goal ?? r.ul
        let pct = (r.avg != nil && ref != nil && ref! > 0) ? r.avg! / ref! : nil
        let limit = r.goal == nil && r.ul != nil
        let danger = (r.avg != nil && r.ul != nil && r.avg! > r.ul!) || (pct != nil && r.goal != nil && pct! < 0.5 && r.daysWithData >= min(window, 7))
        let low = !limit && (pct ?? 1) < 1
        let info = NutInfo.info(r.n.key)
        let isOpen = open == r.n.key
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(Motion.expand) { open = isOpen ? nil : r.n.key } } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.n.name).font(.yumo.bodyStrong).foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                            Text(r.avg.map { "avg \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)" + (ref.map { " of \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)\(limit ? " limit" : "")" } ?? "") + " · \(r.daysWithData) of \(window) days had data" } ?? "— · no data yet").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                        }
                        Spacer()
                        Text(pct.map { "\(Int(($0 * 100).rounded())) %" } ?? "—").font(.yumo.title).tabular().foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                        ExpandChevron(open: isOpen)
                    }
                    if let pct { Bar(fraction: min(1, pct), height: 5, fill: danger ? .yumo.danger : .yumo.ink) }
                }.padding(.vertical, 10).padding(.trailing, Space.cardPad).contentShape(Rectangle())
            }.buttonStyle(PlainPressStyle())
            Expandable(open: isOpen) {
                let gap = (r.goal != nil && r.avg != nil) ? r.goal! - r.avg! : nil
                let remedy: String = limit ? (danger ? (info?.over ?? "Cut the highest source on the right.") : "Under the limit. Nothing to change.") : ((pct ?? 0) >= 1 ? "On target. Keep doing what you're doing." : (info?.low ?? (gap.map { "About \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit) a day short. Any one food on the right closes most of it." } ?? "No data yet — log a few days first.")))
                VStack(alignment: .leading, spacing: 2) {
                    if let why = info?.why { Text(why).font(.nunito(13, .semibold)).foregroundStyle(Color.yumo.ink).lineSpacing(3).fixedSize(horizontal: false, vertical: true) }
                    Text(limit ? (danger ? "Over the limit" : "Within limit") : ((pct ?? 0) >= 1 ? "On target" : "To fix it")).font(.yumo.overline).kerning(0.6).textCase(.uppercase).foregroundStyle(danger ? Color.yumo.danger : low ? .yumo.ink : .yumo.inkMuted).padding(.top, 10)
                    Text(remedy).font(.yumo.caption).foregroundStyle(danger ? Color.yumo.danger : low ? .yumo.ink : .yumo.inkMuted).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
                    if let foods = info?.foods, !foods.isEmpty {
                        Text(limit ? "Your biggest sources" : "Best sources").font(.yumo.overline).kerning(0.6).textCase(.uppercase).foregroundStyle(Color.yumo.inkMuted).padding(.top, 10)
                        ForEach(foods.indices, id: \.self) { i in HStack(alignment: .firstTextBaseline) { Text(foods[i].0).font(.nunito(14, .bold)) + Text("  \(foods[i].1)").font(.nunito(13, .semibold)).foregroundColor(.yumo.inkMuted); Spacer(); Text(foods[i].2).font(.nunito(14, .extrabold)).tabular() }.padding(.vertical, 6) }
                    }
                }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.yumo.bg)).padding(.trailing, Space.cardPad).padding(.bottom, 12)
            }
        }
        .hairline()
        .contextMenu {
            if p.pinnedNutrients.contains(r.n.key) { Button("Unpin") { p.pinnedNutrients.removeAll { $0 == r.n.key }; store.save(); toaster.show("Unpinned \(r.n.name)"); tick += 1 } }
            else if p.pinnedNutrients.count < 3 { Button("Pin to Today") { p.pinnedNutrients.append(r.n.key); p.showNutrientsOnToday = true; store.save(); toaster.show("Pinned \(r.n.name)"); tick += 1 } }
        }
    }
}

/// Weekly check-in (PRODUCT_BRIEF §3 UI): one sheet, two cards, Apply / Keep.
struct CheckinSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var showHow = false
    @State private var showWhy = false
    @State private var choice: Expenditure.StallChoice = .dietBreak
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile()
        let e = store.weeklyEstimates().first { $0.weekStart == p.pendingWeek }
        let stall = Expenditure.stallCheck(store)
        VStack(spacing: 0) {
            SheetHeader(title: "Your week", onClose: { if stall != nil { Expenditure.applyStall(store, choice: nil) } else { Expenditure.apply(store, accept: false) }; dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            ScrollView { VStack(spacing: Space.cardGap) {
                if let st = stall { stallBody(st, p) }
                else if let e, !e.lowData {
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
                if stall == nil { TextAction(label: "How this works") { showHow = true } }
            }.padding(Space.gutter).padding(.bottom, 24) }
        }
        .background(Color.yumo.bg)
        .fullScreenCover(isPresented: $showHow) { HowThisWorksScreen() }
        .sheet(isPresented: $showWhy) { WhyThreeSheet().yumoSheet().presentationDetents([.medium]) }
    }
    /// Stall variant (README §7b, PRODUCT_BRIEF §13): three selectable tiles, button label follows the selection, never auto-applies.
    @ViewBuilder func stallBody(_ st: Expenditure.Stall, _ p: UserProfile) -> some View {
        let target = store.targets().kcal
        let last = store.weeklyEstimates().filter { !$0.lowData }.last
        ListCard {
            SettingsRow(label: "Trend") { HStack(spacing: 6) { Text(Fmt.delta(last?.trendDeltaKg ?? 0)).font(.yumo.title).tabular(); Text("flat \(st.weeksFlat) weeks running").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) } }.hairline()
            SettingsRow(label: "Logged") { VStack(alignment: .trailing, spacing: 1) { Text("\(st.loggedDays) of \(st.totalDays) days").font(.yumo.title).tabular(); Text("within \(Int(st.withinPct.rounded())) % of target").font(.yumo.caption).foregroundStyle(Color.yumo.accent) } }.hairline()
            SettingsRow(label: "Cutting for") { Text("\(st.cutWeeks) weeks").font(.yumo.title).tabular() }
        }
        VStack(alignment: .leading, spacing: 10) {
            Text("Looks like a stall").font(.yumo.title)
            Text("Three flat weeks while you logged this consistently points to adaptation and water retention, not a wrong target. A short break at maintenance usually shows the real trend; cutting further rarely does.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).fixedSize(horizontal: false, vertical: true)
            OptionTile(title: "Diet break · 2 weeks at \(Fmt.k(st.maintenance))", body_: "Eat at your measured maintenance for 14 days, then resume. Water drops first, so the scale may rise then fall.", selected: choice == .dietBreak) { choice = .dietBreak }
            OptionTile(title: "Hold at \(Fmt.k(target)) · 1 more week", body_: "Nothing changes. Ask again next week with one more week of data.", selected: choice == .hold) { choice = .hold }
            OptionTile(title: "Lower to \(Fmt.k(target - 100))", body_: "A small cut. Only if you are sure logging has been complete.", selected: choice == .lower) { choice = .lower }
        }.frame(maxWidth: .infinity, alignment: .leading).card()
        PrimaryButton(label: choice == .dietBreak ? "Start the diet break" : (choice == .hold ? "Hold for a week" : "Lower to \(Fmt.k(target - 100))")) {
            Expenditure.applyStall(store, choice: choice)
            toaster.show(choice == .dietBreak ? "Diet break until \(Fmt.dayTitle(Date().adding(days: 14)))" : (choice == .hold ? "Holding \(Fmt.k(target))" : "Target \(Fmt.k(target - 100))")); session.changed(); dismiss()
        }
        SecondaryButton(label: "Decide later", size: .regular) { Expenditure.applyStall(store, choice: nil); dismiss() }
        TextAction(label: "Why these three") { showWhy = true }
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


struct WhyThreeSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Why these three", onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            VStack(alignment: .leading, spacing: 12) {
                Text("Measured maintenance says what you burn. It does not say what to do when the trend is flat for three weeks despite adherence.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                Text("Diet break").font(.yumo.title); Text("Two weeks at maintenance lets water and stress hormones settle. If the trend was masked, it shows; if the target was right, you lose nothing but two weeks.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                Text("Hold").font(.yumo.title); Text("One more week of data costs little and often resolves a water-retention week on its own.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                Text("Lower by 100").font(.yumo.title); Text("The smallest meaningful cut. Picked only if you are confident every day was logged completely.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                Text("Nothing here is applied automatically. When in doubt the app stays silent.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted)
            }.fixedSize(horizontal: false, vertical: true).padding(Space.gutter)
            Spacer()
        }.background(Color.yumo.bg)
    }
}
