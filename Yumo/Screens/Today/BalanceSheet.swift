import SwiftUI
import SwiftData

/// I prepped… — one screen (22 Oct, Sid: "this whole section is doing too many things at once"). It opens on today's plan: your staples
/// sized to land the day, and suggested foods for whatever they don't cover. Two gestures:
///   · tap an amount → type what you're having → it's fixed and everything else resizes around it (prepped 400 g of chicken, only 80 g of oats left);
///   · tap a suggested food → Keep (it becomes a staple and comes back every day) · Swap (four alternatives) · Never.
/// Everything that isn't today — finding foods, scanning, Recent, the protein powder question, foods you don't eat, blocked foods — lives in
/// Settings › Staples, one tap away via "Edit staples".
struct BalanceSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var dayKey: String
    @State private var items: [PrepItem] = []          // amounts you set today (foodId, grams, meal)
    @State private var gramsText: [String: String] = [:]
    @State private var open: String? = nil             // the plan row (PlanItem.id) whose amount editor is unfolded
    @State private var result: Balance.Result? = nil
    @State private var loaded = false
    @State private var staplesOpen = false
    @State private var gen = 0
    @State private var chosen: [String: String] = [:]  // today's swaps: swapped food id → replacement food id
    @State private var swapFor: Balance.PlanItem? = nil
    var store: Store { Store(ctx) }
    var solveKey: String { items.map { ($0.foodId ?? $0.text) + ":" + (gramsText[$0.foodId ?? $0.text] ?? "") }.joined(separator: ",") + "|\(loaded)|\(gen)|" + chosen.map { $0.key + "=" + $0.value }.sorted().joined(separator: ",") }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 10) {
                Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5)
                ZStack {
                    HStack { CloseButton { dismiss() }; Spacer(); TextAction(label: "Edit staples") { staplesOpen = true } }
                    Text("Your day").font(.yumo.title)
                }
            }.padding(.top, 10).padding(.horizontal, Space.gutter)
            plan
        }
        .background(Color.yumo.bg)
        .onAppear(perform: load)
        // saved on every change, not only on ✕ — a swipe-down or the app being killed kept nothing (22 Oct)
        .task(id: solveKey) { guard loaded else { return }; try? await Task.sleep(for: .milliseconds(200)); guard !Task.isCancelled else { return }; syncGrams(); solve(); persist() }
        .pushCover(isPresented: $staplesOpen, onDismiss: { gen += 1 }) { StaplesScreen(back: "Your day") }
        .sheet(item: $swapFor) { it in suggestionSheet(it).presentationDetents([.large]) }
    }

    var plan: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let r = result {
                        summary(r)
                        if r.emptyMeals.isEmpty {
                            Text("Every meal already has food logged today. Remove a meal's foods on Today to plan it here.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4).padding(.top, 8)
                        }
                        ForEach(r.emptyMeals, id: \.rawValue) { m in
                            let rows = r.items.filter { $0.meal == m && $0.grams > 0 }
                            if !rows.isEmpty { mealCard(m, rows) }
                        }
                        if !r.emptyMeals.isEmpty {
                            Text("Tap an amount to set what you're having — the rest resizes. Tap a suggested food to keep or swap it.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 4)
                        }
                    } else { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity).padding(.top, 30) }
                }.padding(.horizontal, Space.gutter).padding(.top, 14).padding(.bottom, 16)
            }.scrollDismissesKeyboard(.interactively)
            let n = result.map { r in r.emptyMeals.filter { m in r.items.contains { $0.meal == m && $0.grams > 0 } }.count } ?? 0
            PrimaryButton(label: n == 0 ? "Nothing to log" : "Log \(n) meal\(n == 1 ? "" : "s")", size: .regular, disabled: n == 0) { logIt() }
                .padding(EdgeInsets(top: 12, leading: 16, bottom: 24, trailing: 16))
                .background(UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20).fill(Color.yumo.surface).overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 1) }.ignoresSafeArea())
        }
    }

    func summary(_ r: Balance.Result) -> some View {
        let t = store.targets()
        let kcalOff = abs(r.projected.kcal - Double(t.kcal)) > 40   // red only when the calories are off, not when protein is (22 Oct: 2,299 / 2,300 in red)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 4) { Text(Fmt.k(r.projected.kcal)).font(.nunito(28, .extrabold)).kerning(-0.5).tabular().foregroundStyle(kcalOff ? Color.yumo.danger : .yumo.ink); Text("/ \(Fmt.k(t.kcal))").font(.nunito(14, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                Spacer(minLength: 8)
                Text(r.ok ? "On target" : r.status).font(.yumo.caption).foregroundStyle(r.statusDanger ? Color.yumo.danger : .yumo.accent).multilineTextAlignment(.trailing).padding(.horizontal, 10).padding(.vertical, 6).background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(r.statusDanger ? Color.yumo.dangerTint : .yumo.accentTint))
            }
            // the macros get their own line: a long status no longer squeezes them to "F 63 /…"
            HStack(spacing: 0) {
                Text("P ").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) + Text(Fmt.g(r.projected.p)).font(.yumo.caption).foregroundColor(r.projected.p < Double(t.protein) - 5 ? .yumo.danger : .yumo.ink) + Text(" / \(t.protein) · C ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(Fmt.g(r.projected.c)).font(.yumo.caption) + Text(" / \(t.carbs) · F ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(Fmt.g(r.projected.f)).font(.yumo.caption) + Text(" / \(t.fat)").font(.yumo.caption).foregroundColor(.yumo.inkMuted)
            }.tabular().lineLimit(1).minimumScaleFactor(0.8)
        }.card(padding: EdgeInsets(top: 14, leading: 18, bottom: 14, trailing: 18), radius: 20)
    }

    func mealCard(_ m: Meal, _ rows: [Balance.PlanItem]) -> some View {
        let tot = rows.reduce(DayTotals([])) { acc, it in var a = acc; a.kcal += it.food.kcal100 * it.grams / 100; a.p += it.food.p100 * it.grams / 100; a.c += it.food.c100 * it.grams / 100; a.f += it.food.f100 * it.grams / 100; return a }
        return VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(m.rawValue).font(.nunito(16, .extrabold)); Text("\(Fmt.k(tot.kcal)) kcal").font(.nunito(14, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                Spacer(); Text("P \(Fmt.g(tot.p)) · C \(Fmt.g(tot.c)) · F \(Fmt.g(tot.f))").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
            }.padding(EdgeInsets(top: 11, leading: 0, bottom: 8, trailing: 16)).hairline()
            ForEach(rows) { it in row(it) }
        }.padding(.leading, 18).listCard(radius: 20)
    }

    /// One plan row: name + what kind of row it is (staple / suggested / set by you) · the amount, which is the only control for amounts.
    @ViewBuilder func row(_ it: Balance.PlanItem) -> some View {
        let key = it.food.id, isOpen = open == it.id
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Button { if it.suggested { swapFor = it } } label: {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(it.food.shortName).font(.nunito(15, .bold)).foregroundStyle(Color.yumo.ink).lineLimit(1)
                        (Text(it.weighed ? "you set this" : it.suggested ? "suggested ›" : it.usual ? "your usual" : "staple").foregroundColor(it.weighed || it.suggested ? .yumo.accent : .yumo.inkMuted)
                         + Text(it.food.detail.isEmpty ? "" : " · " + it.food.detail).foregroundColor(.yumo.inkMuted)).font(.yumo.footnote).lineLimit(1)
                    }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }.buttonStyle(PlainPressStyle()).disabled(!it.suggested)
                Button { withAnimation(Motion.expand) { open = isOpen ? nil : it.id } } label: {
                    Text("\(Fmt.g(it.grams)) g").font(.nunito(15, .extrabold)).tabular().foregroundStyle(Color.yumo.ink)
                        .padding(.horizontal, 10).frame(height: 34)
                        .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(it.weighed ? Color.yumo.accentTint : .yumo.track))
                        .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).stroke(it.weighed ? Color.yumo.accent : .clear, lineWidth: 1.5))
                }.buttonStyle(PlainPressStyle()).frame(minHeight: 44).accessibilityLabel("\(it.food.shortName), \(Fmt.g(it.grams)) grams. Set the amount")
            }.padding(.vertical, 6).padding(.trailing, 16)
            Expandable(open: isOpen) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        Text("How much are you having?").font(.yumo.caption).foregroundStyle(Color.yumo.ink)
                        Spacer(minLength: 4)
                        InsetField(text: Binding(get: { gramsText[key] ?? "" }, set: { gramsText[key] = $0; ensureItem(it) }), unit: "g", width: 104, placeholder: Fmt.g(it.grams))
                        Button { done(it) } label: { Text("Done").font(.nunito(14, .black)).foregroundStyle(Color.yumo.onAccent).padding(.horizontal, 14).frame(height: 42) }.buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: 3, radius: Radius.control))
                    }
                    Text(it.weighed ? "Fixed at this amount — everything else is sized around it." : "Type what you prepped or what's left. It's fixed, and the rest of the day resizes.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted)
                    if it.weighed { TextAction(label: "Let Yumo size it again") { clear(it) } }
                }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Color.yumo.bg)).padding(.trailing, 16).padding(.bottom, 10)
            }
        }.hairline()
    }

    /// Keep · Swap · Never for a suggested food. Keeping makes it a staple: it comes back every day (Sid: "I like the same foods every day").
    func suggestionSheet(_ it: Balance.PlanItem) -> some View {
        let inPlan = Set((result?.items ?? []).map(\.food.id))
        let alts = Planner.alternatives(to: it.food, kind: it.kind, meal: it.meal, inPlan: inPlan, dayKey: dayKey, store: store, all: store.foods())
        return VStack(spacing: 0) {
            Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5).padding(.top, 10)
            Text(it.food.shortName).font(.yumo.title).padding(.top, 12)
            Text("Suggested \(Balance.className(it.kind).lowercased()) · \(Fmt.g(it.grams)) g for \(it.meal.rawValue.lowercased())").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.top, 2)
            PrimaryButton(label: "Keep \(it.food.shortName)", size: .compact) {
                store.addStaple(it.food); swapFor = nil; gen += 1
                toaster.show("\(it.food.shortName) is a staple · it comes back every day")
            }.padding(.horizontal, Space.gutter).padding(.top, 16)
            Text("It becomes a staple, so tomorrow's plan starts with it too.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.top, 6)
            Overline(text: "Or swap for").frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, Space.gutter + 4).padding(.top, 18)
            VStack(spacing: 0) {
                ForEach(alts, id: \.food.id) { a in
                    Button {
                        chosen[it.food.id] = a.food.id; swapFor = nil
                        // never inferred from the swap (Sid): the toast asks, and doesn't block the plan
                        let old = it.food, s = store
                        toaster.show("\(old.shortName) swapped out", action: "Never suggest") { s.setPreference(old, .never); gen += 1 }
                    } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 1) { Text(a.candidate.label).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink); Text([extra(a.food.detail, besides: a.candidate.label), "\(Fmt.g(a.candidate.portion)) g · \(Fmt.k(a.food.kcal(for: a.candidate.portion))) kcal · P \(Fmt.g(a.food.p100 * a.candidate.portion / 100))"].filter { !$0.isEmpty }.joined(separator: " · ")).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }
                            Spacer(); Text("›").font(.nunito(22, .extrabold)).foregroundStyle(Color.yumo.accent)
                        }.padding(.vertical, 11).padding(.trailing, 16).contentShape(Rectangle())
                    }.buttonStyle(PlainPressStyle()).hairline()
                }
                if alts.isEmpty { Text("Nothing else to suggest here — add a food you like in Edit staples.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.vertical, 14) }
            }.padding(.leading, 18).listCard(radius: 20).padding(.horizontal, Space.gutter).padding(.top, 6)
            HStack { Spacer(); TextAction(label: "Never suggest \(it.food.shortName)", danger: true) { swapFor = nil; store.setPreference(it.food, .never); gen += 1; toaster.show("\(it.food.shortName) won't come up again") }; Spacer() }.padding(.top, 14)
            Spacer()
        }.background(Color.yumo.bg.ignoresSafeArea())
    }

    /// The food's detail minus what the label already says ("Greek yogurt 0% fat" · 0% fat, "King prawns" · king).
    func extra(_ detail: String, besides label: String) -> String {
        let l = label.lowercased()
        return detail.components(separatedBy: " · ").map { $0.components(separatedBy: ", ").filter { !l.contains($0.lowercased()) }.joined(separator: ", ") }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // MARK: state
    /// Amounts set and swaps made today come back when the sheet reopens today; a new day starts fresh (yesterday's prep is not today's).
    func load() {
        let p = try? store.ctx.fetch(FetchDescriptor<PrepDay>(predicate: #Predicate { $0.dayKey == dayKey })).first
        items = (p?.items ?? []).filter { $0.foodId != nil && $0.grams > 0 }
        chosen = p?.chosen ?? [:]
        for it in items { gramsText[it.foodId!] = Fmt.g(it.grams) }
        loaded = true
        solve()   // the plan is there on the first frame; the 200 ms debounce is for typing (22 Oct audit: a spinner flashed on every open)
    }
    func ensureItem(_ it: Balance.PlanItem) {
        if !items.contains(where: { $0.foodId == it.food.id }) { items.append(PrepItem(text: it.food.name, grams: 0, foodId: it.food.id, carried: false, meal: it.meal.rawValue)) }
    }
    func syncGrams() {
        for i in items.indices { if let id = items[i].foodId, let t = gramsText[id] { items[i].grams = Double(t.replacingOccurrences(of: ",", with: ".")) ?? 0 } }
    }
    func done(_ it: Balance.PlanItem) {
        syncGrams(); items.removeAll { $0.grams <= 0 }
        withAnimation(Motion.expand) { open = nil }
    }
    func clear(_ it: Balance.PlanItem) {
        items.removeAll { $0.foodId == it.food.id }; gramsText[it.food.id] = nil
        withAnimation(Motion.expand) { open = nil }
    }
    func solve() { guard loaded else { return }; withAnimation(Motion.snap) { result = Balance.solve(dayKey: dayKey, weighed: items.filter { $0.grams > 0 }, chosen: chosen, store: store) } }
    func persist() { let p = Balance.prep(dayKey, store: store); p.items = items.filter { $0.grams > 0 }; p.chosen = chosen; store.save() }
    func logIt() {
        guard let r = result else { return }
        for it in r.items where it.grams > 0 { _ = store.log(food: it.food, meal: it.meal, dayKey: dayKey, quantity: it.grams / 100, serving: Serving(label: "100 g", grams: 100)) }
        let p = Balance.prep(dayKey, store: store); var l = p.logged; for it in r.items where it.grams > 0 { l[it.food.id, default: 0] += it.grams }; p.logged = l   // what to net off if the sheet reopens today
        persist(); UINotificationFeedbackGenerator().notificationOccurred(.success); toaster.show("Logged · day at \(Fmt.k(r.projected.kcal))"); session.changed(); dismiss()
    }
}
extension String { func ifEmpty(_ alt: String) -> String { isEmpty ? alt : self } }
