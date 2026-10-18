import SwiftUI
import SwiftData

struct WeightLogScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var mode = 0
    @State private var weights: [WeightEntry] = []
    @State private var edit: DayKey? = nil
    var store: Store { Store(ctx) }
    var lb: Bool { store.profile().weightUnitLb }
    func disp(_ kg: Double) -> Double { lb ? kg * 2.20462 : kg }
    var unit: String { lb ? "lb" : "kg" }
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Progress", title: "Weight", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            Segmented(options: [(0, "List"), (1, "Photos")], selection: $mode).padding(.horizontal, Space.gutter).padding(.top, 6)
            ScrollView {
                if mode == 0 { list } else { photos }
            }.scrollIndicators(.hidden)
            PrimaryButton(label: "Log weight") { edit = DayKey(id: Date().dayKey) }.padding(.horizontal, Space.gutter).padding(.bottom, 8)
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .onAppear(perform: reload).onChange(of: session.tick) { reload() }
        .sheet(item: $edit) { k in LogWeightSheet(dayKey: k.id).yumoSheet() }
    }
    func reload() { weights = store.weights() }
    var months: [(String, [WeightEntry])] {
        var out: [(String, [WeightEntry])] = []
        for w in weights { let m = Fmt.monthFormatter.string(from: w.date); if out.last?.0 == m { out[out.count - 1].1.append(w) } else { out.append((m, [w])) } }
        return out
    }
    func deltaFor(_ w: WeightEntry) -> Double? { guard let i = weights.firstIndex(where: { $0.dayKey == w.dayKey }), i + 1 < weights.count else { return nil }; return w.kg - weights[i + 1].kg }
    var list: some View {
        VStack(alignment: .leading, spacing: Space.cardGapDense) {
            ForEach(months, id: \.0) { m in
                Overline(text: m.0).padding(.top, 10)
                ListCard { ForEach(m.1, id: \.dayKey) { w in WeightRow(w: w, delta: deltaFor(w), disp: disp(w.kg), unit: unit, onOpen: { edit = DayKey(id: w.dayKey) }, onDelete: { store.deleteWeight(w); toaster.show("Deleted \(Fmt.dayTitle(w.date))"); session.changed() }).padding(.leading, -Space.cardPad) } }
            }
            if weights.isEmpty { Text("No weights yet. Log one to start the trend.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 20) }
        }.padding(.horizontal, Space.gutter).padding(.bottom, 20)
    }
    var photos: some View {
        let withPhoto = weights.filter { $0.photo != nil }
        return Group {
            if withPhoto.isEmpty { Text("No photos yet. Add one when you log a weight.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 30) }
            else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 14) {
                    ForEach(withPhoto, id: \.dayKey) { w in
                        VStack(spacing: 6) {
                            if let d = w.photo, let img = UIImage(data: d) { Image(uiImage: img).resizable().scaledToFill().aspectRatio(3 / 4, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous)) }
                            Text("\(Fmt.dayTitle(w.date)) · \(Fmt.kg(disp(w.kg)))").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
                        }.onTapGesture { edit = DayKey(id: w.dayKey) }
                    }
                }.padding(Space.gutter)
            }
        }
    }
}

struct WeightRow: View {
    var w: WeightEntry; var delta: Double?; var disp: Double; var unit: String; var onOpen: () -> Void; var onDelete: () -> Void
    @State private var dx: CGFloat = 0
    var body: some View {
        ZStack(alignment: .trailing) {
            SwipeReveal(dx: dx, label: "Delete").opacity(min(1, abs(dx) / 80))
            HStack(spacing: 12) {
                if let d = w.photo, let img = UIImage(data: d) { Image(uiImage: img).resizable().scaledToFill().frame(width: 40, height: 40).clipShape(RoundedRectangle(cornerRadius: Radius.thumb)) }
                Text(Fmt.dayTitle(w.date)).font(.yumo.bodyStrong)
                Spacer()
                if let d = delta { Text(Fmt.delta(unit == "lb" ? d * 2.20462 : d, unit: unit)).font(.nunito(13, .extrabold)).tabular().foregroundStyle(d < 0 ? Color.yumo.accent : d > 0 ? .yumo.danger : .yumo.inkMuted) }
                Text("\(Fmt.kg(disp)) \(unit)").font(.yumo.title).tabular()
            }
            .padding(.vertical, Space.rowSettings).padding(.horizontal, Space.cardPad).frame(minHeight: 52).background(Color.yumo.surface).contentShape(Rectangle()).offset(x: dx)
            .onTapGesture(perform: onOpen)
            .gesture(DragGesture(minimumDistance: 8).onChanged { v in if v.translation.width < 0 { dx = v.translation.width } }.onEnded { v in if v.translation.width < -110 { withAnimation(Motion.remove) { dx = -420 }; Task { try? await Task.sleep(for: .milliseconds(320)); onDelete() } } else { withAnimation(Motion.snap) { dx = 0 } } })
        }.clipped().hairline()
    }
}
