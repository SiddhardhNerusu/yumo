import SwiftUI
import SwiftData

/// Rev 11 §9: Today › "View summary ›". Macro donut by calories · three pinned nutrients (today so far) · the complete diary. A reading surface: no swipe actions.
struct SummaryScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    var dayKey: String
    @State private var detail: FoodEntry? = nil
    @State private var showNutrients = false
    var store: Store { Store(ctx) }
    var day: Date { Date.fromKey(dayKey) }
    /// "1,500" for mg / µg values in the thousands, otherwise the nutrient formatter.
    func num(_ v: Double, _ unit: String) -> String { v >= 1000 && unit != "g" ? Fmt.k(v) : Nutrients.format(v, unit: unit) }

    var body: some View {
        let entries = store.entries(dayKey), t = store.targets(), p = store.profile()
        let totals = DayTotals(entries)
        VStack(spacing: 0) {
            PageHeader(back: Fmt.dayTitle(day), title: "Summary", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(spacing: 0) {
                    macrosCard(totals, t)
                    nutrientsCard(entries, t, p).padding(.top, Space.cardGap)
                    HStack(alignment: .firstTextBaseline) {
                        Text("Complete diary").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                        Spacer()
                        Text(entries.isEmpty ? "Nothing logged" : "\(entries.count) food\(entries.count == 1 ? "" : "s") · \(Fmt.k(totals.kcal)) kcal").font(.nunito(13, .extrabold)).tabular().foregroundStyle(Color.yumo.inkMuted)
                    }.padding(EdgeInsets(top: 22, leading: 4, bottom: 0, trailing: 4))
                    ForEach(Meal.allCases) { meal in mealCard(meal, entries.filter { $0.meal == meal }).padding(.top, Space.cardGapDense) }
                }.padding(EdgeInsets(top: 12, leading: Space.gutter, bottom: 40, trailing: Space.gutter))
            }.scrollIndicators(.hidden)
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .pushCover(item: $detail) { e in FoodDetailScreen(entry: e, dayKey: dayKey) }
        .pushCover(isPresented: $showNutrients) { ProgressNutrientsScreen(back: "Summary") }
    }

    // MARK: §9.1 Macros card — donut by calorie share (P × 4, C × 4, F × 9)
    func macrosCard(_ totals: DayTotals, _ t: Targets) -> some View {
        let kc = [totals.p * 4, totals.c * 4, totals.f * 9], sum = kc.reduce(0, +)
        let shares = sum > 0 ? kc.map { $0 / sum } : [0, 0, 0]
        let rows: [(String, Double, Int, Color, Double)] = [("Protein", totals.p, t.protein, .yumo.ink, shares[0]), ("Carbs", totals.c, t.carbs, .yumo.accent, shares[1]), ("Fat", totals.f, t.fat, .yumo.accentSoft, shares[2])]
        return VStack(alignment: .leading, spacing: 0) {
            Text("Macros · by calories").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
            HStack(spacing: 20) {
                MacroDonut(shares: shares, colors: rows.map { $0.3 }, kcal: totals.kcal)
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(rows, id: \.0) { r in
                        HStack(spacing: 10) {
                            RoundedRectangle(cornerRadius: 3).fill(r.3).frame(width: 10, height: 10)
                            VStack(alignment: .leading, spacing: 0) {
                                HStack(alignment: .firstTextBaseline, spacing: 4) { Text(r.0).font(.nunito(14, .extrabold)); Text(sum > 0 ? "\(Int((r.4 * 100).rounded())) %" : "—").font(.nunito(14, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted) }
                                Text("\(Fmt.g(r.1)) g / \(r.2)").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
                            }
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.padding(.top, 12)
        }.foregroundStyle(Color.yumo.ink).frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20))
    }

    // MARK: §9.2 Nutrients card — the three pinned nutrients, today so far (food + supplements). Under 70 % → warning dot + bar; over a limit → danger.
    func nutrientsCard(_ entries: [FoodEntry], _ t: Targets, _ p: UserProfile) -> some View {
        var keys = p.pinnedNutrients
        for k in ["fibre", "sodium_mg", "iron_mg"] where keys.count < 3 && !keys.contains(k) { keys.append(k) }
        let rows: [(Nutrient, Double?, Double?, Bool)] = keys.compactMap { k in
            guard let n = Nutrients.by(k) else { return nil }
            let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
            return (n, store.nutrientTotal(k, dayKey: dayKey, entries: entries), goal ?? ul, goal == nil && ul != nil)
        }
        let logged = !entries.isEmpty
        func status(_ r: (Nutrient, Double?, Double?, Bool)) -> (Color, Color) {   // (dot, bar)
            guard logged, let v = r.1, let ref = r.2, ref > 0 else { return (.yumo.inkMuted, .yumo.accent) }
            if r.3 { return v > ref ? (.yumo.danger, .yumo.danger) : (.yumo.inkMuted, .yumo.accent) }
            return v / ref < 0.7 ? (.yumo.warning, .yumo.warning) : (.yumo.inkMuted, .yumo.accent)
        }
        let anyLow = rows.contains { status($0).0 == .yumo.warning }
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("Nutrients").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                Spacer()
                Button { showNutrients = true } label: { Text("All \(Nutrients.all.count) ›").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle())
            }
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                    let (dot, bar) = status(r)
                    let frac = (r.1 != nil && r.2 != nil && r.2! > 0) ? min(1, r.1! / r.2!) : 0
                    HStack(spacing: 0) {
                        HStack(spacing: 8) { Circle().fill(dot).frame(width: 8, height: 8); Text(r.0.name.components(separatedBy: " (").first ?? r.0.name).font(.yumo.subtitle).foregroundStyle(Color.yumo.ink).lineLimit(1) }
                        Spacer(minLength: 8)
                        ZStack(alignment: .leading) { Capsule().fill(Color.yumo.track); Capsule().fill(bar).frame(width: 100 * frac) }.frame(width: 100, height: 6).padding(.trailing, 12).animation(Motion.bar, value: frac)
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text(r.1.map { num($0, r.0.unit) + " " + r.0.unit } ?? "—").font(.nunito(14, .extrabold)).tabular().foregroundStyle(Color.yumo.ink)
                            Text("/ " + (r.2.map { num($0, r.0.unit) } ?? "—")).font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted)
                        }.frame(width: 84, alignment: .trailing).lineLimit(1).minimumScaleFactor(0.8)
                    }.padding(.vertical, 9).overlay(alignment: .bottom) { if i < rows.count - 1 { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) } }
                }
            }.padding(.top, 4)
            let today = Calendar.current.isDateInToday(day)
            Text(!logged ? "Log something and the day fills in here." : anyLow ? (today ? "Amber = under 70 % so far today. Your stack is counted." : "Amber = under 70 % that day. Your stack is counted.") : (today ? "All three on track so far today. Your stack is counted." : "All three on track that day. Your stack is counted.")).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.top, 8)
        }.frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 14, trailing: 20))
    }

    // MARK: §9.3 Complete diary — one card per meal, DiaryRows (press → color.pressed, tap → Food)
    func mealCard(_ meal: Meal, _ es: [FoodEntry]) -> some View {
        let tot = DayTotals(es)
        return VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                HStack(alignment: .firstTextBaseline, spacing: 4) { Text(meal.rawValue).font(.nunito(16, .extrabold)); if !es.isEmpty { Text("\(es.count) food\(es.count == 1 ? "" : "s")").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) } }
                Spacer(); Text(es.isEmpty ? "—" : Fmt.k(tot.kcal)).font(.nunito(15, .extrabold)).tabular()
            }.foregroundStyle(Color.yumo.ink).padding(EdgeInsets(top: 14, leading: 20, bottom: 8, trailing: 20))
            ForEach(es, id: \.id) { e in DiaryRow(entry: e) { detail = e } }
            if es.isEmpty { Text("Nothing logged").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted).frame(maxWidth: .infinity, alignment: .leading).padding(EdgeInsets(top: 0, leading: 20, bottom: 14, trailing: 20)) }
        }.frame(maxWidth: .infinity).listCard()
    }
}

