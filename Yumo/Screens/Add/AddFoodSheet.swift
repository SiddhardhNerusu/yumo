import SwiftUI
import SwiftData

/// Add food: one searchable list — recents on top, every catalogue group below, the barcode scanner top-right. The meal is the one whose + you tapped;
/// + logs a serving, the row opens the Food page to set grams. Features.typeIt brings back the pick tiles and the one-line parser; Features.mealSwitcherInAdd the meal segmented.
struct AddFoodSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State var meal: Meal
    var dayKey: String
    enum Step { case pick, scan, search }
    @State private var step: Step = Features.typeIt ? .pick : .search
    @State private var detent: PresentationDetent = Features.typeIt ? .height(300) : .large
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
    @State private var brandedOpen = false      // live Open Food Facts results: automatic when the line names a brand or a word the catalogue can't cover, or on "Show branded"
    @State private var brandedFirst = false     // a word the catalogue can't cover → the packaged group leads
    @State private var searchedFor = ""         // the line the current lists answer; empty-state copy only once this matches the field
    @FocusState private var focused: Bool
    struct Found: Identifiable { var id = UUID(); var barcode: String; var food: Food? }

    var store: Store { Store(ctx) }
    var title: String { "Add to \(meal.rawValue)" }
    /// Features.typeIt: a digit anywhere (and not a bare barcode) → the line parser.
    var typed: Bool { guard Features.typeIt else { return false }; let q = query.trimmingCharacters(in: .whitespaces); return TypeToLog.hasNumbers(q) && !(q.count >= 8 && q.allSatisfy(\.isNumber)) }

    var body: some View {
        VStack(spacing: 0) {
            switch step {
            case .pick: pick
            case .scan: pick
            case .search: search
            }
        }
        .background(Color.yumo.bg)
        .presentationDetents(Features.typeIt ? [.height(300), .large] : [.large], selection: $detent)
        .presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden)
        .fullScreenCover(isPresented: $scanOpen) { scan }
        .sheet(item: $create) { d in CreateFoodScreen(draft: d) { f in log(f, serving: f.defaultServing, qty: 1) } }
        .pushCover(item: $detailFood) { f in FoodDetailScreen(food: f, meal: meal, dayKey: dayKey) { dismiss() } }
        .onAppear {
            if Features.typeIt { if Tour.shared.wantsPresetLine { go(.search) }; return }   // tour stop 2: the + opens Type it for real
            yourFoods = store.recentlyLogged(); Task { try? await Task.sleep(for: .milliseconds(Tour.shared.active ? 460 : 150)); focused = true }   // keyboard rises with the sheet (later during the tour so the spotlight settles)
        }
    }

    // MARK: pick (Features.typeIt)
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
        if s == .search {
            yourFoods = store.recentlyLogged(); generic = []; branded = []
            if Tour.shared.wantsPresetLine { query = Tour.presetLine; Task { try? await Task.sleep(for: .milliseconds(460)); focused = true } }   // tour stop 3: keyboard rises 460 ms after the sheet
            else { focused = true }
        }
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
                Button { scanOpen = false; if Features.typeIt { go(.search) } } label: { Text("Type barcode or search instead").font(.yumo.action).underline().foregroundStyle(.white) }.buttonStyle(PlainPressStyle()).padding(.bottom, Features.mealSwitcherInAdd ? 16 : 48)
                if Features.mealSwitcherInAdd { Segmented(options: Meal.allCases.map { ($0, $0.rawValue) }, selection: $meal).padding(.horizontal, Space.gutter).padding(.bottom, 48) }
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
            SheetHeader(title: title, onClose: { Tour.shared.didAct(.sheetClose); dismiss() }, closeAnchor: Tour.shared.active) { Button { scanOpen = true } label: { BarcodeGlyph(color: .yumo.ink).scaleEffect(0.5).frame(width: 44, height: 44).background(Circle().fill(Color.yumo.control)) }.buttonStyle(PlainPressStyle()) }
            HStack(spacing: 10) {
                MagnifierGlyph(color: .yumo.inkMuted, size: 18)
                TextField(Features.typeIt ? "chicken 180 rice 150 — or a name" : "Search foods", text: $query).font(.yumo.body).focused($focused).submitLabel(.search).autocorrectionDisabled()
            }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
                .tourAnchor(.searchField).padding(.horizontal, Space.gutter).padding(.top, 14)
            if Features.typeIt, !store.profile().typeItHintSeen { Text("Foods and grams in one line. I learn your shorthand as we go — first time, I ask.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, Space.gutter + 4).padding(.top, 8) }
            if Features.mealSwitcherInAdd { Segmented(options: Meal.allCases.map { ($0, $0.rawValue) }, selection: $meal, compact: true).padding(.horizontal, Space.gutter).padding(.top, 10) }
            if typed {
                // Type-to-log (README §4a): the line has numbers → rows, ask / learned, Log N foods
                ScrollView { TypeItView(line: query, meal: meal, dayKey: dayKey, onSearchAll: { w in query = w }, onLogged: { n in toaster.show("\(n) food\(n == 1 ? "" : "s") → \(meal.rawValue)"); session.changed(); dismiss() }).padding(.horizontal, Space.gutter).padding(.vertical, 14).padding(.bottom, 40) }.scrollDismissesKeyboard(.interactively)
            } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if query.isEmpty && yourFoods.isEmpty { Text("Foods you log show up here first. Search anything, or scan a packet.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 8) }
                    if !yourFoods.isEmpty { group(query.trimmingCharacters(in: .whitespaces).count < 2 ? "Recent" : "Your foods", yourFoods) }
                    if brandedFirst, !query.isEmpty { remoteGroup }
                    if !generic.isEmpty { group("Generic", generic) }
                    if !chains.isEmpty { group("Chains", chains) }
                    if !branded.isEmpty { group("Scanned products", branded) }
                    if yourFoods.isEmpty && generic.isEmpty && chains.isEmpty && branded.isEmpty && !query.isEmpty && !brandedOpen && searchedFor == query.trimmingCharacters(in: .whitespaces) {
                        Text("No generic match for \"\(query)\".").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 8)
                    }
                    if !query.isEmpty, !brandedFirst, searchedFor == query.trimmingCharacters(in: .whitespaces) {
                        if brandedOpen {
                            Overline(text: "Branded · Open Food Facts").padding(.top, 4)
                            if remote.isEmpty && !searching { Text("No branded match. Scan the barcode for an exact product.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }
                            else { VStack(spacing: 0) { ForEach(Array(remote.enumerated()), id: \.offset) { _, p in ResultRow(name: p.name, brand: nil, meta: (["\(p.per100) · P \(Fmt.g(p.p100)) · C \(Fmt.g(p.c100)) · F \(Fmt.g(p.f100))"] + [p.brand, p.quantity].compactMap { $0 }).joined(separator: " · "), kcal: p.kcal100 * p.servings[0].grams / 100, onAdd: { let f = store.upsert(p.makeFood()); log(f, serving: f.defaultServing, qty: 1) }, onOpen: { detailFood = store.upsert(p.makeFood()) }) } }.padding(.leading, Space.cardPad).listCard() }
                            if searching { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity) }
                        } else {
                            // Generic words keep branded noise out; one quiet line brings it in when wanted.
                            HStack(spacing: 4) { Text("Looking for a packaged product?").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted); TextAction(label: "Show branded") { showBranded() } }
                        }
                    }
                    HStack(spacing: 4) { Text(query.isEmpty ? "" : "Still not here?").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted); TextAction(label: "Create a food") { create = CreateFoodDraft(name: query.allSatisfy(\.isNumber) ? "" : query, barcode: query.allSatisfy(\.isNumber) && query.count >= 8 ? query : nil) } }.padding(.top, 4)
                }.padding(.horizontal, Space.gutter).padding(.vertical, 14).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
            }
        }
        .onChange(of: query) { runSearch() }
    }
    /// The Open Food Facts group when it leads (a word the catalogue can't cover).
    @ViewBuilder var remoteGroup: some View {
        Overline(text: "Branded · Open Food Facts").padding(.top, 4)
        if remote.isEmpty && !searching { Text(OpenFoodFacts.lastFailure.map { Date().timeIntervalSince($0) < 60 } == true ? "Open Food Facts didn't answer — try again in a moment, or scan the barcode." : "No packaged product by that name on Open Food Facts — scan its barcode for an exact product.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted) }
        else { VStack(spacing: 0) { ForEach(Array(remote.enumerated()), id: \.offset) { _, p in ResultRow(name: p.name, brand: nil, meta: (["\(p.per100) · P \(Fmt.g(p.p100)) · C \(Fmt.g(p.c100)) · F \(Fmt.g(p.f100))"] + [p.brand, p.quantity].compactMap { $0 }).joined(separator: " · "), kcal: p.kcal100 * p.servings[0].grams / 100, onAdd: { let f = store.upsert(p.makeFood()); log(f, serving: f.defaultServing, qty: 1) }, onOpen: { detailFood = store.upsert(p.makeFood()) }) } }.padding(.leading, Space.cardPad).listCard() }
        if searching { ProgressView().tint(.yumo.inkMuted).frame(maxWidth: .infinity) }
    }
    func group(_ title: String, _ foods: [Food]) -> some View {
        VStack(alignment: .leading, spacing: 8) { HStack { Overline(text: title); Spacer(); if foods.count > 12 { Text("\(foods.count)").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).padding(.trailing, 4) } }.padding(.top, 4); LazyVStack(spacing: 0) { ForEach(foods, id: \.id) { f in row(f) } }.padding(.leading, Space.cardPad).listCard() }
    }
    func row(_ f: Food) -> some View {
        let g = f.quickGrams
        let macros = f.macrosUnknown ? "macros not published" : "P \(Fmt.g(f.p100 * g / 100)) · C \(Fmt.g(f.c100 * g / 100)) · F \(Fmt.g(f.f100 * g / 100))"
        // the state sits after the macros ("… · F 2 · raw") so raw vs grilled reads at a glance and the name keeps its width (20 Oct)
        // the shop sits where "raw" / "cooked (grilled)" sits on generic rows — the end of the line (20 Oct)
        let tail: String? = f.tier == .generic ? f.state : (f.tier == .user ? nil : f.brand)
        return ResultRow(name: f.name, brand: nil, meta: [f.quickAmountLabel, macros, tail].compactMap { $0 }.joined(separator: " · "), kcal: f.kcal(for: f.quickGrams), onAdd: { log(f, serving: f.quickAmount.serving, qty: f.quickAmount.quantity) }, onOpen: { detailFood = f })
    }
    func runSearch() {
        searchTask?.cancel(); brandedOpen = false; brandedFirst = false; remote = []
        let q = query.trimmingCharacters(in: .whitespaces)
        if typed { return }
        if q.count < 2 { yourFoods = store.recentlyLogged(); generic = []; chains = []; branded = []; searching = false; searchedFor = ""; return }   // one letter keeps Recent
        // 8–14 digit numeric input → barcode lookup (the one way a branded product appears without asking).
        if q.count >= 8, q.count <= 14, q.allSatisfy(\.isNumber) {
            yourFoods = []; generic = []; chains = []
            if let f = store.food(barcode: q) { branded = [f]; return }
            searching = true; branded = []
            searchTask = Task { try? await Task.sleep(for: .milliseconds(150)); guard !Task.isCancelled else { return }; var hit = await OpenFoodFacts.barcode(q); if hit == nil { hit = await USDABranded.barcode(q) }; if let p = hit { branded = [store.upsert(p.makeFood())] }; searching = false }
            return
        }
        // One scorer for every group (FoodIndex), off the main thread. Live Open Food Facts joins in automatically when the line names a brand
        // (PRODUCT_BRIEF §2) or a word the catalogue can't cover (a variety, a brand it has never seen), or on the explicit "Show branded" tap.
        // The whole pipeline is one task for one captured line, so a keystroke cancels every stale lookup — never results for "alber".
        let s = store, container = s.ctx.container, count = (try? s.ctx.fetchCount(FetchDescriptor<Food>())) ?? 0
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(80)); guard !Task.isCancelled else { return }   // the search is ~10 ms (21 Oct), so results can follow the keystroke closely
            let snap = await FoodIndex.shared.snapshot(for: container, count: count); guard !Task.isCancelled else { return }
            let (hits, missing) = await Task.detached(priority: .userInitiated) { (snap.search(q, tiers: [.user, .generic, .chain, .branded], limit: 400), snap.uncovered(q)) }.value
            guard !Task.isCancelled else { return }
            let all = s.foods(ids: hits.map(\.id))
            yourFoods = all.filter { $0.tier == .user }; generic = all.filter { $0.tier == .generic }; chains = all.filter { $0.tier == .chain }; branded = all.filter { $0.tier == .branded }; searching = false; searchedFor = q
            if Catalogue.hasBrandToken(q) || !missing.isEmpty { brandedOpen = true; brandedFirst = !missing.isEmpty; await fetchBranded(q, missing: missing, snap: snap) }
        }
    }
    /// The explicit "Show branded" tap.
    func showBranded() {
        let q = query.trimmingCharacters(in: .whitespaces); guard !q.isEmpty else { return }
        let snap = FoodIndex.shared.snapshot(store)
        brandedOpen = true; searchTask?.cancel(); searchTask = Task { await fetchBranded(q, missing: snap.uncovered(q), snap: snap) }
    }
    /// Live Open Food Facts search for one captured line, ranked by the same scorer; one lookup per uncovered word merged by barcode.
    func fetchBranded(_ q: String, missing: [String], snap: FoodIndex.Snapshot) async {
        guard (q.split(separator: " ").last?.count ?? 0) >= 3 else { return }   // wait for a complete word
        searching = true
        try? await Task.sleep(for: .milliseconds(300)); guard !Task.isCancelled else { return }
        let products = await OpenFoodFacts.searchMerged(q, terms: missing)
        guard !Task.isCancelled else { return }
        let have = Set(branded.compactMap(\.barcode))
        remote = snap.rank(products.filter { $0.barcode.map { !have.contains($0) } ?? true }, query: q); searching = false
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
