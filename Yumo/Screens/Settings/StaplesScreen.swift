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
    var results: [Food] { store.fuzzySearch(line, exclude: Set(store.staples().map(\.foodId))) }
    var suggestions: [Food] {
        guard mode == .settings, store.hasHistory(before: Date().adding(days: -6).dayKey) else { return [] }
        let have = Set(store.staples().map(\.foodId))
        return Array(store.foods().filter { $0.useCount >= 5 && !have.contains($0.id) && $0.tier != .branded && !$0.macrosUnknown }.prefix(4))
    }
    func tag(_ f: Food) -> String { Balance.className(Balance.classify(f)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                TextField("Type here…", text: $line).font(.yumo.bodyStrong).focused($focused).autocorrectionDisabled().submitLabel(.done)
            }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
            let res = results
            if !line.trimmingCharacters(in: .whitespaces).isEmpty {
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
            let sugg = suggestions
            if !sugg.isEmpty && line.isEmpty {
                Overline(text: "From your log").padding(.top, 18)
                VStack(spacing: 0) { ForEach(sugg, id: \.id) { f in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) { Text(f.name).font(.yumo.bodyStrong).lineLimit(1); Text("\(f.useCount) times logged").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) }
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
                }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.yumo.bg)).padding(.trailing, 14).padding(.bottom, 12)
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
                    StaplesEditor(mode: .settings, onChange: onChange)
                }.padding(Space.gutter).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
}
