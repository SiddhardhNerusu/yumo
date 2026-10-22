import SwiftUI
import SwiftData

/// Staples (rev 5): the foods the user eats most weeks. No amounts; an optional daily Max. Used by Settings › Food › Staples and onboarding step 9.
struct StaplesEditor: View {
    enum Mode { case settings, onboarding }
    @Environment(\.modelContext) private var ctx
    var mode: Mode
    var onChange: () -> Void = {}
    @State private var line = ""
    @State private var open: String? = nil           // onboarding: the staple whose Flexible | Max panel is unfolded
    @State private var maxText: [String: String] = [:]
    @State private var tick = 0
    @FocusState private var focused: Bool
    var store: Store { Store(ctx) }

    var staples: [(Staple, Food)] { store.staples().compactMap { s in store.food(id: s.foodId).map { (s, $0) } } }
    @State private var results: [Food] = []
    @State private var searchedLine = ""        // the line `results` answers; "No match" only once it equals the field
    @State private var scanOpen = false
    /// What you've logged lately and haven't kept yet (22 Oct, Sid: "a way to add recent foods to staples") — newest first.
    var recent: [Food] {
        let have = Set(store.staples().map(\.foodId))
        return Array(store.recentlyLogged(limit: 30).filter { !have.contains($0.id) && !$0.macrosUnknown }.prefix(8))
    }
    func tag(_ f: Food) -> String { Balance.className(Balance.classify(f)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                TextField("Type here…", text: $line).font(.yumo.bodyStrong).focused($focused).autocorrectionDisabled().submitLabel(.done)
                ScanButton { scanOpen = true }
            }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
            .task(id: line) {   // debounced, off the main thread: the index is a value snapshot
                let q = line.trimmingCharacters(in: .whitespaces); guard q.count >= 2 else { results = []; searchedLine = ""; return }
                try? await Task.sleep(for: .milliseconds(120)); guard !Task.isCancelled else { return }
                let s = store, ex = Set(s.staples().map(\.foodId)), count = (try? s.ctx.fetchCount(FetchDescriptor<Food>())) ?? 0
                let snap = await FoodIndex.shared.snapshot(for: s.ctx.container, count: count); guard !Task.isCancelled else { return }
                let ids = await Task.detached(priority: .userInitiated) { snap.search(q, exclude: ex).map(\.id) }.value
                guard !Task.isCancelled else { return }
                results = s.foods(ids: ids); searchedLine = q
            }
            .fullScreenCover(isPresented: $scanOpen) { StapleScanScreen { f in store.addStaple(f); scanOpen = false; tick += 1; onChange() } }
            let res = results
            if line.trimmingCharacters(in: .whitespaces).count >= 2, !res.isEmpty || searchedLine == line.trimmingCharacters(in: .whitespaces) {
                VStack(spacing: 0) {
                    ForEach(res.prefix(8), id: \.id) { f in
                        Button { store.addStaple(f); line = ""; tick += 1; onChange() } label: {
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 1) { Text(f.shortName).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).lineLimit(1); Text([tag(f), f.detail].filter { !$0.isEmpty }.joined(separator: " · ")).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }
                                Spacer(); AddCircleButton { store.addStaple(f); line = ""; tick += 1; onChange() }
                            }.padding(.vertical, 10).padding(.trailing, 14).contentShape(Rectangle())
                        }.buttonStyle(PlainPressStyle()).hairline()
                    }
                    if res.count > 8 { Text("\(res.count - 8) more — keep typing to narrow it").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10) }
                    if res.isEmpty { Text("No match. Try another spelling, or a simpler word.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12) }
                }.padding(.leading, Space.cardPad).listCard().padding(.top, 12)
            }
            let list = staples
            if !list.isEmpty {
                Overline(text: "Your staples").padding(.top, 18)
                VStack(spacing: 0) { ForEach(list, id: \.0.foodId) { s, f in stapleRow(s, f) } }.padding(.leading, Space.cardPad).listCard().padding(.top, 8)
            }
            let rec = recent
            if !rec.isEmpty && line.isEmpty {
                HStack(alignment: .firstTextBaseline) {
                    Overline(text: "Recent")
                    Spacer()
                    if rec.count > 1 { TextAction(label: "Add all \(rec.count)") { for f in rec { store.addStaple(f) }; tick += 1; onChange() } }
                }.padding(.top, 18)
                VStack(spacing: 0) { ForEach(rec, id: \.id) { f in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(f.shortName).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).lineLimit(1)
                            Text([tag(f), f.useCount > 1 ? "logged \(f.useCount)×" : "logged once", f.detail].filter { !$0.isEmpty }.joined(separator: " · ")).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
                        }
                        Spacer(); AddCircleButton { store.addStaple(f); tick += 1; onChange() }
                    }.padding(.vertical, 10).padding(.trailing, 14).hairline()
                } }.padding(.leading, Space.cardPad).listCard().padding(.top, 8)
            }
        }.id(tick)
    }

    @ViewBuilder func stapleRow(_ s: Staple, _ f: Food) -> some View {
        // Rev 6: every staple opens the same unfold — Flexible | Max — in Settings and onboarding alike; no amounts anywhere
        let k = Balance.classify(f); let isOpen = open == s.foodId
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Button { withAnimation(Motion.expand) { open = isOpen ? nil : s.foodId } } label: {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(f.shortName).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).lineLimit(1)
                        HStack(spacing: 3) {
                            Text(s.maxG.map { "Max \(Fmt.g($0)) g a day" } ?? "\(tag(f)) · flexible").font(.yumo.footnote).foregroundStyle(Color.yumo.accent)
                            Text("›").font(.yumo.footnote).foregroundStyle(Color.yumo.accent)
                            if !f.detail.isEmpty { Text("· \(f.detail)").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }.buttonStyle(PlainPressStyle())
                Button { store.removeStaple(s); tick += 1; onChange() } label: { Text("✕").font(.nunito(16, .extrabold)).foregroundStyle(Color.yumo.inkMuted).frame(width: 32, height: 32) }.buttonStyle(PlainPressStyle())
            }.padding(.vertical, 10).padding(.trailing, 12)
            Expandable(open: isOpen) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Segmented(options: [(false, "Flexible"), (true, "Max")], selection: Binding(get: { s.maxG != nil }, set: { s.maxG = $0 ? (s.maxG ?? 250) : nil; store.save(); tick += 1; onChange() }))
                        if s.maxG != nil { InsetField(text: Binding(get: { maxText[s.foodId] ?? s.maxG.map { Fmt.g($0) } ?? "" }, set: { maxText[s.foodId] = $0; s.maxG = Double($0.replacingOccurrences(of: ",", with: ".")) ?? s.maxG; store.save(); onChange() }), unit: "g", width: 110) }
                    }
                    Text(s.maxG == nil ? "Yumo sizes this to whatever lands the day." : "Yumo never plans more than this in a day.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted)
                }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Color.yumo.bg)).padding(.trailing, 14).padding(.bottom, 12)
            }
        }.hairline()
        let _ = k
    }
}

