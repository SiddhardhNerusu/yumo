import SwiftUI
import SwiftData

struct TodayScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var addMeal: Meal? = nil
    @State private var detail: FoodEntry? = nil
    @State private var entries: [FoodEntry] = []
    @State private var yesterday: [FoodEntry] = []
    @State private var savedByMeal: [Meal: SavedMeal] = [:]
    @State private var targets: Targets? = nil
    @State private var removingIds: Set<String> = []
    @State private var training: Bool? = nil
    @State private var pinnedRow: String? = nil
    @State private var checkin = false
    @State private var balance = false
    @State private var hasHistory = false      // first run (README §1): no "Yesterday's …" rows and no Balance row until a food was logged on a previous day

    var store: Store { Store(ctx) }
    var dayKey: String { session.selectedDate.dayKey }
    var isToday: Bool { Calendar.current.isDateInToday(session.selectedDate) }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack {
                    HStack {
                        ArrowButton(glyph: "‹") { session.selectedDate = session.selectedDate.adding(days: -1) }
                        Spacer()
                        if let tr = training { Button { store.setTraining(dayKey, !tr); reload() } label: { Tag(label: tr ? "Training" : "Rest") }.buttonStyle(PlainPressStyle()).padding(.trailing, 6) }
                        ArrowButton(glyph: "›", disabled: isToday) { session.selectedDate = session.selectedDate.adding(days: 1) }
                    }
                    Text(Fmt.dayTitle(session.selectedDate)).font(.yumo.title).tabular()
                }.frame(height: 44)
                if let t = targets { HeroCard(totals: DayTotals(entries), targets: t, dayKcal: t.kcal(training: training, profile: store.profile()), pinned: pinnedRow, balance: balanceRow, onBalance: { balance = true }).tourAnchor(.hero).padding(.top, 4) }
                VStack(spacing: Space.cardGap) {
                    ForEach(Meal.allCases) { meal in
                        MealCardView(meal: meal, entries: entries.filter { $0.meal == meal && !removingIds.contains($0.id) },
                                     yesterday: hasHistory ? yesterday.filter { $0.meal == meal } : [], saved: savedByMeal[meal],
                                     onAdd: { addMeal = meal; if meal == .breakfast { Tour.shared.didAct(.breakfastAdd) } }, tourAnchor: meal == .breakfast, onOpen: { detail = $0 }, onRemove: remove, onAddYesterday: { addYesterday(meal) }, onSave: { saveMeal(meal) })
                    }
                }.padding(.top, Space.heroGap)
            }
            .padding(.horizontal, Space.gutter).padding(.bottom, Space.bottomClear)
        }
        .scrollIndicators(.hidden)
        .onAppear(perform: reload)
        .onChange(of: session.selectedDate) { reload() }
        .onChange(of: session.tick) { reload() }
        .sheet(item: $addMeal) { m in AddFoodSheet(meal: m, dayKey: dayKey).yumoSheet() }
        .fullScreenCover(item: $detail) { e in FoodDetailScreen(entry: e, dayKey: dayKey) }
        .sheet(isPresented: $checkin) { CheckinSheet().yumoSheet().presentationDetents(Expenditure.stallCheck(store) != nil ? [.large] : [.height(520)]) }
        .sheet(isPresented: $balance) { BalanceSheet(dayKey: dayKey).yumoSheet().presentationDetents([.large]) }
    }
    /// Rev 3 hero row: only when > 150 kcal left and at least one meal is empty (today or a future-less past day is fine; the solver works on any day).
    var balanceRow: String? {
        guard let t = targets else { return nil }
        let left = Double(t.kcal(training: training, profile: store.profile())) - DayTotals(entries).kcal
        let empty = Meal.allCases.filter { m in !entries.contains { $0.meal == m } }
        guard left > 150, !empty.isEmpty, isToday, hasHistory else { return nil }
        return "\(Fmt.k(left)) kcal left · \(empty.map(\.rawValue).joined(separator: ", ")) \(empty.count == 1 ? "is" : "are") empty"
    }

    func reload() {
        let s = store
        entries = s.entries(dayKey)
        yesterday = s.entries(session.selectedDate.adding(days: -1).dayKey)
        targets = s.targets()
        training = s.isTraining(dayKey)
        let p = s.profile()
        if p.showNutrientsOnToday, !p.pinnedNutrients.isEmpty, let t = targets {
            pinnedRow = p.pinnedNutrients.compactMap { key -> String? in
                guard let n = Nutrients.by(key) else { return nil }
                let v = entries.compactMap { $0.micro(key) }.reduce(0, +)
                let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
                let g = goal ?? ul
                return "\(n.name.components(separatedBy: " (").first ?? n.name) \(Nutrients.format(v, unit: n.unit))\(g.map { " / \(Nutrients.format($0, unit: n.unit))" } ?? "") \(n.unit)"
            }.joined(separator: " · ")
        } else { pinnedRow = nil }
        hasHistory = s.hasHistory(before: Date().dayKey)
        if Calendar.current.isDateInToday(session.selectedDate), !Tour.shared.active, Expenditure.checkinDue(p) || Expenditure.stallCheck(s) != nil { checkin = true }
        var map: [Meal: SavedMeal] = [:]
        for m in Meal.allCases { if let sm = s.savedMeal(matching: entries.filter { $0.meal == m }) { map[m] = sm } }
        savedByMeal = map
        let totals = DayTotals(entries), day = session.selectedDate
        Task { await HealthSync.writeDay(totals, date: day) }
    }
    func remove(_ e: FoodEntry) {
        removingIds.insert(e.id)
        let name = e.foodName
        Task { try? await Task.sleep(for: .milliseconds(320)); store.remove(e); removingIds.remove(e.id); toaster.show("Removed \(name)"); session.changed() }
    }
    func addYesterday(_ meal: Meal) {
        for e in yesterday where e.meal == meal { if let f = e.food { _ = store.log(food: f, meal: meal, dayKey: dayKey, quantity: e.quantity, serving: Serving(label: e.servingLabel, grams: e.servingGrams)) } }
        toaster.show("Yesterday's \(meal.rawValue) added"); session.changed()
    }
    func saveMeal(_ meal: Meal) {
        let wd = DateFormatter(); wd.locale = Locale(identifier: "en_GB"); wd.dateFormat = "EEE"
        let name = "\(meal.rawValue) · \(wd.string(from: session.selectedDate))"
        _ = store.saveMeal(name: name, meal: meal, entries: entries.filter { $0.meal == meal })
        toaster.show("Saved as \"\(name)\""); session.changed()
    }
}

