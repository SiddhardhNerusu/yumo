import SwiftUI
import SwiftData

/// I prepped… (rev 5, was Balance the day): outcome card → prepped rows → plan rows from the user's staples → Log it / Another way.
struct BalanceSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var dayKey: String
    @State private var mode: Balance.Mode = .prepped
    @State private var items: [PrepItem] = []
    @State private var gramsText: [UUID: String] = [:]
    @State private var keep: Set<String> = []
    @State private var swaps = 0
    @State private var result: Balance.Result? = nil
    @State private var loaded = false
    @State private var staplesOpen = false
    @State private var gen = 0                         // bumped when staples change so the plan re-solves even if the inputs look the same
    var store: Store { Store(ctx) }
    var hasStaples: Bool { !store.staples().isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "I prepped…", onClose: { persist(); dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let r = result { outcome(r) }
                    if !hasStaples {
                        Button { staplesOpen = true } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) { Text("Add your staples first").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.ink); Text("The foods you eat most weeks — breast, thigh, potato, oats. Yumo balances from those.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.leading) }
                                Spacer(); Text("›").font(.nunito(22, .extrabold)).foregroundStyle(Color.yumo.accent)
                            }.frame(maxWidth: .infinity).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20))
                        }.buttonStyle(PlainPressStyle())
                    }
                    prepped
                    if let r = result { plan(r) }
                    HStack(spacing: 10) {
                        PrimaryButton(label: "Log it", size: .regular) { logIt() }.frame(maxWidth: .infinity).layoutPriority(2)
                        SecondaryButton(label: swaps > 0 ? "Usual carb" : "Another way", size: .regular) { swaps = swaps > 0 ? 0 : 1 }.frame(width: 130)
                    }.padding(.top, 4)
                    HStack(spacing: 4) { Text("Tap a food to keep it as usual ·").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted); Button { staplesOpen = true } label: { Text("Edit staples").font(.nunito(12, .extrabold)).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle()) }.frame(maxWidth: .infinity)
                }.padding(.horizontal, Space.gutter).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
        }
        .background(Color.yumo.bg)
        .fullScreenCover(isPresented: $staplesOpen, onDismiss: { items = []; load(); gen += 1 }) { StaplesScreen(back: "I prepped…") }
        .onAppear(perform: load)
        .task(id: solveKey) { guard loaded else { return }; try? await Task.sleep(for: .milliseconds(200)); guard !Task.isCancelled else { return }; syncGrams(); solve() }
    }
    /// Everything the plan depends on; `.task(id:)` debounces typing so keystrokes are never blocked by a solve.
    var solveKey: String { mode.rawValue + "|" + items.map { $0.text + ":" + (gramsText[$0.id] ?? "") }.joined(separator: ",") + "|" + keep.sorted().joined(separator: ",") + "|\(swaps)|\(loaded)|\(gen)" }

    // MARK: outcome card (hero anatomy, 44/800)
    func outcome(_ r: Balance.Result) -> some View {
        let p = store.profile(); let t = store.targets(); let goal = t.kcal(training: store.isTraining(dayKey), profile: p)
        let carbs = Calc.carbsFor(kcal: goal, protein: t.protein, fat: t.fat)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(r.projected.kcal)).font(.yumo.statBig).kerning(-1).tabular().foregroundStyle(r.statusDanger ? Color.yumo.danger : .yumo.ink); Text("/ \(Fmt.k(goal))").font(.nunito(16, .semibold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                Spacer()
                Text(r.status).font(.nunito(13, .extrabold)).foregroundStyle(r.statusDanger ? Color.yumo.danger : .yumo.ink).multilineTextAlignment(.trailing)
            }
            Bar(fraction: r.projected.kcal / Double(max(1, goal)), height: 8, fill: r.statusDanger ? .yumo.danger : .yumo.accent).padding(.top, 10)
            HStack(spacing: Space.gridGap) { stat("Protein", r.projected.p, t.protein); stat("Carbs", r.projected.c, carbs); stat("Fat", r.projected.f, t.fat) }.padding(.top, 12)
            Text("\(Fmt.k(r.leftKcal)) kcal left · fills \(r.emptyMeals.map(\.rawValue).joined(separator: " + "))\(r.fromStaples ? " · from your staples" : "")").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.top, 10)
        }.card(padding: EdgeInsets(top: 16, leading: 20, bottom: 14, trailing: 20))
    }
    func stat(_ label: String, _ v: Double, _ goal: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.yumo.captionLight).foregroundStyle(Color.yumo.inkMuted)
            HStack(alignment: .firstTextBaseline, spacing: 0) { Text(Fmt.g(v)).font(.nunito(17, .extrabold)).tabular(); Text(" / \(goal) g").font(.nunito(12, .semibold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
            Bar(fraction: v / Double(max(1, goal)), height: 4, fill: .yumo.ink).padding(.top, 5)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: prepped card
    var prepped: some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: "Prepped today").padding(.top, 2)
            VStack(spacing: 0) {
                ForEach($items) { $it in
                    let hit = it.text.isEmpty ? nil : TypeToLog.candidates(for: it.text, store: store).first?.food
                    InputRow(text: $it.text, grams: Binding(get: { gramsText[it.id] ?? "" }, set: { gramsText[it.id] = $0 }), hint: it.text.isEmpty ? "What you weighed" : (hit.map { "\($0.name)\($0.state.map { " · \($0)" } ?? "")" } ?? "Not found"), hintAccent: hit != nil && !it.text.isEmpty) { items.removeAll { $0.id == it.id } }
                }
                HStack { TextAction(label: "+ Add what you weighed") { let n = PrepItem(text: "", grams: 0); items.append(n); gramsText[n.id] = "" }; Spacer() }.padding(.vertical, 12).padding(.trailing, Space.cardPad)
            }.padding(.leading, Space.cardPad).listCard()
        }
    }

    // MARK: plan card
    func plan(_ r: Balance.Result) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: "Plan").padding(.top, 2)
            VStack(spacing: 0) {
                if r.items.isEmpty { Text("Nothing to move yet — log a few days so I know your usual foods, or add what you prepped.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.vertical, 14).padding(.trailing, Space.cardPad) }
                ForEach(r.items) { it in
                    PlanRow(name: TypeToLog.shortName(it.food), caption: it.meal.rawValue + (it.note.map { " · \($0)" } ?? "") + (it.atMax ? " · at your max" : ""), from: r.fromStaples ? it.newGrams : it.usualGrams, to: it.newGrams,
                            tag: it.fixed == .prepped ? "prepped" : (it.fixed == .kept ? "kept" : nil), tagAccent: it.fixed == .kept) {
                        guard it.fixed == nil || it.fixed == .kept else { return }
                        if keep.contains(it.id) { keep.remove(it.id) } else { keep.insert(it.id) }
                    }
                }
            }.padding(.leading, Space.cardPad).listCard()
        }
    }

    // MARK: state
    func load() {
        let prep = Balance.prep(dayKey, store: store)
        mode = .prepped; keep = prep.keep; swaps = prep.swaps
        items = prep.items
        if items.isEmpty {
            // pre-fill with the staple proteins (rev 5), else the usual proteins for the empty meals
            let stapleProteins = store.staples().compactMap { store.food(id: $0.foodId) }.filter { Balance.classify($0) == .protein }
            if !stapleProteins.isEmpty { items = stapleProteins.map { PrepItem(text: $0.name, grams: 0) } }   // grams blank until typed (README §1a)
            else {
                let logged = store.entries(dayKey); let empty = Meal.allCases.filter { m in !logged.contains { $0.meal == m } }
                var seen = Set<String>()
                for (f, _, g) in Balance.usualPattern(for: empty, today: dayKey, store: store) where Balance.classify(f) == .protein && !seen.contains(f.id) { seen.insert(f.id); items.append(PrepItem(text: TypeToLog.shortName(f).lowercased(), grams: g)) }
            }
            if items.isEmpty { items = [PrepItem(text: "", grams: 0)] }
        }
        for it in items { gramsText[it.id] = it.grams > 0 ? Fmt.g(it.grams) : "" }
        loaded = true
    }
    func syncGrams() { for i in items.indices { items[i].grams = Double(gramsText[items[i].id]?.replacingOccurrences(of: ",", with: ".") ?? "") ?? 0 } }
    func solve() {
        guard loaded else { return }
        withAnimation(Motion.snap) { result = Balance.solve(dayKey: dayKey, mode: mode, prepped: items, keep: keep, swaps: swaps, store: store) }
    }
    func persist() {
        let prep = Balance.prep(dayKey, store: store); prep.modeRaw = mode.rawValue; prep.items = items; prep.keep = keep; prep.swaps = swaps; store.save()
    }
    func logIt() {
        guard let r = result else { return }
        var n = 0
        for it in r.items where it.newGrams > 0 { _ = store.log(food: it.food, meal: it.meal, dayKey: dayKey, quantity: it.newGrams / 100, serving: Serving(label: "100 g", grams: 100)); n += 1 }
        persist(); toaster.show("Logged \(n) food\(n == 1 ? "" : "s")"); session.changed(); dismiss()
    }
}
