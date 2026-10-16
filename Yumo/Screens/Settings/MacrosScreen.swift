import SwiftUI
import SwiftData

/// Target card with stacked bar; Protein / Fat steppers (±5 g); Carbs auto or manual; mismatch warning; presets; Save.
struct MacrosScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var protein = 0; @State private var fat = 0; @State private var carbs: Int? = nil; @State private var manual = false
    var store: Store { Store(ctx) }
    var body: some View {
        let t = store.targets(); let p = store.profile(); let kg = store.currentKg()
        let base = t.leanMass ?? kg
        let c = manual ? (carbs ?? Calc.carbs(target: t.kcal, protein: protein, fat: fat)) : Calc.carbs(target: t.kcal, protein: protein, fat: fat)
        let sum = Calc.macroKcal(p: protein, c: c, f: fat), diff = sum - t.kcal
        let total = Double(max(1, sum))
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Macros", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Target").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(Fmt.k(t.kcal)).font(.nunito(40, .extrabold)).kerning(-1).tabular(); Text("kcal").font(.yumo.displayMuted).foregroundStyle(Color.yumo.inkMuted) }
                        GeometryReader { g in HStack(spacing: 0) { Rectangle().fill(Color.yumo.accent).frame(width: g.size.width * 4 * Double(protein) / total); Rectangle().fill(Color.yumo.ink).frame(width: g.size.width * 4 * Double(c) / total); Rectangle().fill(Color.yumo.inkMuted) } }.frame(height: 10).clipShape(Capsule())
                        HStack { pct("Protein", 4 * protein, total); Spacer(); pct("Carbs", 4 * c, total); Spacer(); pct("Fat", 9 * fat, total) }
                    }.card()
                    ListCard {
                        SettingsRow(label: "Protein", sub: "\(String(format: "%.1f", Double(protein) / base)) g/kg · \(Fmt.k(4 * protein)) kcal") { ValueStepper(value: "\(protein) g", onMinus: { protein = max(0, protein - 5) }, onPlus: { protein += 5 }) }.hairline()
                        SettingsRow(label: "Fat", sub: "\(String(format: "%.1f", Double(fat) / base)) g/kg · \(Fmt.k(9 * fat)) kcal") { ValueStepper(value: "\(fat) g", onMinus: { fat = max(0, fat - 5) }, onPlus: { fat += 5 }) }.hairline()
                        if manual { SettingsRow(label: "Carbs", sub: "\(Fmt.k(4 * c)) kcal") { ValueStepper(value: "\(c) g", onMinus: { carbs = max(0, c - 5) }, onPlus: { carbs = c + 5 }) } }
                        else { SettingsRow(label: "Carbs", sub: "fills the rest · \(Fmt.k(4 * c)) kcal") { Text("\(c) g").font(.yumo.title).tabular() } }
                    }
                    ListCard { SettingsRow(label: "Set carbs manually") { Toggle("", isOn: $manual).labelsHidden().tint(.yumo.accent) } }
                    if manual && diff != 0 { Text("Macros add up to \(Fmt.k(sum)) kcal, \(diff > 0 ? "+" : "−")\(Fmt.k(abs(diff))) from your target.").font(.nunito(13, .extrabold)).tabular().foregroundStyle(Color.yumo.danger).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4) }
                    HStack(spacing: 12) {
                        preset("Recommended", "2.2 g/kg · 0.8 g/kg") { protein = Int((2.2 * base).rounded()); fat = Int((0.8 * base).rounded()) }
                        preset("High protein", "2.6 g/kg · 0.7 g/kg") { protein = Int((2.6 * base).rounded()); fat = Int((0.7 * base).rounded()) }
                    }
                    if t.leanMass != nil { Text("Presets are per kg of lean mass (body fat is set).").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                    PrimaryButton(label: "Save macros") { p.macrosCustomised = true; p.proteinG = protein; p.fatG = fat; p.carbsG = manual ? c : nil; store.save(); toaster.show("Macros saved"); session.changed(); dismiss() }.padding(.top, 8)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .onAppear { protein = t.protein; fat = t.fat; manual = p.carbsG != nil; carbs = p.carbsG }
    }
    func pct(_ l: String, _ kcal: Int, _ total: Double) -> some View { HStack(spacing: 4) { Text(l).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted); Text("\(Int((Double(kcal) / total * 100).rounded())) %").font(.yumo.caption).tabular() } }
    func preset(_ t: String, _ s: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { VStack(alignment: .leading, spacing: 2) { Text(t).font(.yumo.title); Text(s).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted) }.frame(maxWidth: .infinity, alignment: .leading).padding(16) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: Lift.card, radius: Radius.card)).foregroundStyle(Color.yumo.ink)
    }
}
