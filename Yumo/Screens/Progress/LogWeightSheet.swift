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
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.kg(shown)).font(.yumo.rulerValue).kerning(-2).tabular(); Text(unit).font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        RulerView(value: $kg, min: 30, max: 250, perUnit: 120, lb: lb).frame(height: 72)
                        Text("Drag the ruler · 0.1 \(unit) steps").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
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
                    PrimaryButton(label: "Save \(Fmt.kg(shown)) \(unit)", action: save).padding(.top, 6)
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
        store.saveWeight(dayKey: dayKey, kg: (kg * 10).rounded() / 10, photo: photo)
        toaster.show("Logged · \(Fmt.kg(shown)) \(unit)"); session.changed()
        Task { await HealthSync.writeWeight(kg: kg, date: date) }
        dismiss()
    }
}

/// Horizontal tape: minor tick every 12pt (0.1), major every 120pt (1), labels under, faded edges, fixed accent needle. Drag right = lower.
struct RulerView: View {
    @Binding var value: Double; var min: Double; var max: Double; var perUnit: CGFloat; var lb: Bool
    @State private var startValue: Double? = nil
    @State private var lastTick: Int = 0
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, center = w / 2
            let shownValue = lb ? value * 2.20462 : value
            let lower = Int((shownValue - Double(w / 2 / perUnit)) - 1), upper = Int((shownValue + Double(w / 2 / perUnit)) + 1)
            ZStack(alignment: .topLeading) {
                ForEach(Array(stride(from: lower * 10, through: upper * 10, by: 1)), id: \.self) { t in
                    let v = Double(t) / 10, major = t % 10 == 0
                    let x = center + CGFloat(v - shownValue) * perUnit
                    if x > -20 && x < w + 20 {
                        Rectangle().fill(major ? Color.yumo.inkMuted : .yumo.grabber).frame(width: major ? 2 : 1.5, height: major ? 32 : 18).position(x: x, y: major ? 16 : 9)
                        if major { Text("\(t / 10)").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted).position(x: x, y: 46) }
                    }
                }
                Capsule().fill(Color.yumo.accent).frame(width: 3, height: 44).position(x: center, y: 22)
            }
            .overlay { LinearGradient(stops: [.init(color: .yumo.surface, location: 0), .init(color: .yumo.surface.opacity(0), location: 0.2), .init(color: .yumo.surface.opacity(0), location: 0.8), .init(color: .yumo.surface, location: 1)], startPoint: .leading, endPoint: .trailing).allowsHitTesting(false) }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { d in
                if startValue == nil { startValue = value }
                let deltaShown = -Double(d.translation.width / perUnit)
                var newShown = (lb ? startValue! * 2.20462 : startValue!) + deltaShown
                newShown = (newShown * 10).rounded() / 10
                let newKg = lb ? newShown / 2.20462 : newShown
                value = Swift.min(max, Swift.max(min, newKg))
                let tick = Int((newShown * 10).rounded()); if tick != lastTick { lastTick = tick; UISelectionFeedbackGenerator().selectionChanged() }
            }.onEnded { _ in startValue = nil })
        }.clipped()
    }
}
