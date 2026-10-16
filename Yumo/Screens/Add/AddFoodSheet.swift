import SwiftUI
import SwiftData

/// Add food: pick (two tiles) → scan (camera + Found card) | search (field + results). One sheet, three steps.
struct AddFoodSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State var meal: Meal
    var dayKey: String
    enum Step { case pick, scan, search }
    @State private var step: Step = .pick
    @State private var detent: PresentationDetent = .height(300)
    @State private var query = ""
    @State private var local: [Food] = []
    @State private var remote: [OpenFoodFacts.Product] = []
    @State private var searching = false
    @State private var found: Found? = nil
    @State private var create: CreateFoodDraft? = nil
    @State private var detailFood: Food? = nil
    @State private var torch = false
    @State private var searchTask: Task<Void, Never>?
    @State private var scanOpen = false
    @State private var yourFoods: [Food] = []; @State private var generic: [Food] = []; @State private var chains: [Food] = []; @State private var branded: [Food] = []
    @State private var brandedOpen = false      // the explicit "Search branded" toggle: only then do live Open Food Facts results appear
    @FocusState private var focused: Bool
    struct Found: Identifiable { var id = UUID(); var barcode: String; var food: Food? }

    var store: Store { Store(ctx) }
    var title: String { "Add to \(meal.rawValue)" }
    /// Mode is decided by the text: a digit anywhere (and not a bare barcode) → type-to-log.
    var typed: Bool { let q = query.trimmingCharacters(in: .whitespaces); return TypeToLog.hasNumbers(q) && !(q.count >= 8 && q.allSatisfy(\.isNumber)) }

    var body: some View {
        VStack(spacing: 0) {
            switch step {
            case .pick: pick
            case .scan: pick
            case .search: search
            }
        }
        .background(Color.yumo.bg)
        .presentationDetents([.height(300), .large], selection: $detent)
        .presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden)
        .fullScreenCover(isPresented: $scanOpen) { scan }
        .sheet(item: $create) { d in CreateFoodScreen(draft: d) { f in log(f, serving: f.defaultServing, qty: 1) } }
        .fullScreenCover(item: $detailFood) { f in FoodDetailScreen(food: f, meal: meal, dayKey: dayKey) { dismiss() } }
    }

    // MARK: pick
    var pick: some View {
        VStack(spacing: 0) {
            SheetHeader(title: title, onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            HStack(spacing: 12) {
                Button { go(.scan) } label: { VStack(spacing: 12) { BarcodeGlyph(color: .white); Text("Scan barcode").font(.yumo.tile).foregroundStyle(.white) }.frame(maxWidth: .infinity).frame(height: 120) }
                    .buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: Lift.primary, radius: Radius.card))
                Button { go(.search) } label: { VStack(spacing: 8) { KeyboardGlyph(color: .yumo.ink); Text("Type it").font(.yumo.tile).foregroundStyle(Color.yumo.ink); Text("chicken 180 rice 150").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) }.frame(maxWidth: .infinity).frame(height: 120) }
                    .buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: Lift.card, radius: Radius.card))
            }.padding(.horizontal, Space.gutter).padding(.top, 16)
            Spacer()
        }
    }
    func go(_ s: Step) {
        if s == .scan { scanOpen = true; return }
        scanOpen = false
        withAnimation(Motion.sheet) { step = s; detent = s == .pick ? .height(300) : .large }
        if s == .search { yourFoods = store.mostLogged(); generic = []; branded = []; focused = true }
    }

    // MARK: scan (full screen, rev 2): plain ✕, flashlight icon, corner brackets, no text, brackets go accent on read
    var scan: some View {
        ZStack {
            BarcodeScannerView(torch: torch) { code in handleBarcode(code) }.ignoresSafeArea()
            Color.yumo.scanMask.ignoresSafeArea().mask { Rectangle().overlay { RoundedRectangle(cornerRadius: 22).frame(width: 300, height: 190).offset(y: -40).blendMode(.destinationOut) }.compositingGroup() }
            CornerBrackets(locked: found != nil).frame(width: 300, height: 190).offset(y: -40)
            VStack(spacing: 0) {
                ZStack {
                    HStack {
                        Button { scanOpen = false } label: { Text("✕").font(.nunito(22, .extrabold)).foregroundStyle(.white).frame(width: 44, height: 44) }.buttonStyle(PlainPressStyle())
                        Spacer()
                        Button { torch.toggle() } label: { TorchIcon(on: torch).frame(width: 44, height: 44) }.buttonStyle(PlainPressStyle())
                    }
                    Text(title).font(.yumo.title).foregroundStyle(.white)
                }.padding(.horizontal, Space.gutter).padding(.top, 12)
                Spacer()
                if let f = found { FoundCardView(found: f, meal: meal, onRescan: { found = nil }, onLog: { food in log(food, serving: food.defaultServing, qty: 1) }, onCreate: { create = CreateFoodDraft(barcode: f.barcode); found = nil; scanOpen = false }).padding(.horizontal, 12).padding(.bottom, 12).transition(.move(edge: .bottom)) }
                Button { scanOpen = false; go(.search) } label: { Text("Type barcode or search instead").font(.yumo.action).underline().foregroundStyle(.white) }.buttonStyle(PlainPressStyle()).padding(.bottom, 16)
                Segmented(options: Meal.allCases.map { ($0, $0.rawValue) }, selection: $meal, dark: true).padding(.horizontal, Space.gutter).padding(.bottom, 48)
            }
        }
        .background(Color.black.ignoresSafeArea())
    }
    func handleBarcode(_ code: String) {
        guard found == nil else { return }
        let s = store
        if let f = s.food(barcode: code) { withAnimation(Motion.snap) { found = Found(barcode: code, food: f) }; return }
        withAnimation(Motion.snap) { found = Found(barcode: code, food: nil) }
        Task {
            var hit = await OpenFoodFacts.barcode(code); if hit == nil { hit = await USDABranded.barcode(code) }
            if let p = hit { let f = s.upsert(p.makeFood()); withAnimation(Motion.snap) { found = Found(barcode: code, food: f) } }
            else { lookedUp.insert(code); PendingLookups.add(code) }
        }
    }
    @State private var lookedUp: Set<String> = []

    // MARK: search
    var search: some View {
        VStack(spacing: 0) {
            SheetHeader(title: title, onClose: { dismiss() }) { Button { go(.scan) } label: { BarcodeGlyph(color: .yumo.ink).scaleEffect(0.5).frame(width: 44, height: 44).background(Circle().fill(Color.yumo.control)) }.buttonStyle(PlainPressStyle()) }
            HStack(spacing: 10) {
                MagnifierGlyph(color: .yumo.inkMuted, size: 18)
                TextField("chicken 180 rice 150 — or a name", text: $query).font(.yumo.body).focused($focused).submitLabel(.search).autocorrectionDisabled()
            }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
                .padding(.horizontal, Space.gutter).padding(.top, 14)
            if !store.profile().typeItHintSeen { Text("Foods and grams in one line. I learn your shorthand as we go — first time, I ask.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, Space.gutter + 4).padding(.top, 8) }
            Segmented(options: Meal.allCases.map { ($0, $0.rawValue) }, selection: $meal, compact: true).padding(.horizontal, Space.gutter).padding(.top, 10)
            if typed {
                // Type-to-log (README §4a): the line has numbers → rows, ask / learned, Log N foods
                ScrollView { TypeItView(line: query, meal: meal, dayKey: dayKey, onSearchAll: { w in query = w }, onLogged: { n in toaster.show("\(n) food\(n == 1 ? "" : "s") → \(meal.rawValue)"); session.changed(); dismiss() }).padding(.horizontal, Space.gutter).padding(.vertical, 14).padding(.bottom, 40) }.scrollDismissesKeyboard(.interactively)
            } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if !yourFoods.isEmpty { group("Your foods", yourFoods) }
                    if !generic.isEmpty { group("Generic", generic) }
                    if !chains.isEmpty { group("Chains", chains) }
                    if !branded.isEmpty { group("Scanned products", branded) }
                    if yourFoods.isEmpty && generic.isEmpty && chains.isEmpty && branded.isEmpty && !query.isEmpty && !brandedOpen {
                        Text("No generic match for \"\(query)\".").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 8)
                    }
                    if !query.isEmpty {
                        if brandedOpen {
                            Overline(text: "Branded · Open Food Facts").padding(.top, 4)
                            if remote.isEmpty && !searching { Text("No branded match. Scan the barcode for an exact product.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }
                            else { VStack(spacing: 0) { ForEach(Array(remote.enumerated()), id: \.offset) { _, p in ResultRow(name: p.name, brand: p.brand, meta: "100 g · P \(Fmt.g(p.p100)) · C \(Fmt.g(p.c100)) · F \(Fmt.g(p.f100))", kcal: p.kcal100 * p.servings[0].grams / 100, onAdd: { let f = store.upsert(p.makeFood()); log(f, serving: f.defaultServing, qty: 1) }, onOpen: { detailFood = store.upsert(p.makeFood()) }) } }.padding(.leading, Space.cardPad).listCard() }
                            if searching { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity) }
                        } else {
                            // Generic words keep branded noise out; one quiet line brings it in when wanted.
                            HStack(spacing: 4) { Text("Looking for a packaged product?").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted); TextAction(label: "Show branded") { brandedOpen = true; runBranded() } }
                        }
                    }
                    HStack(spacing: 4) { Text(query.isEmpty ? "" : "Still not here?").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted); TextAction(label: "Create a food") { create = CreateFoodDraft(name: query.allSatisfy(\.isNumber) ? "" : query, barcode: query.allSatisfy(\.isNumber) && query.count >= 8 ? query : nil) } }.padding(.top, 4)
                }.padding(.horizontal, Space.gutter).padding(.vertical, 14).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
            }
        }
        .onChange(of: query) { runSearch() }
        .onAppear { if yourFoods.isEmpty && query.isEmpty { yourFoods = store.mostLogged() } }
    }
    func group(_ title: String, _ foods: [Food]) -> some View {
        VStack(alignment: .leading, spacing: 8) { Overline(text: title).padding(.top, 4); VStack(spacing: 0) { ForEach(foods, id: \.id) { f in row(f) } }.padding(.leading, Space.cardPad).listCard() }
    }
    func row(_ f: Food) -> some View {
        let g = f.tier == .chain ? f.defaultServing.grams : 100
        let macros = f.macrosUnknown ? "macros not published" : "P \(Fmt.g(f.p100 * g / 100)) · C \(Fmt.g(f.c100 * g / 100)) · F \(Fmt.g(f.f100 * g / 100))"
        return ResultRow(name: f.name, brand: f.tier == .user ? nil : (f.tier == .chain ? f.brand : (f.state ?? f.brand)), meta: "\(f.tier == .chain ? f.defaultServing.label : "100 g") · \(macros)", kcal: f.kcal(for: f.defaultServing.grams), onAdd: { log(f, serving: f.defaultServing, qty: 1) }, onOpen: { detailFood = f })
    }
    func runSearch() {
        searchTask?.cancel(); brandedOpen = false; remote = []
        let q = query.trimmingCharacters(in: .whitespaces)
        if typed { return }
        if q.isEmpty { yourFoods = store.mostLogged(); generic = []; chains = []; branded = []; searching = false; return }
        // 8–14 digit numeric input → barcode lookup (the one way a branded product appears without asking).
        if q.count >= 8, q.count <= 14, q.allSatisfy(\.isNumber) {
            yourFoods = []; generic = []; chains = []
            if let f = store.food(barcode: q) { branded = [f]; return }
            searching = true; branded = []
            searchTask = Task { try? await Task.sleep(for: .milliseconds(150)); guard !Task.isCancelled else { return }; var hit = await OpenFoodFacts.barcode(q); if hit == nil { hit = await USDABranded.barcode(q) }; if let p = hit { branded = [store.upsert(p.makeFood())] }; searching = false }
            return
        }
        // Text search is local only: your foods, the canonical generics, chains. Live Open Food Facts joins in
        // automatically only when the query names a brand (PRODUCT_BRIEF §2), or on the explicit "Show branded" tap.
        let g = store.groupedSearch(q); yourFoods = g.your; generic = g.generic; chains = g.chain; branded = g.branded; searching = false
        if Catalogue.hasBrandToken(q) { brandedOpen = true; runBranded() }
    }
    /// Live Open Food Facts search: brand-token queries and the explicit "Show branded" tap only.
    func runBranded() {
        let q = query.trimmingCharacters(in: .whitespaces); guard !q.isEmpty else { return }
        searching = true
        searchTask = Task { try? await Task.sleep(for: .milliseconds(250)); guard !Task.isCancelled else { return }; let r = await OpenFoodFacts.search(q); guard !Task.isCancelled else { return }; let have = Set(branded.compactMap(\.barcode)); remote = r.filter { $0.barcode.map { !have.contains($0) } ?? true }; searching = false }
    }
    func log(_ f: Food, serving: Serving, qty: Double) {
        _ = store.log(food: f, meal: meal, dayKey: dayKey, quantity: qty, serving: serving)
        toaster.show("\(f.name) → \(meal.rawValue)"); session.changed(); dismiss()
    }
}

