import SwiftUI
import SwiftData
import PhotosUI

/// Log / Edit weight: date stepper (past days only), ruler (0.1 kg steps, 120pt/kg), photo tile, last entry line, Save.
struct LogWeightSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State var dayKey: String
    @State private var kg: Double = 80
    @State private var photo: Data? = nil
    @State private var pick: PhotosPickerItem? = nil
    @State private var existing = false
    var store: Store { Store(ctx) }
    var date: Date { Date.fromKey(dayKey) }
    var lb: Bool { store.profile().weightUnitLb }
    var unit: String { lb ? "lb" : "kg" }
    var shown: Double { lb ? kg * 2.20462 : kg }
    var last: WeightEntry? { store.latestWeight(before: dayKey) }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: existing ? "Edit weight" : "Log weight", onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    HStack { ArrowButton(glyph: "‹") { load(date.adding(days: -1).dayKey) }; Spacer(); Text("\(Fmt.dayTitle(date))\(Calendar.current.isDateInToday(date) ? " · \(Fmt.dayFormatter.string(from: date))" : "")").font(.nunito(16, .extrabold)).tabular(); Spacer(); ArrowButton(glyph: "›", disabled: Calendar.current.isDateInToday(date)) { load(date.adding(days: 1).dayKey) } }
                        .padding(.horizontal, 6).frame(height: 52).background(RoundedRectangle(cornerRadius: Radius.button, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.button)
                    VStack(spacing: 8) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(String(format: "%.2f", shown)).font(.yumo.rulerValue).kerning(-2).tabular(); Text(unit).font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        RulerView(value: $kg, min: 30, max: 250, lb: lb)
                    }.frame(maxWidth: .infinity).card(padding: EdgeInsets(top: 18, leading: 0, bottom: 16, trailing: 0))
                    HStack(spacing: 14) {
                        PhotosPicker(selection: $pick, matching: .images) {
                            ZStack {
                                if let p = photo, let img = UIImage(data: p) { Image(uiImage: img).resizable().scaledToFill().frame(width: 76, height: 76).clipShape(RoundedRectangle(cornerRadius: Radius.field)).overlay(alignment: .bottomTrailing) { Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.yumo.accent, .white).padding(4) } }
                                else { RoundedRectangle(cornerRadius: Radius.field).stroke(Color.yumo.grabber, style: StrokeStyle(lineWidth: 2, dash: [6, 4])).frame(width: 76, height: 76).overlay { VStack(spacing: 2) { Text("+").font(.nunito(22, .extrabold)); Text("Add photo").font(.nunito(11, .bold)) }.foregroundStyle(Color.yumo.inkMuted) } }
                            }
                        }
                        if let l = last { Text("Last · \(Fmt.kg(lb ? l.kg * 2.20462 : l.kg)) \(unit) on \(Fmt.dayFormatter.string(from: l.date)) · \(Fmt.delta((lb ? 2.20462 : 1) * (kg - l.kg), unit: unit))").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted) }
                        else { Text("Your first entry.").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                        Spacer()
                    }
                    PrimaryButton(label: "Save \(String(format: "%.2f", shown)) \(unit)", action: save).padding(.top, 6)
                    if existing { TextAction(label: "Delete this entry", danger: true) { if let w = store.weight(dayKey) { store.deleteWeight(w) }; toaster.show("Deleted \(Fmt.dayTitle(date))"); session.changed(); dismiss() } }
                }.padding(Space.gutter).padding(.bottom, 30)
            }
        }
        .background(Color.yumo.bg)
        .onAppear { load(dayKey) }
        .onChange(of: pick) { Task { if let d = try? await pick?.loadTransferable(type: Data.self), let img = UIImage(data: d) { photo = img.jpegData(compressionQuality: 0.8) } } }  // JPEG re-encode strips EXIF
    }
    func load(_ k: String) {
        dayKey = k
        if let w = store.weight(k) { kg = w.kg; photo = w.photo; existing = true } else { kg = last?.kg ?? store.currentKg(); photo = nil; existing = false }
    }
    func save() {
        store.saveWeight(dayKey: dayKey, kg: (kg * 100).rounded() / 100, photo: photo)
        toaster.show("Logged · \(Fmt.kg(shown)) \(unit)"); session.changed()
        Task { await HealthSync.writeWeight(kg: kg, date: date) }
        dismiss()
    }
}