/// Settings › Food › Staples.
struct StaplesScreen: View {
    @Environment(\.dismiss) private var dismiss
    var back = "Settings"
    var onChange: () -> Void = {}
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: back, title: "Staples", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("The foods you eat most weeks. No amounts — when your prep comes out different, Yumo works out how much of these lands the day.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4).padding(.bottom, 14)
                    PowderQuestion()
                    StaplesEditor(mode: .settings, onChange: onChange)
                    PlannerMemory()
                }.padding(Space.gutter).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
}


/// Rev 11.1: scan a packaged product straight into your staples (the same scanner as Add food, the same Open Food Facts → USDA Branded lookup).
struct StapleScanScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    var onAdd: (Food) -> Void
    @State private var torch = false
    @State private var code: String? = nil
    @State private var food: Food? = nil
    @State private var missing = false
    @State private var create: CreateFoodDraft? = nil
    var store: Store { Store(ctx) }
    var body: some View {
        ZStack {
            BarcodeScannerView(torch: torch) { c in handle(c) }.ignoresSafeArea()
            Color.yumo.scanMask.ignoresSafeArea().mask { Rectangle().overlay { RoundedRectangle(cornerRadius: 22).frame(width: 300, height: 190).offset(y: -40).blendMode(.destinationOut) }.compositingGroup() }
            CornerBrackets(locked: code != nil).frame(width: 300, height: 190).offset(y: -40)
            VStack(spacing: 0) {
                ZStack {
                    HStack {
                        Button { dismiss() } label: { Text("✕").font(.nunito(22, .extrabold)).foregroundStyle(.white).frame(width: 44, height: 44) }.buttonStyle(PlainPressStyle())
                        Spacer()
                        Button { torch.toggle() } label: { TorchIcon(on: torch).frame(width: 44, height: 44) }.buttonStyle(PlainPressStyle())
                    }
                    Text("Scan a staple").font(.yumo.title).foregroundStyle(.white)
                }.padding(.horizontal, Space.gutter).padding(.top, 12)
                Spacer()
                if let code {
                    VStack(alignment: .leading, spacing: 10) {
                        Overline(text: food != nil ? "Found" : missing ? "Not found" : "Looking up…")
                        if let f = food {
                            Text(f.name).font(.yumo.title).foregroundStyle(Color.yumo.ink)
                            Text([f.brand, "\(Fmt.k(f.kcal100)) kcal · P \(Fmt.g(f.p100)) · C \(Fmt.g(f.c100)) · F \(Fmt.g(f.f100)) per \(f.mlDensity != nil ? "100 ml" : "100 g")"].compactMap { $0 }.joined(separator: " · ")).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                            HStack(spacing: 10) { PrimaryButton(label: "Add as a staple", size: .compact) { onAdd(f) }; SecondaryButton(label: "Rescan") { reset() } }.padding(.top, 4)
                        } else if missing {
                            Text("Barcode \(code) isn't in Open Food Facts or USDA yet. Type the label's numbers once and it's yours for good.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                            HStack(spacing: 10) { PrimaryButton(label: "Add it from the label", size: .compact) { create = CreateFoodDraft(barcode: code) }; SecondaryButton(label: "Rescan") { reset() } }.padding(.top, 4)
                        } else { ProgressView().tint(.yumo.inkMuted) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20), radius: Radius.found).padding(.horizontal, Space.gutter).padding(.bottom, 40)
                }
            }
        }.background(Color.black.ignoresSafeArea())
        .sheet(item: $create) { d in CreateFoodScreen(draft: d) { f in create = nil; onAdd(f) } }
    }
    func reset() { withAnimation(Motion.snap) { code = nil; food = nil; missing = false } }
    func handle(_ c: String) {
        guard code == nil else { return }
        withAnimation(Motion.snap) { code = c }
        let s = store
        if let f = s.food(barcode: c) { food = f; return }
        Task {
            var hit = await OpenFoodFacts.barcode(c); if hit == nil { hit = await USDABranded.barcode(c) }
            if let p = hit { withAnimation(Motion.snap) { food = s.upsert(p.makeFood()) } } else { withAnimation(Motion.snap) { missing = true } }
        }
    }
}

