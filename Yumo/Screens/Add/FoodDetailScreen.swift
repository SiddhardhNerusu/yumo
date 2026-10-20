import SwiftUI
import SwiftData

/// Food detail (20 Oct): name + state in grey · source · Raw · Grilled · Braised switch when the catalogue has the food in other states ·
/// kcal + macros · Amount in grams (100 g for anything you weigh) with portion chips for things you count · Nutrients · Log / Save · Remove.
struct FoodDetailScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var entry: FoodEntry?; var dayKey: String; var onLogged: (() -> Void)?
    @State var food: Food
    @State private var serving: Serving; @State private var quantity: Double; @State private var meal: Meal
    @State private var states: [Food] = []     // this food + its siblings in other states, raw first
    @State private var gramsText = ""
    @State private var nutrientsOpen = false
    @State private var targets: Targets? = nil

    init(entry: FoodEntry, dayKey: String) {
        self.entry = entry; _food = State(initialValue: entry.food ?? Food(name: entry.foodName, source: .user, servings: [], kcal100: 0, p100: 0, c100: 0, f100: 0)); self.dayKey = dayKey
        _serving = State(initialValue: Serving(label: entry.servingLabel, grams: entry.servingGrams)); _quantity = State(initialValue: entry.quantity); _meal = State(initialValue: entry.meal)
    }
    init(food: Food, meal: Meal, dayKey: String, onLogged: @escaping () -> Void) {
        self.entry = nil; _food = State(initialValue: food); self.dayKey = dayKey; self.onLogged = onLogged
        _serving = State(initialValue: food.quickServing); _quantity = State(initialValue: 1); _meal = State(initialValue: meal)
    }
    var grams: Double { serving.grams * quantity }
    static let plain = Serving(label: "100 g", grams: 100)

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: entry == nil ? "Search" : Fmt.dayTitle(Date.fromKey(dayKey)), title: "", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGapDense) {
                    (Text(food.name).font(.yumo.pageTitle) + Text(food.state.map { ", " + $0 } ?? "").font(.yumo.pageTitle).foregroundColor(.yumo.inkMuted)).lineLimit(3)
                    SourceLine(text: food.sourceLine, explainer: food.tier == .generic ? "Canonical entry from USDA FoodData Central (Foundation Foods / SR Legacy), public domain. Values per 100 g; raw and cooked are separate entries, never a multiplier." : food.tier == .branded ? "Branded product from \(food.source == .off ? "Open Food Facts (ODbL, crowd-sourced; values can be sparse)" : "USDA Branded Foods") keyed by its barcode. Cached on this phone; refreshed after 30 days." : "You created this food. Edit it from Settings › My foods.")
                    if states.count > 1 {
                        // the state switch: the catalogue row for the same food raw / grilled / braised… — a different row, never a multiplier
                        Segmented(options: states.prefix(4).map { ($0.id, $0.stateLabel ?? "—") }, selection: Binding(get: { food.id }, set: { id in if let g = states.first(where: { $0.id == id }) { switchTo(g) } }), compact: true).padding(.top, 2)
                    }
                    if food.macrosUnknown { Text("This chain publishes calories only. Protein, carbs and fat are not counted for this item.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(food.kcal(for: grams))).font(.nunito(56, .extrabold)).kerning(-1.5).tabular(); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        HStack(spacing: Space.gridGap) { macro("Protein", food.p100); macro("Carbs", food.c100); macro("Fat", food.f100) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card().padding(.top, 8)
                    ListCard {
                        let portions = food.portions
                        SettingsRow(label: "Amount", sub: portions.isEmpty ? "per 100 \(unit) · type what you weighed" : "or tap a portion") { InsetField(text: $gramsText, unit: unit) }
                        if !portions.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(portions, id: \.self) { sv in
                                        let on = serving == sv && quantity == 1
                                        Button { serving = sv; quantity = 1; gramsText = Fmt.g(sv.grams) } label: { Text(sv.label).font(.yumo.segment).tabular().foregroundStyle(on ? Color.yumo.onAccent : .yumo.ink).padding(.horizontal, 12).frame(height: 32).background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(on ? Color.yumo.accent : .yumo.track)) }.buttonStyle(PlainPressStyle())
                                    }
                                }.padding(.trailing, Space.cardPad)
                            }.padding(.bottom, 12)
                        }
                    }
                    Button { withAnimation(Motion.snap) { nutrientsOpen.toggle() } } label: {
                        VStack(spacing: 0) {
                            HStack { Text("Nutrients").font(.yumo.title); Spacer(); Text(nutrientsOpen ? "⌄" : "›").font(.yumo.title).foregroundStyle(Color.yumo.inkMuted) }.padding(.vertical, 14).padding(.trailing, Space.cardPad)
                            if nutrientsOpen {
                                ForEach(Nutrients.all) { n in
                                    let v = food.micros[n.key].map { $0 * grams / 100 }
                                    let goal = targets.flatMap { t in Nutrients.target(n, profile: Store(ctx).profile(), kcal: t.kcal).0 }
                                    HStack { Text(n.name).font(.yumo.body); Spacer(); Text(v.map { "\(Nutrients.format($0, unit: n.unit)) \(n.unit)" } ?? "—").font(.yumo.body).tabular(); if let v, let goal, goal > 0 { Text("\(Int((v / goal * 100).rounded())) %").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).frame(width: 44, alignment: .trailing) } }
                                        .padding(.vertical, 8).padding(.trailing, Space.cardPad).overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
                                }
                            }
                        }.foregroundStyle(Color.yumo.ink)
                    }.buttonStyle(PlainPressStyle()).padding(.leading, Space.cardPad).listCard()
                    PrimaryButton(label: entry == nil ? "Log" : "Save", action: save).padding(.top, 8)
                    if let e = entry { HStack { Spacer(); TextAction(label: "Remove from \(e.meal.rawValue)", danger: true) { Store(ctx).remove(e); toaster.show("Removed \(e.foodName)"); session.changed(); dismiss() }; Spacer() }.padding(.top, 4) }
                }.padding(.horizontal, Space.gutter).padding(.bottom, 40)
            }
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .onAppear { gramsText = Fmt.g(grams); targets = Store(ctx).targets(); states = [food] + Store(ctx).siblings(of: food) }
        .onChange(of: gramsText) { if let g = Double(gramsText), g > 0, abs(g - grams) > 0.01 { serving = Self.plain; quantity = g / 100 } }   // typing grams always logs in grams
        .scrollDismissesKeyboard(.interactively)
    }
    var unit: String { serving.label.hasSuffix(" ml") ? "ml" : "g" }
    /// Raw → Grilled: the other catalogue row, same grams. The page re-renders for the new food; states keep their order.
    func switchTo(_ g: Food) {
        let keep = grams
        withAnimation(Motion.snap) { food = g }
        serving = Self.plain; quantity = keep / 100; gramsText = Fmt.g(keep)
    }
    func macro(_ l: String, _ per100: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(l).font(.yumo.captionLight).foregroundStyle(Color.yumo.inkMuted); Text(food.macrosUnknown ? "—" : "\(Fmt.g(per100 * grams / 100)) g").font(.yumo.stat).tabular() }.frame(maxWidth: .infinity, alignment: .leading)
    }
    func save() {
        let s = Store(ctx)
        if let e = entry {
            e.food = food; e.foodName = food.name; e.servingLabel = serving.label; e.servingGrams = serving.grams; e.quantity = quantity; s.save()
            toaster.show("Saved \(food.name)")
        } else {
            _ = s.log(food: food, meal: meal, dayKey: dayKey, quantity: quantity, serving: serving); toaster.show("\(food.name) → \(meal.rawValue)")
        }
        session.changed(); dismiss(); onLogged?()
    }
}
