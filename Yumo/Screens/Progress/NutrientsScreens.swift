import SwiftUI
import SwiftData

/// Progress › Nutrients: 7- or 30-day averages vs DRI targets. Danger only over a UL or under 50 % of RDA for the whole window.
struct ProgressNutrientsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    var back = "Progress"
    @State private var window = 7
    @State private var tick = 0
    @State private var open: String? = nil
    var store: Store { Store(ctx) }
    typealias Row = NutrientWeek
    var rows: [Row] { store.nutrientWeek(window: window) }
    @State private var addSupp = false
    @State private var suppOpen = false
    @State private var nudgeDose = ""
    var body: some View {
        let p = store.profile()
        VStack(spacing: 0) {
            PageHeader(back: back, title: "Nutrients", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            Segmented(options: [(7, "7 days"), (30, "30 days")], selection: $window).padding(.horizontal, Space.gutter).padding(.top, 6)
            ScrollView {
                let all = rows, pinnedKeys = p.pinnedNutrients
                let pinned = all.filter { pinnedKeys.contains($0.n.key) }, rest = all.filter { !pinnedKeys.contains($0.n.key) }
                VStack(alignment: .leading, spacing: 12) {
                    supplementsRow
                    if !pinned.isEmpty { VStack(alignment: .leading, spacing: 0) { Overline(text: "Pinned to Today").padding(.top, 10).padding(.bottom, 2); ForEach(pinned) { r in nutrientRow(r, p) } }.padding(.leading, Space.cardPad).listCard() }
                    VStack(spacing: 0) { ForEach(rest) { r in nutrientRow(r, p) } }.padding(.leading, Space.cardPad).listCard()
                    Text("Tap any nutrient for what it does, how to fix it and the best foods.\nTargets: NIH DRI for \(p.sex == .male ? "male" : "female"), \(p.age) · edit in Settings › Nutrients\nRed only when over a limit · amber dot when under half the target all week").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 4)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }.id(tick).background(Color.yumo.bg.ignoresSafeArea())
        .sheet(isPresented: $addSupp, onDismiss: { tick += 1 }) { AddSupplementSheet().yumoSheet() }
        .pushCover(isPresented: $suppOpen, onDismiss: { tick += 1 }) { SupplementsScreen(back: "Nutrients") }
    }
    /// Rev 9: the Supplements row at the top — same anatomy as every link row.
    var supplementsRow: some View {
        let list = store.supplements()
        return Button { if list.isEmpty { addSupp = true } else { suppOpen = true } } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) { Text("Supplements").font(.yumo.title).foregroundStyle(Color.yumo.ink); Text(list.isEmpty ? "None yet · tell Yumo what you take so it counts" : list.map { "\($0.name.replacingOccurrences(of: "Vitamin ", with: "")) \($0.doseLabel)" }.joined(separator: " · ")).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }
                Spacer(); Text(list.isEmpty ? "Add ›" : "\(list.count) ›").font(.yumo.action).foregroundStyle(list.isEmpty ? Color.yumo.accent : .yumo.inkMuted)
            }.padding(EdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20)).frame(maxWidth: .infinity).background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).lifted()
        }.buttonStyle(PlainPressStyle()).padding(.top, 10)
    }
    /// One nutrient: name · avg of target · % · bar; tap unfolds (motion.expand) what it does, how to fix it and the best sources.
    /// Colour rule (rev 9): low = ink + amber dot; red only when over an upper limit on most days.
    @ViewBuilder func nutrientRow(_ r: Row, _ p: UserProfile) -> some View {
        let ref = r.ref
        let pct = r.pct
        let limit = r.isLimit
        let danger = r.over
        let low = !limit && (pct ?? 1) < 1
        let info = NutInfo.info(r.n.key)
        let isOpen = open == r.n.key
        let feeders = store.supplementsFeeding(r.n.key)
        let nudge = store.nudgeCandidates().contains { $0.key == r.n.key }
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(Motion.expand) { open = isOpen ? nil : r.n.key } } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 8) { Text(r.n.name).font(.yumo.bodyStrong).foregroundStyle(danger ? Color.yumo.danger : .yumo.ink); if r.low || danger { StatusDot(over: danger) } }
                            Text(r.avg.map { "avg \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)" + (ref.map { " of \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit)\(limit ? " limit" : "")" } ?? "") + (r.suppPerDay > 0 && !feeders.isEmpty ? " · \(Nutrients.format(r.suppPerDay, unit: r.n.unit)) \(r.n.unit) from \(feeders.map { $0.name.replacingOccurrences(of: "Vitamin ", with: "") }.joined(separator: ", "))" : (r.low ? " · low all week" : "")) } ?? "— · no data yet").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).lineLimit(2)
                        }
                        Spacer()
                        Text(pct.map { "\(Int(($0 * 100).rounded())) %" } ?? "—").font(.yumo.title).tabular().foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                        ExpandChevron(open: isOpen)
                    }
                    if let pct { Bar(fraction: min(1, pct), height: 5, fill: danger ? .yumo.danger : .yumo.ink) }
                }.padding(.vertical, 10).padding(.trailing, Space.cardPad).contentShape(Rectangle())
            }.buttonStyle(PlainPressStyle())
            Expandable(open: isOpen) {
                let gap = (r.goal != nil && r.avg != nil) ? r.goal! - r.avg! : nil
                let remedy: String = limit ? (danger ? (info?.over ?? "Cut the highest source on the right.") : "Under the limit. Nothing to change.") : ((pct ?? 0) >= 1 ? "On target. Keep doing what you're doing." : (info?.low ?? (gap.map { "About \(Nutrients.format($0, unit: r.n.unit)) \(r.n.unit) a day short. Any one food on the right closes most of it." } ?? "No data yet — log a few days first.")))
                VStack(alignment: .leading, spacing: 2) {
                    if let why = info?.why { Text(why).font(.nunito(13, .semibold)).foregroundStyle(Color.yumo.ink).lineSpacing(3).fixedSize(horizontal: false, vertical: true) }
                    Text(limit ? (danger ? "Over the limit" : "Within limit") : ((pct ?? 0) >= 1 ? "On target" : "To fix it")).font(.yumo.overline).kerning(0.6).textCase(.uppercase).foregroundStyle(danger ? Color.yumo.danger : low ? .yumo.ink : .yumo.inkMuted).padding(.top, 10)
                    Text(remedy).font(.yumo.caption).foregroundStyle(danger ? Color.yumo.danger : low ? .yumo.ink : .yumo.inkMuted).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
                    if nudge {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Taking a supplement? Yumo can't see pills — add it and this number is right.").font(.yumo.caption).foregroundStyle(Color.yumo.ink).fixedSize(horizontal: false, vertical: true)
                            HStack(spacing: 10) {
                                InsetField(text: $nudgeDose, unit: Supplements.catalogue.first { $0.nutrients[r.n.key] != nil }?.unit ?? r.n.unit, width: 104, placeholder: "Dose")
                                Button { addNudged(r.n) } label: { Text("Add").font(.nunito(14, .black)).foregroundStyle(Color.yumo.onAccent).padding(.horizontal, 16).frame(height: 40) }.buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: 3, radius: 12))
                                Button { p.suppNudgeAnswered.append(r.n.key); store.save(); tick += 1 } label: { Text("Not now").font(.yumo.action).foregroundStyle(Color.yumo.inkMuted) }.buttonStyle(PlainPressStyle())
                            }
                        }.padding(.top, 10)
                    }
                    if let foods = info?.foods, !foods.isEmpty {
                        Text(limit ? "Your biggest sources" : "Best sources").font(.yumo.overline).kerning(0.6).textCase(.uppercase).foregroundStyle(Color.yumo.inkMuted).padding(.top, 10)
                        ForEach(foods.indices, id: \.self) { i in HStack(alignment: .firstTextBaseline) { Text(foods[i].0).font(.nunito(14, .bold)) + Text("  \(foods[i].1)").font(.nunito(13, .semibold)).foregroundColor(.yumo.inkMuted); Spacer(); Text(foods[i].2).font(.nunito(14, .extrabold)).tabular() }.padding(.vertical, 6) }
                    }
                }.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)).background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Color.yumo.bg)).padding(.trailing, Space.cardPad).padding(.bottom, 12)
            }
        }
        .hairline()
        .contextMenu {
            if p.pinnedNutrients.contains(r.n.key) { Button("Unpin") { p.pinnedNutrients.removeAll { $0 == r.n.key }; store.save(); toaster.show("Unpinned \(r.n.name)"); tick += 1 } }
            else if p.pinnedNutrients.count < 3 { Button("Pin to Today") { p.pinnedNutrients.append(r.n.key); p.showNutrientsOnToday = true; store.save(); toaster.show("Pinned \(r.n.name)"); tick += 1 } }
        }
    }
}

extension ProgressNutrientsScreen {
    /// Nudge "Add": the first catalogue item that feeds the nutrient, at the typed dose; the nudge is never shown again for that nutrient.
    func addNudged(_ n: Nutrient) {
        guard let it = Supplements.catalogue.first(where: { $0.nutrients[n.key] != nil }) else { return }
        let dose = Double(nudgeDose.replacingOccurrences(of: ",", with: ".")) ?? it.dose
        let s = Supplement(name: it.name, tier: "nutrient", dose: dose, unit: it.unit, days: Array(repeating: true, count: 7), nutrients: Supplements.amounts(for: it, dose: dose, unit: it.unit), catalogueId: it.id, order: 0)
        store.addSupplement(s); let p = store.profile(); p.suppNudgeAnswered.append(n.key); store.save(); toaster.show("\(it.name) counts toward \(it.countsToward)"); nudgeDose = ""; tick += 1
    }
}
