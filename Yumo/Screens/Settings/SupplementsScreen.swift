import SwiftUI
import SwiftData

/// Settings › Supplements (rev 9, README §7d): list with tier per row, swipe to remove, › edits, fixed "Add a supplement".
struct SupplementsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    var back = "Settings"
    var onChange: () -> Void = {}
    @State private var add = false
    @State private var edit: Supplement? = nil
    @State private var tick = 0
    var store: Store { Store(ctx) }
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: back, title: "Supplements", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    let list = store.supplements()
                    if list.isEmpty {
                        Text("Yumo can't see pills. Add what you take and your nutrient numbers are right.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4)
                    } else {
                        VStack(spacing: 0) { ForEach(list, id: \.id) { s in SupplementRow(s: s, onOpen: { edit = s }, onDelete: { store.removeSupplement(s); tick += 1; onChange() }) } }.padding(.leading, Space.cardPad).listCard()
                        Text("Swipe left to remove. Nutrient-feeding supplements are added to each day's totals; stack items are just kept on the list.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4)
                    }
                }.padding(Space.gutter).padding(.bottom, 40)
            }
            PrimaryButton(label: "Add a supplement") { add = true }.padding(.horizontal, Space.gutter).padding(.bottom, 8)
        }
        .id(tick).background(Color.yumo.bg.ignoresSafeArea())
        .sheet(isPresented: $add, onDismiss: { tick += 1; onChange() }) { AddSupplementSheet().yumoSheet() }
        .sheet(item: $edit, onDismiss: { tick += 1; onChange() }) { s in AddSupplementSheet(editing: s).yumoSheet() }
    }
}
struct SupplementRow: View {
    var s: Supplement; var onOpen: () -> Void; var onDelete: () -> Void
    @State private var dx: CGFloat = 0
    @State private var committed = false
    var sub: String { "\(s.doseLabel) · \(s.daysLabel) · " + (s.isNutrient ? "counts toward \(countsToward)" : "stack only") }
    var countsToward: String { let keys = s.nutrients.keys; return keys.count == 1 ? (Nutrients.by(keys.first!)?.name.components(separatedBy: " (").first ?? "") : "\(keys.count) nutrients" }
    var body: some View {
        ZStack(alignment: .trailing) {
            SwipeReveal(dx: dx, label: "Remove")
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) { Text(s.name).font(.yumo.bodyStrong).lineLimit(1); Text(sub).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).lineLimit(1) }
                Spacer(); Text("›").font(.yumo.title).foregroundStyle(Color.yumo.inkMuted)
            }.padding(.vertical, 12).padding(.trailing, Space.cardPad).padding(.leading, 0).background(Color.yumo.surface.padding(.leading, -Space.cardPad)).contentShape(Rectangle())
            .offset(x: dx).onTapGesture { if !committed { onOpen() } }
            .gesture(DragGesture(minimumDistance: 8).onChanged { v in if v.translation.width < 0 { dx = v.translation.width } }
                .onEnded { v in if v.translation.width < -110 { committed = true; withAnimation(Motion.remove) { dx = -420 }; Task { try? await Task.sleep(for: .milliseconds(360)); onDelete() } } else { withAnimation(Motion.snap) { dx = 0 } } })
        }.clipped().hairline()
    }
}