/// Rev 11 DiaryRow: 2-column grid (1fr auto, gap 2 / 14), padding 10 20, hairline top: name 15/700 · kcal 15/800 · amount 12/700 muted · "17 P · 66 C · 7 F" 12/700 muted. Press color.pressed, tap → Food.
struct DiaryRow: View {
    var entry: FoodEntry; var onOpen: () -> Void
    var body: some View {
        let nd = Food.split(entry.foodName, state: entry.state)
        Button(action: onOpen) {
            VStack(spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 14) { Text(nd.name).font(.yumo.subtitle).lineLimit(1); Spacer(minLength: 0); Text(entry.lost ? "—" : Fmt.k(entry.kcal)).font(.nunito(15, .extrabold)).tabular() }
                HStack(alignment: .firstTextBaseline, spacing: 14) { Text(entry.amountLabel).font(.yumo.footnote).lineLimit(1); Spacer(minLength: 0); Text(entry.macrosUnknown ? "— P · — C · — F" : "\(Fmt.g(entry.p)) P · \(Fmt.g(entry.c)) C · \(Fmt.g(entry.f)) F").font(.yumo.footnote).tabular().lineLimit(1) }.foregroundStyle(Color.yumo.inkMuted)
            }.foregroundStyle(Color.yumo.ink).padding(EdgeInsets(top: 10, leading: 20, bottom: 10, trailing: 20))
        }.buttonStyle(RowPressStyle())
        .overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
    }
}

/// Rev 11 MacroDonut: 120 pt, r 44, stroke 14, track color.track; arcs ink / accent / accent.soft by calorie share from 12 o'clock, clockwise, butt caps; 500 ms on the one curve. Centre eaten kcal 22/800 −0.5 + "kcal" 11/700 muted.
struct MacroDonut: View {
    var shares: [Double]; var colors: [Color]; var kcal: Double
    @State private var shown: [Double] = [0, 0, 0]
    var body: some View {
        ZStack {
            Circle().stroke(Color.yumo.track, lineWidth: 14)
            ForEach(0..<3, id: \.self) { i in
                let start = shown.prefix(i).reduce(0, +)
                Circle().trim(from: start, to: start + shown[i]).stroke(colors[i], style: StrokeStyle(lineWidth: 14, lineCap: .butt)).rotationEffect(.degrees(-90))
            }
            VStack(spacing: 3) { Text(Fmt.k(kcal)).font(.nunito(22, .extrabold)).kerning(-0.5).tabular().foregroundStyle(Color.yumo.ink); Text("kcal").font(.nunito(11, .bold)).foregroundStyle(Color.yumo.inkMuted) }
        }
        .frame(width: 120, height: 120).padding(7)
        .onAppear { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.5)) { shown = shares } }
        .onChange(of: shares) { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.5)) { shown = shares } }
    }
}