/// What the planner knows about you (22 Oct): foods you don't eat (by kind), foods you liked, foods you blocked — each undoable.
struct PlannerMemory: View {
    @Environment(\.modelContext) private var ctx
    @State private var gen = 0
    var store: Store { Store(ctx) }
    var body: some View {
        let profile = store.profile()
        let prefs = store.preferences().sorted { $0.updatedAt > $1.updatedAt }
        let rows: [(FoodPreference, Food)] = prefs.compactMap { p in store.food(id: p.foodId).map { (p, $0) } }
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: "The planner").padding(.top, 24)
            Text("When your staples don't cover a carb, a fat, a veg or enough protein, the planner suggests one. It never suggests what you don't eat.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.leading, 4)
            Text("I don't eat").font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).padding(.leading, 4).padding(.top, 6)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(Planner.exclusions, id: \.tag) { ex in
                    let on = profile.plannerExclude.contains(ex.tag)
                    Button {
                        if on { profile.plannerExclude.removeAll { $0 == ex.tag } } else { profile.plannerExclude.append(ex.tag) }
                        store.save(); gen += 1
                    } label: {
                        HStack(spacing: 6) {
                            if on { Text("✓").font(.nunito(13, .black)) }
                            Text(ex.label).font(.nunito(14, .extrabold)).lineLimit(1).minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(on ? Color.yumo.accent : .yumo.ink)
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous).fill(on ? Color.yumo.accentTint : .yumo.surface))
                        .overlay(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous).stroke(on ? Color.yumo.accent : .yumo.hairline, lineWidth: on ? 1.5 : 1))
                        .contentShape(Rectangle())
                    }.buttonStyle(PlainPressStyle()).accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            if !rows.isEmpty {
                Text("Liked foods come back every day and pull up foods like them. Blocked foods never come up.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.leading, 4).padding(.top, 10)
                VStack(spacing: 0) {
                    ForEach(rows, id: \.0.foodId) { p, f in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(f.shortName).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink).lineLimit(1)
                                Text(p.verdict == .liked ? "♥\u{FE0E} liked" : "never suggested").font(.yumo.footnote).foregroundStyle(p.verdict == .liked ? Color.yumo.accent : .yumo.inkMuted)
                            }
                            Spacer()
                            TextAction(label: p.verdict == .liked ? "Unlike" : "Allow again") { store.clearPreference(f); gen += 1 }
                        }.padding(.vertical, 11).padding(.trailing, 16).frame(minHeight: 44).hairline()
                    }
                }.padding(.leading, 18).listCard(radius: 20)
            }
        }.id(gen)
    }
}

/// Asked once (21 Oct, Sid): a protein powder is easy to forget as a staple, and it's what the planner reaches for when protein is short.
/// Lives with the staples since 22 Oct, so the plan screen stays about today.
struct PowderQuestion: View {
    @Environment(\.modelContext) private var ctx
    @State private var gone = false
    var body: some View {
        let p = Store(ctx).profile()
        if !p.plannerAskedPowder && !gone {
            VStack(alignment: .leading, spacing: 8) {
                Text("Do you use a protein powder?").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.ink)
                Text("Search or scan it below and tap + — the planner uses it when protein is short. Scoops differ, so it takes the label's serving or the amount you type once.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                HStack { Spacer(); TextAction(label: "Got it") { p.plannerAskedPowder = true; Store(ctx).save(); gone = true } }
            }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 14, leading: 18, bottom: 12, trailing: 18), radius: 20).padding(.bottom, 14)
        }
    }
}