/// Horizontal tape: minor tick every 12pt (0.1), major every 120pt (1), labels under, faded edges, fixed accent needle. Drag right = lower.
/// The one Ruler (rev 5, `yumo-ruler.js`): 12 pt per step; 0.1 kg, 0.05 with the finger 40–90 pt below where it touched, 0.01 beyond 90 (iOS scrubber
/// gesture). Release ≥ 0.4 kg/s in normal mode coasts (velocity × 0.0025^dt) and settles to 0.1; fine mode never coasts. Range 30–250 kg.
struct RulerView: View {
    @Binding var value: Double; var min: Double = 30; var max: Double = 250; var lb: Bool = false
    @State private var step: Double = 0.1
    @State private var drag: (x: CGFloat, y0: CGFloat, t: Date, raw: Double, v: Double)? = nil
    @State private var coast: Timer? = nil
    @State private var lastTick = 0
    let px: CGFloat = 12
    var shown: Double { lb ? value * 2.20462 : value }
    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { g in
                let w = g.size.width, center = w / 2
                let st = step, unit = st * 10
                let span = Double(w / 2 / px) * st
                let lo = Int(((shown - span) / st).rounded(.down)) - 1, hi = Int(((shown + span) / st).rounded(.up)) + 1
                ZStack(alignment: .topLeading) {
                    ForEach(lo...hi, id: \.self) { i in
                        let v = Double(i) * st, major = i % 10 == 0
                        let x = center + CGFloat((v - shown) / st) * px
                        Rectangle().fill(major ? Color.yumo.inkMuted : .yumo.grabber).frame(width: major ? 2 : 1.5, height: major ? 32 : 18).position(x: x, y: major ? 16 : 9)
                        if major { Text(st == 0.1 ? String(Int((v / unit).rounded()) * Int(unit * 10) / 10) : String(format: "%.1f", v)).font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).position(x: x, y: 46) }
                    }
                    Capsule().fill(Color.yumo.accent).frame(width: 3, height: 44).position(x: center, y: 22)
                }
                .overlay { LinearGradient(stops: [.init(color: .yumo.surface, location: 0), .init(color: .yumo.surface.opacity(0), location: 0.2), .init(color: .yumo.surface.opacity(0), location: 0.8), .init(color: .yumo.surface, location: 1)], startPoint: .leading, endPoint: .trailing).allowsHitTesting(false) }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .local).onChanged { d in
                    coast?.invalidate(); coast = nil
                    let now = Date()
                    if drag == nil { drag = (d.location.x, d.location.y, now, shown, 0) }
                    guard var dr = drag else { return }
                    let dx = d.location.x - dr.x, dt = Swift.max(0.001, now.timeIntervalSince(dr.t)), dy = d.location.y - dr.y0
                    let st2: Double = dy > 90 ? 0.01 : dy > 40 ? 0.05 : 0.1
                    let dkg = -Double(dx / px) * st2
                    dr.raw = Swift.min(maxShown, Swift.max(minShown, dr.raw + dkg)); dr.v = 0.7 * dr.v + 0.3 * (dkg / dt); dr.x = d.location.x; dr.t = now; drag = dr
                    step = st2
                    set((dr.raw / st2).rounded() * st2)
                }.onEnded { _ in
                    guard let dr = drag else { return }; drag = nil
                    let fine = step < 0.1
                    if fine || abs(dr.v) < 0.4 { set((dr.raw / (fine ? 0.01 : 0.1)).rounded() * (fine ? 0.01 : 0.1)); UIImpactFeedbackGenerator(style: .rigid).impactOccurred(); return }
                    var v = dr.v, raw = dr.raw, last = Date()
                    coast = Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { t in
                        let now = Date(), dt = Swift.min(0.04, now.timeIntervalSince(last)); last = now
                        v *= pow(0.0025, dt); raw = Swift.min(maxShown, Swift.max(minShown, raw + v * dt))
                        set((raw / 0.1).rounded() * 0.1)
                        if abs(v) < 0.25 { t.invalidate(); coast = nil; UIImpactFeedbackGenerator(style: .rigid).impactOccurred() }
                    }
                })
            }.frame(height: 56).clipped()
            Text(step == 0.01 ? "Fine · 0.01 kg" : step == 0.05 ? "Half speed · 0.05 kg" : " ").font(.nunito(12, .extrabold)).foregroundStyle(Color.yumo.accent).animation(Motion.expand, value: step)
        }
    }
    var minShown: Double { lb ? min * 2.20462 : min }
    var maxShown: Double { lb ? max * 2.20462 : max }
    func set(_ s: Double) {
        let kg = lb ? s / 2.20462 : s
        value = Swift.min(max, Swift.max(min, kg))
        let tick = Int((s / step).rounded()); if tick != lastTick { lastTick = tick; if step < 0.05 { UIImpactFeedbackGenerator(style: .soft).impactOccurred() } else { UISelectionFeedbackGenerator().selectionChanged() } }
    }
}
