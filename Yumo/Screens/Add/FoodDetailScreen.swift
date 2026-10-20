import SwiftUI
import SwiftData

/// Food detail: serving picker, quantity stepper (0.5 steps, min 0.5), meal segmented; Save / Log; Remove.
struct FoodDetailScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var entry: FoodEntry?; var food: Food; var dayKey: String; var onLogged: (() -> Void)?
    @State private var serving: Serving; @State private var quantity: Double; @State private var meal: Meal
    @State private var showServings = false
    @State private var gramsText = ""
    @State private var nutrientsOpen = false
    @State private var targets: Targets? = nil

    init(entry: FoodEntry, dayKey: String) {
        self.entry = entry; self.food = entry.food ?? Food(name: entry.foodName, source: .user, servings: [], kcal100: 0, p100: 0, c100: 0, f100: 0); self.dayKey = dayKey
        _serving = State(initialValue: Serving(label: entry.servingLabel, grams: entry.servingGrams)); _quantity = State(initialValue: entry.quantity); _meal = State(initialValue: entry.meal)
    }
    init(food: Food, meal: Meal, dayKey: String, onLogged: @escaping () -> Void) {
        self.entry = nil; self.food = food; self.dayKey = dayKey; self.onLogged = onLogged
        _serving = State(initialValue: food.defaultServing); _quantity = State(initialValue: 1); _meal = State(initialValue: meal)
    }
    var grams: Double { serving.grams * quantity }
    var servingOptions: [Serving] { var s = food.servings; if !s.contains(where: { $0.grams == 100 && $0.label.hasSuffix("g") }) { s.append(Serving(label: "100 g", grams: 100)) }; return s }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: entry == nil ? "Search" : Fmt.dayTitle(Date.fromKey(dayKey)), title: "", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGapDense) {
                    Text(food.name).font(.yumo.pageTitle).lineLimit(2)
                    SourceLine(text: food.sourceLine, explainer: food.tier == .generic ? "Canonical entry from USDA FoodData Central (Foundation Foods / SR Legacy), public domain. Values per 100 g; raw and cooked are separate entries, never a multiplier." : food.tier == .branded ? "Branded product from \(food.source == .off ? "Open Food Facts (ODbL, crowd-sourced; values can be sparse)" : "USDA Branded Foods") keyed by its barcode. Cached on this phone; refreshed after 30 days." : "You created this food. Edit it from Settings › My foods.")
                    if food.state == "raw" { Text("Weighed raw. Cooked? Pick the cooked entry.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    if food.macrosUnknown { Text("This chain publishes calories only. Protein, carbs and fat are not counted for this item.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(food.kcal(for: grams))).font(.nunito(56, .extrabold)).kerning(-1.5).tabular(); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        HStack(spacing: Space.gridGap) { macro("Protein", food.p100); macro("Carbs", food.c100); macro("Fat", food.f100) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card().padding(.top, 8)
                    ListCard {
                        SettingsRow(label: "Amount", sub: "1 serving = \(Fmt.g(serving.grams)) \(unit)") { InsetField(text: $gramsText, unit: unit) }.hairline()
                        SettingsRow(label: "Servings", sub: "steps of ½") {
                            HStack(spacing: 8) {
                                Button { showServings = true } label: { Text(serving.label).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }.buttonStyle(PlainPressStyle())
                                ValueStepper(value: quantity.formatted(.number.precision(.fractionLength(0...2))), onMinus: { setQuantity((max(0.5, quantity - 0.5) * 2).rounded() / 2) }, onPlus: { setQuantity(((quantity + 0.5) * 2).rounded() / 2) })
                            }
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
        .confirmationDialog("Serving", isPresented: $showServings, titleVisibility: .visible) { ForEach(servingOptions, id: \.self) { s in Button(s.label) { serving = s; setQuantity(quantity) } } }
        .onAppear { gramsText = Fmt.g(grams); targets = Store(ctx).targets() }
        .onChange(of: gramsText) { if let g = Double(gramsText), g > 0, abs(g - grams) > 0.01 { quantity = g / serving.grams } }
        .scrollDismissesKeyboard(.interactively)
    }
    var unit: String { serving.label.hasSuffix(" ml") ? "ml" : "g" }
    func setQuantity(_ q: Double) { quantity = q; gramsText = Fmt.g(serving.grams * q) }
    func macro(_ l: String, _ per100: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(l).font(.yumo.captionLight).foregroundStyle(Color.yumo.inkMuted); Text(food.macrosUnknown ? "—" : "\(Fmt.g(per100 * grams / 100)) g").font(.yumo.stat).tabular() }.frame(maxWidth: .infinity, alignment: .leading)
    }
    func save() {
        let s = Store(ctx)
        if let e = entry {
            e.servingLabel = serving.label; e.servingGrams = serving.grams; e.quantity = quantity; s.save()
            toaster.show("Saved \(food.name)")
        } else {
            _ = s.log(food: food, meal: meal, dayKey: dayKey, quantity: quantity, serving: serving); toaster.show("\(food.name) → \(meal.rawValue)")
        }
        session.changed(); dismiss(); onLogged?()
    }
}
