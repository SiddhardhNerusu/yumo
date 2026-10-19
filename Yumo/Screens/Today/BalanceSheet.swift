import SwiftUI
import SwiftData

/// I prepped… (rev 6): step 1 "What did you weigh?" (staples by class, unfold a weight field, catalogue search, carry-over) → step 2 "Your day" (meal cards, Log N meals).
struct BalanceSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var dayKey: String
    enum Step { case weigh, day }
    @State private var step: Step = .weigh
    @State private var query = ""
    @State private var hits: [Food] = []
    @State private var online: [OpenFoodFacts.Product] = []   // packaged products by name (Open Food Facts) — every food reachable, one row per barcode
    @State private var onlineFirst = false                      // the catalogue didn't match every word → the packaged group leads
    @State private var onlineBusy = false
    @State private var scanOpen = false
    @State private var open: String? = nil            // foodId whose weight panel is unfolded
    @State private var items: [PrepItem] = []          // weighed foods (foodId, grams)
    @State private var gramsText: [String: String] = [:]
    @State private var carried = false
    @State private var result: Balance.Result? = nil
    @State private var loaded = false
    @State private var staplesOpen = false
    @State private var gen = 0
    var store: Store { Store(ctx) }

    var staples: [(Staple, Food)] { store.staples().compactMap { s in store.food(id: s.foodId).map { (s, $0) } } }
    var hasStaples: Bool { !store.staples().isEmpty }
    var weighedCount: Int { items.filter { $0.grams > 0 }.count }
    var solveKey: String { items.map { ($0.foodId ?? $0.text) + ":" + (gramsText[$0.foodId ?? $0.text] ?? "") }.joined(separator: ",") + "|\(loaded)|\(gen)" }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 10) {
                Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5)
                ZStack { HStack { CloseButton { persist(); dismiss() }; Spacer(); Text(step == .weigh ? "1 of 2" : "2 of 2").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).frame(width: 44, alignment: .trailing) }; Text(step == .weigh ? "What did you weigh?" : "Your day").font(.yumo.title) }
            }.padding(.top, 10).padding(.horizontal, Space.gutter)
            if step == .weigh { weigh } else { day }
        }
        .background(Color.yumo.bg)
        .onAppear(perform: load)
        .task(id: solveKey) { guard loaded else { return }; try? await Task.sleep(for: .milliseconds(200)); guard !Task.isCancelled else { return }; syncGrams(); solve() }
        .pushCover(isPresented: $staplesOpen, onDismiss: { gen += 1 }) { StaplesScreen(back: "I prepped…") }
    }

    // MARK: step 1
    var weigh: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                TextField("Search your staples or the catalogue", text: $query).font(.yumo.bodyStrong).autocorrectionDisabled().submitLabel(.done)
                Button { scanOpen = true } label: { BarcodeGlyph(color: .yumo.ink).scaleEffect(0.5).frame(width: 36, height: 36).background(Circle().fill(Color.yumo.control)) }.buttonStyle(PlainPressStyle()).accessibilityLabel("Scan a barcode")
            }
                .padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
                .padding(.horizontal, Space.gutter).padding(.top, 14)
                .task(id: query) {   // debounced, off the main thread; one scorer for the catalogue and for Open Food Facts (FoodIndex)
                    let q = query.trimmingCharacters(in: .whitespaces); guard !q.isEmpty else { hits = []; online = []; onlineFirst = false; return }
                    try? await Task.sleep(for: .milliseconds(120)); guard !Task.isCancelled else { return }
                    let s = store, snap = FoodIndex.shared.snapshot(s), ex = Set(s.staples().map(\.foodId))
                    let (found, missing) = await Task.detached(priority: .userInitiated) { (snap.search(q, exclude: ex, limit: 40), snap.uncovered(q)) }.value
                    guard !Task.isCancelled else { return }
                    hits = s.foods(ids: found.map(\.id))
                    // the packaged world by name — once the last word is complete (≥ 3 letters) and after a pause; deduped against local rows
                    let lastDone = (q.split(separator: " ").last?.count ?? 0) >= 3
                    guard q.count >= 3, lastDone else { online = []; onlineBusy = false; onlineFirst = false; return }
                    onlineBusy = true
                    try? await Task.sleep(for: .milliseconds(350)); guard !Task.isCancelled else { return }
                    var products = await OpenFoodFacts.search(q, limit: 12)
                    if !missing.isEmpty, missing.joined(separator: " ") != q.lowercased() {   // Open Food Facts' own ranking of a long line drops the bag you mean
                        let have = Set(products.compactMap(\.barcode))
                        products += await OpenFoodFacts.search(missing.joined(separator: " "), limit: 12).filter { $0.barcode.map { !have.contains($0) } ?? true }
                    }
                    guard !Task.isCancelled else { return }
                    let localCodes = Set(hits.compactMap(\.barcode))
                    online = snap.rank(products.filter { $0.barcode.map { !localCodes.contains($0) } ?? true }, query: q)
                    onlineBusy = false; onlineFirst = !missing.isEmpty && !online.isEmpty
                }
                .fullScreenCover(isPresented: $scanOpen) { StapleScanScreen { f in keep(f); scanOpen = false } }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    let q = query.trimmingCharacters(in: .whitespaces).lowercased()
                    let stapleIds = Set(store.staples().map(\.foodId))
                    // FROM THE CATALOGUE: search hits that are not staples, or the weighed extras when there is no query
                    let extras: [Food] = q.isEmpty ? items.compactMap { $0.foodId }.filter { !stapleIds.contains($0) }.compactMap { store.food(id: $0) } : hits
                    if !q.isEmpty, onlineFirst, !online.isEmpty { onlineGroup }
                    if !extras.isEmpty { group(q.isEmpty ? "Also weighed" : "From the catalogue", extras, inStaples: false) }
                    if !q.isEmpty, !onlineFirst, !online.isEmpty { onlineGroup }
                    if !q.isEmpty, online.isEmpty { Text(onlineBusy ? "Looking for packaged products…" : q.count >= 3 ? "No packaged product by that name on Open Food Facts — scan its barcode to add it." : "").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.top, 12).padding(.horizontal, 4) }
                    ForEach([(Balance.Kind.protein, "Proteins"), (.carb, "Carbs"), (.fat, "Fats"), (.veg, "Veg")], id: \.1) { k, label in
                        let list = staples.map(\.1).filter { Balance.classify($0) == k && (q.isEmpty || $0.name.lowercased().contains(q)) }
                        if !list.isEmpty { group(label, list, inStaples: true) }
                    }
                    if !hasStaples {
                        // no page to go to: searching or scanning above adds straight to your staples
                        VStack(alignment: .leading, spacing: 2) { Text("Add your staples first").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.ink); Text("The foods you eat most weeks. Search or scan one above and tap + — Yumo balances from those.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                            .frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20), radius: 20).padding(.top, 16)
                    }
                }.padding(.horizontal, Space.gutter).padding(.bottom, 16)
            }.scrollDismissesKeyboard(.interactively)
            // footer
            VStack(spacing: 10) {
                Text(weighedCount > 0 ? "\(weighedCount) food\(weighedCount == 1 ? "" : "s") weighed · everything else Yumo sizes" : "Nothing weighed yet · Yumo can plan the whole day from your staples").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center)
                PrimaryButton(label: weighedCount > 0 ? "Balance my day" : "Plan it all for me", size: .regular) { open = nil; syncGrams(); solve(); withAnimation(Motion.push) { step = .day } }
            }.padding(EdgeInsets(top: 12, leading: 20, bottom: 24, trailing: 20)).frame(maxWidth: .infinity)
            .background(UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20).fill(Color.yumo.surface).overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 1) }.ignoresSafeArea())
        }
    }
    func group(_ label: String, _ foods: [Food], inStaples: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: label).padding(.top, 16)
            VStack(spacing: 0) { ForEach(foods, id: \.id) { f in weighRow(f, inStaples: inStaples) } }.padding(.leading, 18).listCard(radius: 20)
        }
    }
    func item(_ f: Food) -> PrepItem? { items.first { $0.foodId == f.id } }
    @ViewBuilder func weighRow(_ f: Food, inStaples: Bool) -> some View {
        let it = item(f); let weighed = (it?.grams ?? 0) > 0; let isOpen = open == f.id
        let staple = store.staples().first { $0.foodId == f.id }
        let sub: String = weighed ? ((it?.carried ?? false) ? "same as yesterday" : "weighed today") : inStaples ? [f.detail, staple?.maxG.map { "max \(Fmt.g($0)) g" } ?? ""].filter { !$0.isEmpty }.joined(separator: " · ").ifEmpty(Balance.className(Balance.classify(f))) : [f.detail, "+ keeps it as a staple"].filter { !$0.isEmpty }.joined(separator: " · ")
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Button { toggle(f) } label: {
                    VStack(alignment: .leading, spacing: 1) { Text(f.shortName).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).lineLimit(1); Text(sub).font(.yumo.footnote).foregroundStyle(weighed ? Color.yumo.accent : .yumo.inkMuted).lineLimit(1) }
                        .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }.buttonStyle(PlainPressStyle())
                if weighed {
                    Button { toggle(f) } label: { HStack(spacing: 6) { Text(Fmt.g(it!.grams)).font(.nunito(17, .extrabold)).tabular(); Text("g").font(.nunito(17, .bold)).foregroundStyle(Color.yumo.inkMuted) }.foregroundStyle(Color.yumo.ink).padding(.horizontal, 12).frame(height: 40).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.yumo.accentTint)).overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.yumo.accent, lineWidth: 2)) }.buttonStyle(PlainPressStyle())
                } else { AddCircleButton { if inStaples { toggle(f) } else { keep(f) } } }
            }.padding(.vertical, 11).padding(.trailing, 16)
            Expandable(open: isOpen) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        Text("How much did you weigh?").font(.yumo.caption).foregroundStyle(Color.yumo.ink)
                        Spacer(minLength: 4)
                        InsetField(text: Binding(get: { gramsText[f.id] ?? "" }, set: { gramsText[f.id] = $0 }), unit: "g", width: 104)
                        Button { done(f) } label: { Text("Done").font(.nunito(14, .black)).foregroundStyle(Color.yumo.onAccent).padding(.horizontal, 14).frame(height: 42) }.buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: 3, radius: 12))
                    }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Color.yumo.bg))
                    if weighed { Button { remove(f) } label: { Text("Remove weight").font(.yumo.caption).foregroundStyle(Color.yumo.danger).padding(.vertical, 10).padding(.horizontal, 4) }.buttonStyle(PlainPressStyle()) }
                }.padding(.trailing, 16).padding(.bottom, 12)
            }
        }.hairline()
    }
    /// Search / scan → staple: saved for good, shown in its class group, and the weight field unfolds right away.
    func keep(_ f: Food) {
        store.addStaple(f); gen += 1; query = ""; hits = []; online = []
        if item(f) == nil { items.append(PrepItem(text: f.name, grams: 0, foodId: f.id, carried: false)) }
        withAnimation(Motion.expand) { open = f.id }
        toaster.show("\(f.shortName) is a staple now")
    }
    /// Packaged products found by name on Open Food Facts; + saves the product locally (one row per barcode) and keeps it as a staple.
    var onlineGroup: some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: "Packaged · Open Food Facts").padding(.top, 16)
            VStack(spacing: 0) {
                ForEach(Array(online.enumerated()), id: \.offset) { _, p in
                    HStack(spacing: 12) {
                        if let image = p.image {
                            AsyncImage(url: image) { img in img.resizable().scaledToFill() } placeholder: { Color.yumo.track }
                                .frame(width: 40, height: 40).clipShape(RoundedRectangle(cornerRadius: Radius.thumb, style: .continuous))
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            (Text(p.name).font(.yumo.bodyStrong).foregroundColor(.yumo.ink) + Text([p.brand, p.quantity].compactMap { $0 }.map { "  " + $0 }.joined()).font(.yumo.detail).foregroundColor(.yumo.inkMuted)).lineLimit(1)
                            Text("\(Fmt.k(p.kcal100)) kcal · P \(Fmt.g(p.p100)) · C \(Fmt.g(p.c100)) · F \(Fmt.g(p.f100)) per 100 g").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        AddCircleButton { keep(store.upsert(p.makeFood())) }
                    }.padding(.vertical, 11).padding(.trailing, 16).hairline()
                }
            }.padding(.leading, 18).listCard(radius: 20)
        }
    }
    func toggle(_ f: Food) {
        if item(f) == nil { items.append(PrepItem(text: f.name, grams: 0, foodId: f.id, carried: false)) }
        withAnimation(Motion.expand) { open = open == f.id ? nil : f.id }; query = ""
    }
    func done(_ f: Food) {
        syncGrams()
        withAnimation(Motion.expand) { open = nil }
        if (item(f)?.grams ?? 0) <= 0 { items.removeAll { $0.foodId == f.id } }
    }
    func remove(_ f: Food) { withAnimation(Motion.expand) { open = nil }; items.removeAll { $0.foodId == f.id }; gramsText[f.id] = nil }
    func syncGrams() { for i in items.indices { let key = items[i].foodId ?? items[i].text; if let t = gramsText[key] { let v = Double(t.replacingOccurrences(of: ",", with: ".")) ?? 0; if v != items[i].grams { items[i].grams = v; items[i].carried = false } } } }

    // MARK: step 2
    var day: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let r = result {
                        let t = store.targets(); let goal = t.kcal
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .firstTextBaseline, spacing: 4) { Text(Fmt.k(r.projected.kcal)).font(.nunito(28, .extrabold)).kerning(-0.5).tabular().foregroundStyle(r.statusDanger ? Color.yumo.danger : .yumo.ink); Text("/ \(Fmt.k(goal))").font(.nunito(14, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                                HStack(spacing: 0) {
                                    Text("P ").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) + Text(Fmt.g(r.projected.p)).font(.yumo.caption).foregroundColor(r.projected.p < Double(t.protein) - 5 ? .yumo.danger : .yumo.ink) + Text(" / \(t.protein) · C ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(Fmt.g(r.projected.c)).font(.yumo.caption) + Text(" / \(t.carbs) · F ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(Fmt.g(r.projected.f)).font(.yumo.caption) + Text(" / \(t.fat)").font(.yumo.caption).foregroundColor(.yumo.inkMuted)
                                }.tabular().lineLimit(1).minimumScaleFactor(0.8)
                            }
                            Spacer(minLength: 8)
                            Text(r.status).font(.yumo.caption).foregroundStyle(r.statusDanger ? Color.yumo.danger : .yumo.accent).multilineTextAlignment(.trailing).padding(.horizontal, 10).padding(.vertical, 6).background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(r.statusDanger ? Color.yumo.dangerTint : .yumo.accentTint))
                        }.card(padding: EdgeInsets(top: 14, leading: 18, bottom: 14, trailing: 18), radius: 20)
                        ForEach(r.emptyMeals, id: \.rawValue) { m in
                            let rows = r.items.filter { $0.meal == m && $0.grams > 0 }
                            if !rows.isEmpty { mealCard(m, rows) }
                        }
                        if r.statusDanger, r.status.contains("add a carb or fat staple") {
                            // the day can't land from the staples you have: say so and open the editor right here
                            Button { staplesOpen = true } label: {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 2) { Text("Add a carb or fat staple").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.ink); Text("Yumo only sizes the foods you keep as staples — rice, oats, oil… — so it needs one to fill the rest of the day.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.leading) }
                                    Spacer(); Text("›").font(.nunito(22, .extrabold)).foregroundStyle(Color.yumo.accent)
                                }.frame(maxWidth: .infinity).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20), radius: 20)
                            }.buttonStyle(PlainPressStyle())
                        }
                        Text("Weighed foods are fixed · everything else was sized to land the day").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity).padding(.top, 4)
                    } else { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity).padding(.top, 30) }
                }.padding(.horizontal, Space.gutter).padding(.top, 14).padding(.bottom, 16)
            }
            HStack(spacing: 10) {
                let n = result.map { r in r.emptyMeals.filter { m in r.items.contains { $0.meal == m && $0.grams > 0 } }.count } ?? 0
                PrimaryButton(label: "Log \(n) meal\(n == 1 ? "" : "s")", size: .regular) { logIt() }.frame(maxWidth: .infinity).layoutPriority(2)
                Button { withAnimation(Motion.push) { step = .weigh } } label: { Text("Change").font(.nunito(15, .black)).foregroundStyle(Color.yumo.ink).frame(maxWidth: .infinity).frame(height: 56) }
                    .buttonStyle(LiftButtonStyle(fill: .yumo.bg, edge: .yumo.surfaceEdge, lift: 4, radius: Radius.button)).frame(width: 120)
            }.padding(EdgeInsets(top: 12, leading: 16, bottom: 24, trailing: 16))
            .background(UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20).fill(Color.yumo.surface).overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 1) }.ignoresSafeArea())
        }
    }
    func mealCard(_ m: Meal, _ rows: [Balance.PlanItem]) -> some View {
        let tot = rows.reduce(DayTotals([])) { acc, it in var a = acc; a.kcal += it.food.kcal100 * it.grams / 100; a.p += it.food.p100 * it.grams / 100; a.c += it.food.c100 * it.grams / 100; a.f += it.food.f100 * it.grams / 100; return a }
        return VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text(m.rawValue).font(.nunito(16, .extrabold)); Text("\(Fmt.k(tot.kcal)) kcal").font(.nunito(14, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                Spacer(); Text("P \(Fmt.g(tot.p)) · C \(Fmt.g(tot.c)) · F \(Fmt.g(tot.f))").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
            }.padding(EdgeInsets(top: 11, leading: 0, bottom: 8, trailing: 16)).hairline()
            ForEach(rows) { it in
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) { Text(it.food.shortName).font(.nunito(15, .bold)).lineLimit(1); if !it.food.detail.isEmpty { Text(it.food.detail).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) } }
                    if it.weighed { tag("weighed") }
                    if it.atMax { tag("at max") }
                    Spacer(); Text("\(Fmt.g(it.grams)) g").font(.nunito(15, .extrabold)).tabular()
                }.padding(.vertical, 9).padding(.trailing, 16).hairline()
            }
        }.padding(.leading, 18).listCard(radius: 20)
    }
    func tag(_ t: String) -> some View { Text(t).font(.nunito(11, .extrabold)).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 7).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: Radius.tag).fill(Color.yumo.track)) }

    // MARK: state
    func load() {
        let c = Balance.carriedItems(today: dayKey, store: store)
        let all = store.foods()
        // older items carried only a typed name: resolve them to a food once, drop what no longer resolves
        items = c.items.compactMap { it in var i = it; if i.foodId == nil { i.foodId = TypeToLog.candidates(for: i.text, store: store, all: all).first?.food.id }; return i.foodId == nil ? nil : i }
        carried = c.carried
        for it in items { gramsText[it.foodId ?? it.text] = it.grams > 0 ? Fmt.g(it.grams) : "" }
        loaded = true
    }
    func solve() { guard loaded else { return }; withAnimation(Motion.snap) { result = Balance.solve(dayKey: dayKey, weighed: items, store: store) } }
    func persist() { let p = Balance.prep(dayKey, store: store); p.items = items.filter { $0.grams > 0 }; store.save() }
    func logIt() {
        guard let r = result else { return }
        for it in r.items where it.grams > 0 { _ = store.log(food: it.food, meal: it.meal, dayKey: dayKey, quantity: it.grams / 100, serving: Serving(label: "100 g", grams: 100)) }
        persist(); UINotificationFeedbackGenerator().notificationOccurred(.success); toaster.show("Logged · day at \(Fmt.k(r.projected.kcal))"); session.changed(); dismiss()
    }
}
extension String { func ifEmpty(_ alt: String) -> String { isEmpty ? alt : self } }