extension Meal: Hashable {}

struct HeroCard: View {
    var totals: DayTotals; var targets: Targets; var dayKcal: Int? = nil; var pinned: String? = nil
    var balance: String? = nil; var onBalance: () -> Void = {}
    var goal: Int { dayKcal ?? targets.kcal }
    var over: Bool { totals.kcal > Double(goal) }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(Fmt.k(totals.kcal)).font(.yumo.hero).kerning(-2).tabular().foregroundStyle(over ? Color.yumo.danger : .yumo.ink)
                Text("/ \(Fmt.k(goal))").font(.yumo.displayMuted).tabular().foregroundStyle(Color.yumo.inkMuted)
            }
            Bar(fraction: totals.kcal / Double(max(1, goal)), height: 10, fill: over ? .yumo.danger : .yumo.accent).padding(.top, Space.gridGap)
            HStack(spacing: Space.gridGap) {
                stat("Protein", totals.p, targets.protein); stat("Carbs", totals.c, dayKcal.map { Calc.carbsFor(kcal: $0, protein: targets.protein, fat: targets.fat) } ?? targets.carbs); stat("Fat", totals.f, targets.fat)
            }.padding(.top, Space.gridGap)
            if let pinned { Text(pinned).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1).padding(.top, 12) }
            if let balance {
                Rectangle().fill(Color.yumo.hairline).frame(height: 1).padding(.top, 14)
                Button(action: onBalance) {
                    HStack(spacing: 8) {
                        Text(balance).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
                        Spacer(minLength: 8)
                        HStack(spacing: 3) { Text("Balance the day"); Text("›") }.font(.nunito(14, .extrabold)).foregroundStyle(Color.yumo.accent)
                    }.padding(.top, 12).contentShape(Rectangle())
                }.buttonStyle(PlainPressStyle())
            }
        }
        .card(padding: EdgeInsets(top: 18, leading: 20, bottom: 16, trailing: 20))
    }
    func stat(_ label: String, _ v: Double, _ goal: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.yumo.captionLight).foregroundStyle(Color.yumo.inkMuted)
            HStack(alignment: .firstTextBaseline, spacing: 0) { Text(Fmt.g(v)).font(.yumo.stat).tabular(); Text(" / \(goal) g").font(.nunito(13, .semibold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
            Bar(fraction: v / Double(max(1, goal)), height: 5, fill: .yumo.ink).padding(.top, 6)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MealCardView: View {
    var meal: Meal; var entries: [FoodEntry]; var yesterday: [FoodEntry]; var saved: SavedMeal?
    var onAdd: () -> Void; var tourAnchor = false; var onOpen: (FoodEntry) -> Void; var onRemove: (FoodEntry) -> Void; var onAddYesterday: () -> Void; var onSave: () -> Void
    var totals: DayTotals { DayTotals(entries) }
    @ViewBuilder var chip: some View { if tourAnchor { AddChip(action: onAdd).tourAnchor(.breakfastAdd) } else { AddChip(action: onAdd) } }
    var body: some View {
        VStack(spacing: 0) {
            if entries.isEmpty {
                HStack { Text(meal.rawValue).font(.yumo.title); Spacer(); chip }
                    .padding(.vertical, 9).padding(.trailing, 12)
                if !yesterday.isEmpty { SwipeToAddRow(label: "Yesterday's \(meal.rawValue)", count: yesterday.count, kcal: DayTotals(yesterday).kcal, onCommit: onAddYesterday).padding(.leading, -Space.cardPad) }
            } else {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(meal.rawValue).font(.yumo.title); Text("\(Fmt.k(totals.kcal)) kcal").font(.yumo.bodyStrong).tabular().foregroundStyle(Color.yumo.inkMuted); if let s = saved { Tag(label: s.name) } }
                        Text("P \(Fmt.g(totals.p)) · C \(Fmt.g(totals.c)) · F \(Fmt.g(totals.f))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                    }
                    Spacer(); chip
                }.padding(.top, 9).padding(.bottom, 8).padding(.trailing, 12).hairline()
                ForEach(Array(entries.enumerated()), id: \.element.id) { i, e in FoodRowView(entry: e, last: i == entries.count - 1 && saved != nil, onOpen: { onOpen(e) }, onRemove: { onRemove(e) }).padding(.leading, -Space.cardPad) }
                if saved == nil { HStack { TextAction(label: "Save as meal", action: onSave); Spacer() }.padding(.vertical, Space.rowFooter) }
            }
        }
        .padding(.leading, Space.cardPad).listCard()
    }
}

/// Swipe left to reveal "Remove" (opacity = |dx|/80); release past −110 → slide to −420 over 320 ms, then delete. Tap opens.
struct FoodRowView: View {
    var entry: FoodEntry; var last = false; var onOpen: () -> Void; var onRemove: () -> Void
    @State private var dx: CGFloat = 0
    @State private var committed = false
    var body: some View {
        ZStack(alignment: .trailing) {
            Rectangle().fill(Color.yumo.danger).overlay(alignment: .trailing) { Text("Remove").font(.yumo.action).foregroundStyle(.white).padding(.trailing, 20) }.opacity(min(1, abs(dx) / 80))
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    (Text(entry.foodName).font(.yumo.body) + Text("  " + entry.amountLabel).font(.yumo.detail).foregroundColor(.yumo.inkMuted)).lineLimit(1)
                    Text(entry.food?.macrosUnknown == true ? "P — · C — · F —" : "P \(Fmt.g(entry.p)) · C \(Fmt.g(entry.c)) · F \(Fmt.g(entry.f))").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
                }
                Spacer(); Text(Fmt.k(entry.kcal)).font(.yumo.body).tabular()
            }
            .padding(.vertical, Space.rowFood).padding(.horizontal, Space.cardPad).background(Color.yumo.surface).contentShape(Rectangle())
            .offset(x: dx)
            .onTapGesture { if !committed { onOpen() } }
            .gesture(DragGesture(minimumDistance: 8).onChanged { v in if v.translation.width < 0 { dx = v.translation.width } }
                .onEnded { v in
                    if v.translation.width < -110 { committed = true; withAnimation(Motion.remove) { dx = -420 }; onRemove() }
                    else { withAnimation(Motion.snap) { dx = 0 } }
                })
        }
        .clipped().overlay(alignment: .bottom) { if !last { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) } }
    }
}

