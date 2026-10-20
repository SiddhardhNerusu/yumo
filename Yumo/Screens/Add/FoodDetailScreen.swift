import SwiftUI
import SwiftData

/// Food detail (20 Oct): name + state in grey · source · "Switch to cooked?" (the link opens the catalogue's everyday cooked row; "Switch to raw?" on a cooked row) · kcal + macros · Amount in grams (100 g for anything you weigh) · Servings (unit picker + ½ steps) · Nutrients · Log / Save · Remove.
struct FoodDetailScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    var entry: FoodEntry?; var dayKey: String; var onLogged: (() -> Void)?
    @State var food: Food
    @State private var serving: Serving; @State private var quantity: Double; @State private var meal: Meal
    @State private var siblings: [Food] = []   // the same food in its other states, raw first
    @State private var sibling: Food? = nil    // pushed "did you mean" page
    @State private var showServings = false
    @State private var gramsText = ""
    @State private var nutrientsOpen = false
    @State private var targets: Targets? = nil

    init(entry: FoodEntry, dayKey: String) {
        self.entry = entry; _food = State(initialValue: entry.food ?? Food(name: entry.foodName, source: .user, servings: [], kcal100: 0, p100: 0, c100: 0, f100: 0)); self.dayKey = dayKey
        _serving = State(initialValue: Serving(label: entry.servingLabel, grams: entry.servingGrams)); _quantity = State(initialValue: entry.quantity); _meal = State(initialValue: entry.meal)
    }
    /// `grams`: a "did you mean" page opens on the grams you had typed on the other state's page.
    init(food: Food, meal: Meal, dayKey: String, grams: Double? = nil, onLogged: @escaping () -> Void) {
        self.entry = nil; _food = State(initialValue: food); self.dayKey = dayKey; self.onLogged = onLogged
        let (sv, q) = grams == nil ? food.quickAmount : (Self.plain, grams! / 100)
        _serving = State(initialValue: sv); _quantity = State(initialValue: q); _meal = State(initialValue: meal)
    }
    var grams: Double { serving.grams * quantity }
    static let plain = Serving(label: "100 g", grams: 100)
    /// The one other state worth offering: raw → the most everyday cooked method; cooked → raw.
    static let methodOrder = ["Grilled", "Roasted", "Baked", "Boiled", "Cooked", "Fried", "Steamed", "Poached", "Braised", "Stewed", "Microwaved", "Barbecued"]
    var switchTarget: Food? {
        let here = food.stateLabel
        if here == "Raw" || here == "Dry" { return siblings.min { (Self.methodOrder.firstIndex(of: $0.stateLabel ?? "") ?? 99) < (Self.methodOrder.firstIndex(of: $1.stateLabel ?? "") ?? 99) } }
        return siblings.first { $0.stateLabel == "Raw" || $0.stateLabel == "Dry" }
    }
    /// 100 g first, then the row's named units ("1 medium · 118 g", "1 breast · 174 g") — the Servings picker.
    var servingOptions: [Serving] { var s = [Self.plain]; for sv in food.servings where !(sv.grams == 100 && sv.label.hasSuffix(" g")) { s.append(sv) }; return s }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: entry == nil ? "Search" : Fmt.dayTitle(Date.fromKey(dayKey)), title: "", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGapDense) {
                    (Text(food.name).font(.yumo.pageTitle) + Text(food.state.map { ", " + $0 } ?? "").font(.yumo.pageTitle).foregroundColor(.yumo.inkMuted)).lineLimit(3)
                    SourceLine(text: food.sourceLine, explainer: food.tier == .generic ? "Canonical entry from USDA FoodData Central (Foundation Foods / SR Legacy), public domain. Values per 100 g; raw and cooked are separate entries, never a multiplier." : food.tier == .branded ? "Branded product from \(food.source == .off ? "Open Food Facts (ODbL, crowd-sourced; values can be sparse)" : "USDA Branded Foods") keyed by its barcode. Cached on this phone; refreshed after 30 days." : "You created this food. Edit it from Settings › My foods.")
                    if let other = switchTarget {
                        // one sentence, one link: "Switch to cooked?" — the everyday method when the catalogue has several (grilled before braised)
                        let toRaw = other.stateLabel == "Raw" || other.stateLabel == "Dry"
                        Button { sibling = other } label: {
                            (Text("Switch to ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(toRaw ? "raw" : "cooked").font(.yumo.action).foregroundColor(.yumo.accent) + Text("?").font(.yumo.caption).foregroundColor(.yumo.inkMuted))
                        }.buttonStyle(PlainPressStyle())
                    }
                    if food.macrosUnknown { Text("This chain publishes calories only. Protein, carbs and fat are not counted for this item.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(food.kcal(for: grams))).font(.nunito(56, .extrabold)).kerning(-1.5).tabular(); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        HStack(spacing: Space.gridGap) { macro("Protein", food.p100); macro("Carbs", food.c100); macro("Fat", food.f100) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card().padding(.top, 8)
                    ListCard {
                        SettingsRow(label: "Amount", sub: "type what you weighed") { InsetField(text: $gramsText, unit: unit) }.hairline()
                        SettingsRow(label: "Servings", sub: "steps of ½") {
                            HStack(spacing: 8) {
                                // the unit picker: plain muted text + accent ▾ (a box reads like a field you can type into)
                                Button { showServings = true } label: { HStack(spacing: 3) { Text(serving.label).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(1).fixedSize(); Text("▾").font(.nunito(12, .extrabold)).foregroundStyle(Color.yumo.accent).fixedSize() }.frame(height: 36).contentShape(Rectangle()) }.buttonStyle(PlainPressStyle()).layoutPriority(1)   // the unit never collapses; the row's label truncates instead
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
        .pushCover(item: $sibling) { g in FoodDetailScreen(food: g, meal: meal, dayKey: dayKey, grams: grams, onLogged: { dismiss(); onLogged?() }) }
        .onAppear { gramsText = Fmt.g(grams); targets = Store(ctx).targets(); siblings = Store(ctx).siblings(of: food) }
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
            e.food = food; e.foodName = food.name; e.servingLabel = serving.label; e.servingGrams = serving.grams; e.quantity = quantity; s.save()
            toaster.show("Saved \(food.name)")
        } else {
            _ = s.log(food: food, meal: meal, dayKey: dayKey, quantity: quantity, serving: serving); toaster.show("\(food.name) → \(meal.rawValue)")
        }
        session.changed(); dismiss(); onLogged?()
    }
}
