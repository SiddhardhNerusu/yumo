import SwiftUI
import SwiftData

struct TodayScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var addMeal: Meal? = nil
    @State private var detail: FoodEntry? = nil
    @State private var entries: [FoodEntry] = []
    @State private var recent: [Meal: (entries: [FoodEntry], daysAgo: Int)] = [:]
    @State private var savedByMeal: [Meal: SavedMeal] = [:]
    @State private var targets: Targets? = nil
    @State private var removingIds: Set<String> = []
    @State private var pinnedRow: String? = nil
    @State private var reviewPending = false
    @State private var balance = false
    @State private var scrolled: CGFloat = 0
    @State private var headerBase: CGFloat? = nil          // motion.titleCollapse: how far the content has scrolled under the inline bar
    @State private var dayLayer = Date().startOfDay.dayKey   // motion.dayChange: the title + hero + meal cards re-enter as one layer
    @State private var dayForward = true
    @Environment(SwipeCoordinator.self) private var swipes
    @State private var hasHistory = false      // first run (README §1): no "Yesterday's …" rows and no Balance row until a food was logged on a previous day
    @State private var calendarOpen = false
    @State private var loggedWeek: Set<String> = []
    @State private var loggedMonth: Set<String> = []
    @State private var streak = 0
    @State private var hasStaples = false
    @State private var staplesOpen = false
    @State private var hadLoaded = false

    var store: Store { Store(ctx) }
    var dayKey: String { session.selectedDate.dayKey }
    var isToday: Bool { Calendar.current.isDateInToday(session.selectedDate) }

    var body: some View {
        let t = min(1, max(0, (scrolled - 8) / 44))   // motion.titleCollapse: linear with scroll across 8 → 52 pt
        ZStack(alignment: .top) {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(spacing: 0) {
                // rev 5 header: "Today ▾" + the right slot (rev 10 §4.2: review chip › streak pill ≥ 2 › nothing); week strip
                HStack(alignment: .center) {
                    Button { withAnimation(Motion.expand) { calendarOpen.toggle() } } label: {
                        HStack(spacing: 8) { Text(Fmt.dayTitle(session.selectedDate)).font(.yumo.display).kerning(-0.4).tabular().foregroundStyle(Color.yumo.ink); Text("▾").font(.nunito(18, .extrabold)).foregroundStyle(Color.yumo.accent).rotationEffect(.degrees(calendarOpen ? 180 : 0)) }.frame(height: 44)
                            .id(dayLayer).transition(dayTransition)
                    }.buttonStyle(PlainPressStyle()).opacity(1 - t).offset(y: -8 * t)
                    Spacer()
                    if reviewPending { ReviewChip { session.showReview = true }.transition(.opacity.combined(with: .offset(y: 8))) }   // motion.rowIn
                    else if streak >= 2 { StreakPill(count: streak).id(streak).transition(.asymmetric(insertion: .modifier(active: FlipIn(angle: 90), identity: FlipIn(angle: 0)), removal: .opacity)).animation(Motion.expand, value: streak) }   // motion.flipDigit
                }.padding(.horizontal, 4).padding(.top, 6).id("todayTop")
                .background { if #unavailable(iOS 18) { GeometryReader { g in Color.clear.preference(key: ScrollOffsetKey.self, value: g.frame(in: .global).minY) } } }
                WeekStrip(days: (0..<7).reversed().map { i in let d = Date().startOfDay.adding(days: -i); return (d, loggedWeek.contains(d.dayKey)) }, selected: session.selectedDate) { session.selectedDate = $0.startOfDay }.padding(.horizontal, 4).padding(.top, 14)
                VStack(spacing: 0) {
                    if let t = targets { HeroCard(totals: DayTotals(entries), targets: t, pinned: pinnedRow, onPrep: preppedRow ? { balance = true } : nil).tourAnchor(.hero).padding(.top, 20) }
                    VStack(spacing: Space.cardGap) {
                        ForEach(Meal.allCases) { meal in
                            MealCardView(meal: meal, entries: entries.filter { $0.meal == meal && !removingIds.contains($0.id) },
                                         recent: hasHistory ? (recent[meal]?.entries ?? []) : [], saved: savedByMeal[meal], nudge: !store.profile().swipeHintSeen,
                                         onAdd: { addMeal = meal; if meal == .breakfast { Tour.shared.didAct(.breakfastAdd) } }, tourAnchor: meal == .breakfast, onOpen: { detail = $0 }, onRemove: remove, onAddYesterday: { addYesterday(meal) }, onSave: { saveMeal(meal) })
                        }
                    }.padding(.top, Space.heroGap).animation(Motion.expand, value: entries.map(\.id))
                }.id(dayLayer).transition(dayTransition)
            }
            .padding(.horizontal, Space.gutter).padding(.bottom, Space.bottomClearToday)
        }
        .onPreferenceChange(ScrollOffsetKey.self) { v in   // iOS 17: the header's resting position minus where it is now
            if headerBase == nil { headerBase = v }
            didScroll((headerBase ?? v) - v)
        }
        .modifier(ScrollOffsetModifier(onChange: didScroll))   // iOS 18+: contentOffset straight from the scroll geometry
        .scrollBounceBehavior(.always)
        .scrollIndicators(.hidden)
        .onChange(of: session.scrollTopTick[.today]) { withAnimation(Motion.push) { proxy.scrollTo("todayTop", anchor: .top) } }
        }
        // rev 10 §4.3 inline bar: surface @ .88 + blur once collapsed, hairline past 90 %, title 17/800 centred; only the title takes touches
        VStack(spacing: 0) {
            Button { withAnimation(Motion.expand) { calendarOpen.toggle() } } label: { HStack(spacing: 6) { Text(Fmt.dayTitle(session.selectedDate)).font(.yumo.inlineTitle).tabular().foregroundStyle(Color.yumo.ink); Text("▾").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }.frame(height: 44) }
                .buttonStyle(PlainPressStyle()).opacity(t).offset(y: 6 * (1 - t)).allowsHitTesting(t > 0.5)
        }
        .frame(maxWidth: .infinity)
        .background { Rectangle().fill(Color.yumo.surface.opacity(0.88 * t)).background(.ultraThinMaterial.opacity(t)).ignoresSafeArea(edges: .top).allowsHitTesting(false) }
        .overlay(alignment: .bottom) { Rectangle().fill(Color.yumo.surfaceEdge).frame(height: 0.5).opacity(t > 0.9 ? 1 : 0).animation(Motion.titleCollapse, value: t > 0.9) }
        .zIndex(1)
        if calendarOpen {
            Color.black.opacity(0.001).ignoresSafeArea().onTapGesture { withAnimation(Motion.expand) { calendarOpen = false } }
            CalendarPopover(month: session.selectedDate, selected: session.selectedDate, logged: loggedMonth, onPick: { d in session.selectedDate = d.startOfDay; withAnimation(Motion.expand) { calendarOpen = false } }, onToday: { session.selectedDate = Date().startOfDay; withAnimation(Motion.expand) { calendarOpen = false } })
                .padding(.horizontal, Space.gutter).padding(.top, 58).transition(.opacity.combined(with: .offset(y: 8))).zIndex(2)
        }
        }
        .onAppear(perform: reload)
        .onChange(of: session.selectedDate) { old, new in
            // motion.dayChange: the layer slides in 14 pt from the direction of travel (+14 forward in time, −14 back) and fades, 320 ms
            dayForward = new > old
            withAnimation(Motion.dayChange) { dayLayer = new.dayKey; reload() }
        }
        .onChange(of: session.tick) { reload() }
        .sheet(item: $addMeal) { m in AddFoodSheet(meal: m, dayKey: dayKey).yumoSheet() }
        .pushCover(item: $detail) { e in FoodDetailScreen(entry: e, dayKey: dayKey) }
        .sheet(isPresented: $balance) { BalanceSheet(dayKey: dayKey).yumoSheet().presentationDetents([.large]) }
        .onChange(of: session.selectedDate) { if calendarOpen { withAnimation(Motion.expand) { calendarOpen = false } } }
    }
    /// Rev 5: the "Prepped something?" row at the bottom of Today — today only, > 150 kcal left, a meal empty, and either staples or history to balance from.
    var preppedRow: Bool {
        guard let t = targets, isToday else { return false }
        let left = Double(t.kcal) - DayTotals(entries).kcal
        let empty = Meal.allCases.filter { m in !entries.contains { $0.meal == m } }
        return left > 150 && !empty.isEmpty && (hasStaples || hasHistory) && !Tour.shared.active
    }

    /// motion.titleCollapse input; scrolling also closes an open swipe row.
    func didScroll(_ sc: CGFloat) { if abs(sc - scrolled) > 2 { swipes.scrollTick &+= 1 }; scrolled = sc }
    var dayTransition: AnyTransition { .asymmetric(insertion: .opacity.combined(with: .offset(x: dayForward ? 14 : -14)), removal: .opacity) }

    func reload() {
        let s = store
        entries = s.entries(dayKey)
        var rec: [Meal: (entries: [FoodEntry], daysAgo: Int)] = [:]
        for m in Meal.allCases { if let r = s.recentMeal(m, before: dayKey) { rec[m] = r } }
        recent = rec
        targets = s.targets()
        let p = s.profile()
        if p.showNutrientsOnToday, !p.pinnedNutrients.isEmpty, let t = targets {
            pinnedRow = p.pinnedNutrients.compactMap { key -> String? in
                guard let n = Nutrients.by(key) else { return nil }
                let v = s.nutrientTotal(key, dayKey: dayKey, entries: entries) ?? 0
                let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
                let g = goal ?? ul
                return "\(n.name.components(separatedBy: " (").first ?? n.name) \(Nutrients.format(v, unit: n.unit))\(g.map { " / \(Nutrients.format($0, unit: n.unit))" } ?? "") \(n.unit)"
            }.joined(separator: " · ")
        } else { pinnedRow = nil }
        hasHistory = s.hasHistory(before: Date().dayKey)
        hasStaples = !s.staples().isEmpty
        let today = Date().startOfDay
        let wasLoggedToday = loggedWeek.contains(today.dayKey); _ = wasLoggedToday
        loggedWeek = s.loggedDays(from: today.adding(days: -6).dayKey, to: today.dayKey)
        let cal = Calendar.current, first = cal.date(from: cal.dateComponents([.year, .month], from: session.selectedDate))!
        loggedMonth = s.loggedDays(from: first.dayKey, to: cal.date(byAdding: .month, value: 1, to: first)!.adding(days: -1).dayKey)
        let wasLogged = wasLoggedToday
        streak = s.streak(today: today.dayKey)
        if !wasLogged, !entries.isEmpty, isToday, hadLoaded { UINotificationFeedbackGenerator().notificationOccurred(.success) }   // motion.tickStamp: the week circle fills and the tick draws on (WeekStrip animates), haptic .success
        hadLoaded = true
        // rev 10 §7.1 weekly review: pending → chip; auto-opens once, on the first return to Today after Monday 06:00, never over the tour or a sheet
        reviewPending = Review.refresh(s)
        if reviewPending, !p.reviewOpened, !Tour.shared.active, addMeal == nil, detail == nil, !balance, !session.reviewAutoShown { session.reviewAutoShown = true; Task { try? await Task.sleep(for: .milliseconds(400)); session.showReview = true } }
        var map: [Meal: SavedMeal] = [:]
        for m in Meal.allCases { if let sm = s.savedMeal(matching: entries.filter { $0.meal == m }) { map[m] = sm } }
        savedByMeal = map
        let totals = DayTotals(entries), day = session.selectedDate
        Task { await HealthSync.writeDay(totals, date: day) }
        if hasHistory, !p.swipeHintSeen, !recent.isEmpty { Task { try? await Task.sleep(for: .seconds(3)); p.swipeHintSeen = true; s.save() } }
    }
    func remove(_ e: FoodEntry) {
        let name = e.foodName
        store.remove(e); toaster.show("Removed \(name)"); session.changed()
    }
    func addYesterday(_ meal: Meal) {
        for e in recent[meal]?.entries ?? [] { if let f = e.food { _ = store.log(food: f, meal: meal, dayKey: dayKey, quantity: e.quantity, serving: Serving(label: e.servingLabel, grams: e.servingGrams)) } }
        let daysAgo = recent[meal]?.daysAgo ?? 1
        let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "EEEE"
        toaster.show("\(daysAgo == 1 ? "Yesterday" : f.string(from: session.selectedDate.adding(days: -daysAgo)))'s \(meal.rawValue.lowercased()) added"); session.changed()   // rev 10 §3: real weekday
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
    var totals: DayTotals; var targets: Targets; var pinned: String? = nil; var onPrep: (() -> Void)? = nil
    var goal: Int { targets.kcal }   // one daily target; training/rest split removed (DEVIATIONS_REV9 A1)
    @State private var hit = false
    @State private var pulse = false
    /// motion.hitTarget: when eaten enters target ± 40 the number sits in accent for 0.8 s and the bar scales 1 → 1.03 → 1 once.
    func checkHit(_ old: Double, _ new: Double) {
        let inNow = abs(new - Double(goal)) <= 40, inBefore = abs(old - Double(goal)) <= 40
        guard inNow && !inBefore else { return }
        hit = true; withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.3)) { pulse = true }
        Task { try? await Task.sleep(for: .milliseconds(300)); withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.3)) { pulse = false }; try? await Task.sleep(for: .milliseconds(500)); withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.6)) { hit = false } }
    }
    var over: Bool { totals.kcal > Double(goal) }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                CountUpText(value: Int(totals.kcal.rounded()), font: .yumo.hero, color: over ? .yumo.danger : (hit ? .yumo.accent : .yumo.ink), kerning: -2.5).animation(Motion.expand, value: hit)   // motion.countUp + motion.hitTarget
                Text("/ \(Fmt.k(goal))").font(.yumo.displayMuted).tabular().foregroundStyle(Color.yumo.inkMuted)
            }
            if totals.kcal == 0 { Text("Nothing logged yet").font(.nunito(14, .bold)).foregroundStyle(Color.yumo.inkMuted).padding(.top, 10) }   // rev 10 §4.1: everything else stays full ink
            Bar(fraction: totals.kcal / Double(max(1, goal)), height: 10, fill: over ? .yumo.danger : .yumo.accent).scaleEffect(x: pulse ? 1.03 : 1, y: pulse ? 1.3 : 1).padding(.top, Space.gridGap)
                .onChange(of: totals.kcal) { old, new in checkHit(old, new) }
            HStack(spacing: Space.gridGap) {
                stat("Protein", totals.p, targets.protein); stat("Carbs", totals.c, targets.carbs); stat("Fat", totals.f, targets.fat)
            }.padding(.top, Space.gridGap)
            if let pinned { Text(pinned).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1).padding(.top, 12) }
        }
        .card(padding: EdgeInsets(top: 24, leading: 24, bottom: 22, trailing: 24), radius: Radius.card)
        .overlay(alignment: .topTrailing) { if let onPrep { SparkleButton(action: onPrep).padding(16) } }
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
    var meal: Meal; var entries: [FoodEntry]; var recent: [FoodEntry]; var saved: SavedMeal?; var nudge = false
    var onAdd: () -> Void; var tourAnchor = false; var onOpen: (FoodEntry) -> Void; var onRemove: (FoodEntry) -> Void; var onAddYesterday: () -> Void; var onSave: () -> Void
    var totals: DayTotals { DayTotals(entries) }
    @ViewBuilder var chip: some View { if tourAnchor { AddChip(action: onAdd).tourAnchor(.breakfastAdd) } else { AddChip(action: onAdd) } }
    var body: some View {
        VStack(spacing: 0) {
            if entries.isEmpty {
                // rev 10 §2.1: header padding 13 14 13 0 → 60 pt, the same as the repeat row under it
                HStack { Text(meal.rawValue).font(.nunito(18, .extrabold)); Spacer(); chip.padding(.trailing, -5) }
                    .padding(.vertical, Space.rowHeader).padding(.trailing, 14)
                if !recent.isEmpty {
                    SwipeToAddRow(id: "repeat-\(meal.rawValue)", foods: recent.map { Food.split($0.foodName, state: $0.food?.state).name }, kcal: DayTotals(recent).kcal, nudge: nudge, onCommit: onAddYesterday)
                        .overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5).padding(.leading, Space.cardPad) }.padding(.leading, -Space.cardPad)
                }
            } else {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(meal.rawValue).font(.yumo.title); Text("\(Fmt.k(totals.kcal)) kcal").font(.yumo.bodyStrong).tabular().foregroundStyle(Color.yumo.inkMuted); if let s = saved { Tag(label: s.name) } }
                        Text("P \(Fmt.g(totals.p)) · C \(Fmt.g(totals.c)) · F \(Fmt.g(totals.f))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                    }
                    Spacer(); chip.padding(.trailing, -5)
                }.padding(.top, 9).padding(.bottom, 8).padding(.trailing, 12).hairline()
                ForEach(Array(entries.enumerated()), id: \.element.id) { i, e in FoodRowView(entry: e, last: i == entries.count - 1 && saved != nil, onOpen: { onOpen(e) }, onRemove: { onRemove(e) }).padding(.leading, -Space.cardPad) }
                if saved == nil { HStack { TextAction(label: "Save as meal", action: onSave); Spacer() }.padding(.vertical, Space.rowFooter) }
            }
        }
        .padding(.leading, Space.cardPad).listCard(radius: Radius.card)
    }
}