/// Drag right; a wash fills the revealed width with "Add" → "Release to add" past 40%. Release ≥ 40% commits.
struct SwipeToAddRow: View {
    var label: String; var count: Int; var kcal: Double; var onCommit: () -> Void
    @State private var dx: CGFloat = 0
    var body: some View {
        GeometryReader { g in
            let w = g.size.width; let past = dx >= w * 0.4
            ZStack(alignment: .leading) {
                LinearGradient(colors: [.yumo.accent, .yumo.accentWash], startPoint: .leading, endPoint: .trailing).frame(width: max(0, dx))
                    .overlay { Text(past ? "Release to add" : "Add").font(.nunito(15, .black)).foregroundStyle(.white).frame(width: max(0, dx)).clipped() }
                HStack { (Text(label).font(.nunito(16, .bold)) + Text("  \(count) foods").font(.yumo.detail).foregroundColor(.yumo.inkMuted)); Spacer(); Text(Fmt.k(kcal)).font(.nunito(16, .extrabold)).tabular() }
                    .padding(.horizontal, Space.cardPad).frame(height: 52).frame(maxWidth: .infinity).background(Color.yumo.surface).offset(x: dx)
                    .gesture(DragGesture(minimumDistance: 8).onChanged { v in if v.translation.width > 0 { dx = v.translation.width } }
                        .onEnded { _ in if dx >= w * 0.4 { withAnimation(Motion.add) { dx = w }; Task { try? await Task.sleep(for: .milliseconds(300)); onCommit() } } else { withAnimation(Motion.snap) { dx = 0 } } })
            }
        }.frame(height: 52).clipped()
    }
}
