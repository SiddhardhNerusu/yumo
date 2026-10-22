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
    private var orphan = false   // the entry's food was deleted: the page shows its kept values, and Save never brings the food back
    private var lost = false     // deleted before entries kept values: the numbers are unknown — "—", never 0

    init(entry: FoodEntry, dayKey: String) {
        orphan = entry.food == nil; lost = entry.lost
        self.entry = entry; _food = State(initialValue: entry.food ?? { let k = entry.kept; let f = Food(name: entry.foodName, source: .user, servings: [], kcal100: k?.kcal ?? 0, p100: k?.p ?? 0, c100: k?.c ?? 0, f100: k?.f ?? 0); f.micros = k?.micros ?? [:]; f.macrosUnknown = k?.macrosUnknown ?? false; f.state = k?.state; return f }()); self.dayKey = dayKey
        _serving = State(initialValue: Serving(label: entry.servingLabel, grams: entry.servingGrams)); _quantity = State(initialValue: entry.quantity); _meal = State(initialValue: entry.meal)
    }
    /// `grams`: a "did you mean" page opens on the grams you had typed on the other state's page.
    init(food: Food, meal: Meal, dayKey: String, grams: Double? = nil, onLogged: @escaping () -> Void) {
        self.entry = nil; _food = State(initialValue: food); self.dayKey = dayKey; self.onLogged = onLogged
        let (sv, q) = grams == nil ? food.quickAmount : (food.plainServing, grams! / food.plainServing.grams)
        _serving = State(initialValue: sv); _quantity = State(initialValue: q); _meal = State(initialValue: meal)
    }
    /// "Switch to cooked?" on a logged entry: the same entry in the other state, on the grams you had. Save swaps it in place.
    init(entry: FoodEntry, switchingTo food: Food, dayKey: String, grams: Double, onDone: @escaping () -> Void) {
        self.entry = entry; _food = State(initialValue: food); self.dayKey = dayKey; self.onLogged = onDone
        _serving = State(initialValue: food.plainServing); _quantity = State(initialValue: grams / food.plainServing.grams); _meal = State(initialValue: entry.meal)
    }
    var grams: Double { serving.grams * quantity }
    /// The one other state worth offering: raw → the most everyday cooked method; cooked → raw.
    static let methodOrder = ["Grilled", "Roasted", "Toasted", "Baked", "Boiled", "Cooked", "Fried", "Steamed", "Poached", "Braised", "Stewed", "Microwaved", "Barbecued"]
    var switchTarget: Food? {
        let here = food.stateLabel
        if here == "Raw" || here == "Dry" { return siblings.min { (Self.methodOrder.firstIndex(of: $0.stateLabel ?? "") ?? 99) < (Self.methodOrder.firstIndex(of: $1.stateLabel ?? "") ?? 99) } }
        return siblings.first { $0.stateLabel == "Raw" || $0.stateLabel == "Dry" }
    }
    /// 100 g first, then the row's named units ("1 medium · 118 g", "1 breast · 174 g") — the Servings picker.
    var servingOptions: [Serving] { let plain = food.plainServing, quick = food.quickServing; var s = quick.label == plain.label ? [plain] : [quick, plain]; for sv in food.servings where sv.label != plain.label && sv.label != quick.label && !(sv.grams == 100 && sv.label.hasSuffix(" g")) { s.append(sv) }; return s }   // the portion first, then 100 g, then the row's named units

    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: entry == nil ? "Search" : Fmt.dayTitle(Date.fromKey(dayKey)), title: "", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGapDense) {
                    (Text(food.name).font(.yumo.pageTitle) + Text(food.state.map { ", " + $0 } ?? "").font(.yumo.pageTitle).foregroundColor(.yumo.inkMuted)).lineLimit(3)
                    SourceLine(text: orphan ? "Your food · deleted" : food.sourceLine, explainer: sourceExplainer)
                    if let other = switchTarget {
                        // one sentence, one link: "Switch to cooked?" — the everyday method when the catalogue has several (grilled before braised)
                        let toRaw = other.stateLabel == "Raw" || other.stateLabel == "Dry"
                        Button { sibling = other } label: {
                            (Text("Switch to ").font(.yumo.caption).foregroundColor(.yumo.inkMuted) + Text(toRaw ? "raw" : "cooked").font(.yumo.action).foregroundColor(.yumo.accent) + Text("?").font(.yumo.caption).foregroundColor(.yumo.inkMuted))
                        }.buttonStyle(PlainPressStyle())
                    }
                    if food.macrosUnknown && !lost { Text("This chain publishes calories only. Protein, carbs and fat are not counted for this item.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(lost ? "—" : Fmt.k(food.kcal(for: grams))).font(.nunito(56, .extrabold)).kerning(-1.5).tabular(); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        HStack(spacing: Space.gridGap) { macro("Protein", food.p100); macro("Carbs", food.c100); macro("Fat", food.f100) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card().padding(.top, 8)
                    ListCard {
                        SettingsRow(label: "Amount", sub: unit == "ml" ? "type what you poured" : "type what you weighed") { InsetField(text: $gramsText, unit: unit) }.hairline()
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
                    if let e = entry { HStack { Spacer(); TextAction(label: "Remove from \(e.meal.rawValue)", danger: true) { let name = e.foodName; Store(ctx).remove(e); toaster.show("Removed \(name)"); session.changed(); dismiss(); onLogged?() }; Spacer() }.padding(.top, 4) }
                }.padding(.horizontal, Space.gutter).padding(.bottom, 40)
            }
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .confirmationDialog("Serving", isPresented: $showServings, titleVisibility: .visible) { ForEach(servingOptions, id: \.self) { s in Button(s.label) { serving = s; setQuantity(quantity) } } }
        .pushCover(item: $sibling) { g in
            if let e = entry { FoodDetailScreen(entry: e, switchingTo: g, dayKey: dayKey, grams: grams, onDone: { dismiss(); onLogged?() }) }
            else { FoodDetailScreen(food: g, meal: meal, dayKey: dayKey, grams: grams, onLogged: { dismiss(); onLogged?() }) }
        }
        .onAppear { gramsText = Fmt.g(amount); targets = Store(ctx).targets(); siblings = Store(ctx).siblings(of: food) }
        .onChange(of: gramsText) { if let v = Double(gramsText), v > 0, abs(v - amount) > 0.01 { quantity = v / perServing } }
        .scrollDismissesKeyboard(.interactively).scrollBounceBehavior(.always)
    }
    var sourceExplainer: String {
        switch food.tier {
        case .generic:
            let from = food.source == .cofid ? "the UK's CoFID tables (McCance and Widdowson's, Open Government Licence)" : "USDA FoodData Central (Foundation Foods / SR Legacy), public domain"
            let drink = food.mlDensity.map { " Logged in ml: 100 ml of it weighs \(String(format: "%.1f", 100 * $0)) g, worked out from its water, protein, fat and sugar." } ?? ""
            let convention = food.source == .cofid ? "" : " Carbs exclude fibre and energy is protein × 4, fat × 9, carbs × 3.75 — the UK convention, converted from USDA's figures, which count fibre inside carbs."
            return "Canonical entry from \(from). Values per 100 g; raw and cooked are separate entries, never a multiplier." + convention + drink
        case .branded:
            return "Branded product from \(food.source == .off ? "Open Food Facts (ODbL, crowd-sourced; values can be sparse)" : "USDA Branded Foods") keyed by its barcode." + (food.mlDensity != nil ? " Values per 100 ml, as on the label." : "") + " Cached on this phone; refreshed after 30 days."
        case .chain:
            return "From \(food.brand ?? "the chain")'s own published nutrition information; the line above names the document and its date."
        case .user:
            return lost ? "You deleted this food before Yumo kept its values, so this entry's numbers are unknown." : orphan ? "You deleted this food. This entry keeps the values it had." : "You created this food. Edit it from Settings › My foods."
        }
    }
    var unit: String { serving.ml != nil ? "ml" : "g" }
    /// One serving in the unit the field shows: ml for a drink (its grams are what that volume weighs), else grams.
    var perServing: Double { serving.ml ?? serving.grams }
    var amount: Double { perServing * quantity }
    func setQuantity(_ q: Double) { quantity = q; gramsText = Fmt.g(perServing * q) }
    func macro(_ l: String, _ per100: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text(l).font(.yumo.captionLight).foregroundStyle(Color.yumo.inkMuted); Text(food.macrosUnknown || lost ? "—" : "\(Fmt.g(per100 * grams / 100)) g").font(.yumo.stat).tabular() }.frame(maxWidth: .infinity, alignment: .leading)
    }
    func save() {
        let s = Store(ctx)
        if let e = entry {
            if !orphan {   // a deleted food's stand-in is never attached — saving would insert it again (22 Oct review)
                if let old = e.food, old.id != food.id { s.switchFood(of: e, from: old, to: food) }   // switched raw ↔ cooked: the entry changes food, the use moves with it
                e.food = food; e.foodName = food.name
                food.lastServingLabel = serving.label; food.lastServingGrams = serving.grams; food.lastQuantity = quantity   // an edited amount is the one you want next time
            }
            e.servingLabel = serving.label; e.servingGrams = serving.grams; e.quantity = quantity
            s.save()
            toaster.show("Saved \(food.name)")
        } else {
            _ = s.log(food: food, meal: meal, dayKey: dayKey, quantity: quantity, serving: serving); toaster.show("\(food.name) → \(meal.rawValue)")
        }
        session.changed(); dismiss(); onLogged?()
    }
}