/// Food row on the two-stage engine (rev 10 §3): swipe left → inset red bin button; open at 72, arm at 50 %, release deletes. Tap opens; press → color.pressed.
struct FoodRowView: View {
    var entry: FoodEntry; var last = false; var onOpen: () -> Void; var onRemove: () -> Void
    var body: some View {
        SwipeActionRow(id: entry.id, edge: .trailing, onTap: onOpen, onCommit: onRemove) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    let nd = Food.split(entry.foodName, state: entry.food?.state)
                    (Text(nd.name).font(.yumo.body) + Text("  " + entry.amountLabel).font(.yumo.detail).foregroundColor(.yumo.inkMuted)).lineLimit(1)
                    Text((nd.detail.isEmpty ? "" : nd.detail + " · ") + (entry.food?.macrosUnknown == true ? "P — · C — · F —" : "P \(Fmt.g(entry.p)) · C \(Fmt.g(entry.c)) · F \(Fmt.g(entry.f))")).font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
                }
                Spacer(); Text(Fmt.k(entry.kcal)).font(.yumo.body).tabular()
            }
            .foregroundStyle(Color.yumo.ink)
            .padding(.vertical, Space.rowFood).padding(.horizontal, Space.cardPad)
        }
        .transition(.opacity.combined(with: .offset(y: 8)))   // motion.rowIn
        .overlay(alignment: .bottom) { if !last { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5).padding(.leading, Space.cardPad) } }
    }
}

/// Repeat row on the same engine, mirrored (rev 10 §2.2 + §3): leading accent "+" action; commit inserts the remembered foods. No tint on press, no tap action.
struct SwipeToAddRow: View {
    var id: String; var foods: [String]; var kcal: Double; var nudge = false; var onCommit: () -> Void
    var body: some View {
        SwipeActionRow(id: id, edge: .leading, pressHighlight: false, onCommit: onCommit) {
            SwipeHintRow(foods: foods, kcal: kcal, nudge: nudge)
        }
    }
}

struct ScrollOffsetModifier: ViewModifier { var onChange: (CGFloat) -> Void
    func body(content: Content) -> some View {
        if #available(iOS 18, *) { content.onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, new in onChange(new) } }
        else { content }
    }
}
struct ScrollOffsetKey: PreferenceKey { static var defaultValue: CGFloat = 0; static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() } }

/// motion.flipDigit: the incoming value flips in from rotateX(90°).
struct FlipIn: ViewModifier { var angle: Double
    func body(content: Content) -> some View { content.rotation3DEffect(.degrees(angle), axis: (x: 1, y: 0, z: 0), perspective: 0.6).opacity(angle == 0 ? 1 : 0) }
}