/// Add / edit a supplement (one sheet for the three doors): search → detail card (dose · unit · which days) → Add.
struct AddSupplementSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    var editing: Supplement? = nil
    var onAdded: ((Supplement) -> Void)? = nil
    @State private var query = ""
    @State private var picked: Supplements.Item? = nil
    @State private var stackName: String? = nil
    @State private var doseText = ""
    @State private var unit = "mg"
    @State private var days: [Bool] = Array(repeating: true, count: 7)
    @FocusState private var focused: Bool
    var store: Store { Store(ctx) }
    var detailOpen: Bool { picked != nil || stackName != nil || editing != nil }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: editing != nil ? "Edit supplement" : "Add a supplement", onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            if detailOpen { detail } else { search }
        }
        .background(Color.yumo.bg)
        .onAppear { if let e = editing { doseText = e.dose == e.dose.rounded() ? String(Int(e.dose)) : String(e.dose); unit = e.unit; days = e.days; if let cid = e.catalogueId, let it = Supplements.catalogue.first(where: { $0.id == cid }) { picked = it } else { stackName = e.name } } else { focused = true } }
    }
    var search: some View {
        VStack(spacing: 0) {
            HStack { TextField("Search supplements…", text: $query).font(.yumo.bodyStrong).focused($focused).autocorrectionDisabled() }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field).padding(.horizontal, Space.gutter).padding(.top, 14)
            ScrollView {
                let q = query.trimmingCharacters(in: .whitespaces)
                let results = q.isEmpty ? Array(Supplements.catalogue.prefix(6)) : Array(Supplements.search(q).prefix(8))
                VStack(alignment: .leading, spacing: 8) {
                    Overline(text: "Counts toward a nutrient").padding(.top, 16)
                    VStack(spacing: 0) {
                        ForEach(results) { it in
                            Button { pick(it) } label: {
                                HStack(spacing: 10) { VStack(alignment: .leading, spacing: 2) { Text(it.name).font(.yumo.bodyStrong).foregroundStyle(Color.yumo.ink); Text("usual \(Supplements.formatDose(it.dose, unit: it.unit)) · counts toward \(it.countsToward)").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }; Spacer(); Text("›").font(.yumo.title).foregroundStyle(Color.yumo.inkMuted) }
                                    .padding(.vertical, 11).padding(.trailing, Space.cardPad).contentShape(Rectangle())
                            }.buttonStyle(PlainPressStyle()).hairline()
                        }
                        if !q.isEmpty {
                            Button { stackName = q.prefix(1).uppercased() + q.dropFirst(); doseText = ""; unit = "mg" } label: {
                                HStack(spacing: 4) { Text("Not here?").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted); Text("Add “\(q)” to your stack").font(.yumo.action).foregroundStyle(Color.yumo.accent); Spacer() }.padding(.vertical, 12).contentShape(Rectangle())
                            }.buttonStyle(PlainPressStyle())
                        } else {
                            Text("Anything else — creatine, ashwagandha, pre-workout — goes in your stack: type its name.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.vertical, 12).padding(.trailing, Space.cardPad)
                        }
                    }.padding(.leading, Space.cardPad).listCard()
                }.padding(.horizontal, Space.gutter).padding(.bottom, 30)
            }.scrollDismissesKeyboard(.interactively)
        }
    }
    func pick(_ it: Supplements.Item) { picked = it; doseText = it.dose == it.dose.rounded() ? String(Int(it.dose)) : String(it.dose); unit = it.unit }
    var isStack: Bool { picked == nil }
    var name: String { picked?.name ?? stackName ?? editing?.name ?? "" }
    var countsToward: String { picked?.countsToward ?? "" }
    var detail: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(isStack ? "STACK ITEM" : "COUNTS TOWARD \(countsToward.uppercased())").font(.yumo.overline).kerning(0.7).foregroundStyle(Color.yumo.accent)
                    Text(name).font(.nunito(19, .extrabold))
                    if isStack { Text("Not a tracked nutrient, so it won't change your numbers. Kept in your stack so the list is complete.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).fixedSize(horizontal: false, vertical: true) }
                    Rectangle().fill(Color.yumo.hairline).frame(height: 0.5).padding(.vertical, 4)
                    HStack { Text("Dose").font(.yumo.bodyStrong); Spacer()
                        InsetField(text: $doseText, unit: "", width: 92)
                        Menu { ForEach(Supplements.units, id: \.self) { u in Button(u) { unit = u } } } label: { HStack(spacing: 4) { Text(unit).font(.nunito(17, .bold)); Text("▾").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }.foregroundStyle(Color.yumo.ink).padding(.horizontal, 12).frame(height: 40).background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Color.yumo.track)) }
                    }
                    Rectangle().fill(Color.yumo.hairline).frame(height: 0.5).padding(.vertical, 4)
                    HStack { Text("Which days").font(.yumo.bodyStrong); Spacer(); Button { days = Array(repeating: true, count: 7) } label: { Text("Every day").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle()) }
                    DayDots(days: $days).padding(.top, 4)
                    Text(days.allSatisfy { $0 } ? "Every day" : "\(days.filter { $0 }.count) days a week · tap a day to toggle").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity)
                }.frame(maxWidth: .infinity, alignment: .leading).card()
                PrimaryButton(label: editing != nil ? "Save" : (isStack ? "Add to stack" : "Add \(shortName)"), disabled: (Double(doseText.replacingOccurrences(of: ",", with: ".")) ?? 0) <= 0 || !days.contains(true), action: save)
                if editing == nil { HStack { Spacer(); TextAction(label: "Back to search") { picked = nil; stackName = nil }; Spacer() } }
            }.padding(Space.gutter).padding(.bottom, 30)
        }.scrollDismissesKeyboard(.interactively)
    }
    var shortName: String { let n = name; return n.count > 14 ? String(n.split(separator: " ").first ?? Substring(n)) : n }
    func save() {
        let dose = Double(doseText.replacingOccurrences(of: ",", with: ".")) ?? 0
        let nutrients = picked.map { Supplements.amounts(for: $0, dose: dose, unit: unit) } ?? [:]
        if let e = editing { e.dose = dose; e.unit = unit; e.days = days; e.nutrients = nutrients; store.save(); toaster.show("Saved \(e.name)") }
        else { let s = Supplement(name: name, tier: isStack ? "stack" : "nutrient", dose: dose, unit: unit, days: days, nutrients: nutrients, catalogueId: picked?.id, order: 0); store.addSupplement(s); toaster.show(isStack ? "\(name) → your stack" : "\(name) counts toward \(countsToward)"); onAdded?(s) }
        dismiss()
    }
}

/// Onboarding step "Take anything daily?": search, added items beneath with pre-filled doses, Continue (empty just continues).
struct SupplementsOnboardingEditor: View {
    @Environment(\.modelContext) private var ctx
    @State private var add = false
    @State private var tick = 0
    var store: Store { Store(ctx) }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { add = true } label: {
                HStack { Text("Search supplements…").font(.yumo.bodyStrong).foregroundStyle(Color.yumo.inkMuted); Spacer() }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field)
            }.buttonStyle(PlainPressStyle())
            let list = store.supplements()
            if !list.isEmpty {
                VStack(spacing: 0) { ForEach(list, id: \.id) { s in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) { Text(s.name).font(.yumo.bodyStrong).lineLimit(1); Text(s.isNutrient ? "counts toward \(SupplementRow(s: s, onOpen: {}, onDelete: {}).countsToward)" : "stack only").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) }
                        Spacer(); Text(s.doseLabel).font(.nunito(15, .extrabold)).tabular().foregroundStyle(Color.yumo.ink)
                        Button { store.removeSupplement(s); tick += 1 } label: { Text("✕").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.inkMuted).frame(width: 32, height: 32) }.buttonStyle(PlainPressStyle())
                    }.padding(.vertical, 10).padding(.trailing, 12).hairline()
                } }.padding(.leading, Space.cardPad).listCard()
            }
        }.id(tick)
        .sheet(isPresented: $add, onDismiss: { tick += 1 }) { AddSupplementSheet().yumoSheet() }
    }
}