struct ResultRow: View {
    var name: String; var brand: String?; var meta: String; var kcal: Double; var onAdd: () -> Void; var onOpen: () -> Void
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                (Text(name).font(.yumo.bodyStrong) + Text(brand.map { "  \($0)" } ?? "").font(.yumo.detail).foregroundColor(.yumo.inkMuted)).lineLimit(1)
                Text(meta).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
            }
            Spacer()
            Text(Fmt.k(kcal)).font(.yumo.title).tabular()
            AddCircleButton(action: onAdd)
        }
        .padding(.vertical, 10).padding(.trailing, Space.cardPad).contentShape(Rectangle()).onTapGesture(perform: onOpen).hairline()
    }
}

struct FoundCardView: View {
    var found: AddFoodSheet.Found; var meal: Meal; var onRescan: () -> Void; var onLog: (Food) -> Void; var onCreate: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let f = found.food {
                Text("FOUND").font(.yumo.overline).kerning(0.7).foregroundStyle(Color.yumo.accent)
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) { Text(f.name).font(.nunito(19, .extrabold)); Text([f.brand, f.defaultServing.label, "P \(Fmt.g(f.p100 * f.defaultServing.grams / 100))"].compactMap { $0 }.joined(separator: " · ")).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }
                    Spacer(); Text(Fmt.k(f.kcal(for: f.defaultServing.grams))).font(.nunito(26, .extrabold)).tabular()
                }.padding(.top, 6)
                HStack(spacing: 10) { SecondaryButton(label: "Rescan", action: onRescan).frame(maxWidth: 110); PrimaryButton(label: "Log to \(meal.rawValue)", size: .compact) { onLog(f) } }.padding(.top, 16)
            } else {
                Text("NOT FOUND").font(.yumo.overline).kerning(0.7).foregroundStyle(Color.yumo.inkMuted)
                Text("No match for \(found.barcode)").font(.nunito(19, .extrabold)).padding(.top, 6)
                Text("Checking Open Food Facts…").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 2)
                HStack(spacing: 10) { SecondaryButton(label: "Rescan", action: onRescan).frame(maxWidth: 110); PrimaryButton(label: "Create this food", size: .compact, action: onCreate) }.padding(.top, 16)
            }
        }
        .padding(20).background(RoundedRectangle(cornerRadius: Radius.found, style: .continuous).fill(Color.yumo.surface)).lifted(.yumo.accentEdge, lift: Lift.primary, radius: Radius.found)
    }
}
