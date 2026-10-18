import SwiftUI
import SwiftData

struct CreateFoodDraft: Identifiable { var id = UUID(); var name = ""; var barcode: String? = nil }

/// Create a food: name, brand, barcode, serving size + unit, kcal and macros per serving, optional micronutrients. Live preview on top.
struct CreateFoodScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    var draft: CreateFoodDraft; var onSaved: ((Food) -> Void)?
    @State private var name = ""; @State private var brand = ""; @State private var barcode = ""
    @State private var serving = "100"; @State private var unit = "g"
    @State private var kcal = ""; @State private var p = ""; @State private var c = ""; @State private var f = ""
    @State private var fibre = ""; @State private var sugar = ""; @State private var salt = ""; @State private var sat = ""
    var valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && Double(kcal) != nil && Double(p) != nil && Double(c) != nil && Double(f) != nil && (Double(serving) ?? 0) > 0 }
    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Create a food", onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            ScrollView {
                VStack(spacing: Space.cardGapDense) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(name.isEmpty ? "New food" : name).font(.yumo.title).lineLimit(1)
                        HStack(alignment: .firstTextBaseline, spacing: 6) { Text(kcal.isEmpty ? "0" : Fmt.k(Double(kcal) ?? 0)).font(.yumo.statBig).tabular(); Text("kcal · per \(serving) \(unit)").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                        Text("P \(p.isEmpty ? "–" : p) · C \(c.isEmpty ? "–" : c) · F \(f.isEmpty ? "–" : f)").font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                    }.frame(maxWidth: .infinity, alignment: .leading).card()
                    ListCard {
                        field("Name", $name, keyboard: .default); field("Brand", $brand, keyboard: .default); field("Barcode", $barcode, keyboard: .numberPad)
                        SettingsRow(label: "Serving size") { HStack(spacing: 8) { TextField("100", text: $serving).keyboardType(.decimalPad).font(.yumo.body).tabular().multilineTextAlignment(.trailing).frame(width: 70); Segmented(options: [("g", "g"), ("ml", "ml"), ("piece", "piece")], selection: $unit, compact: true).frame(width: 150) } }.hairline()
                    }
                    Overline(text: "Per serving").frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
                    ListCard { field("kcal", $kcal); field("Protein g", $p); field("Carbs g", $c); field("Fat g", $f) }
                    Overline(text: "Optional").frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
                    ListCard { field("Fibre g", $fibre); field("Sugar g", $sugar); field("Salt g", $salt); field("Saturated fat g", $sat) }
                    PrimaryButton(label: "Save food", disabled: !valid, action: save).padding(.top, 8)
                }.padding(Space.gutter).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
        }
        .background(Color.yumo.bg)
        .onAppear { name = draft.name; barcode = draft.barcode ?? "" }
        .presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden)
    }
    func field(_ label: String, _ b: Binding<String>, keyboard: UIKeyboardType = .decimalPad) -> some View {
        SettingsRow(label: label) { TextField(keyboard == .default ? "" : "0", text: b).keyboardType(keyboard).font(.yumo.body).tabular().multilineTextAlignment(.trailing).frame(maxWidth: 180) }.hairline()
    }
    func save() {
        let grams = Double(serving) ?? 100; let factor = 100 / grams
        let label = unit == "piece" ? "1 piece · \(Fmt.g(grams)) g" : "\(Fmt.g(grams)) \(unit)"
        let food = Food(name: name.trimmingCharacters(in: .whitespaces), brand: brand.isEmpty ? nil : brand, barcode: barcode.isEmpty ? nil : barcode, source: .user, servings: [Serving(label: label, grams: grams), Serving(label: "100 g", grams: 100)],
                        kcal100: (Double(kcal) ?? 0) * factor, p100: (Double(p) ?? 0) * factor, c100: (Double(c) ?? 0) * factor, f100: (Double(f) ?? 0) * factor)
        food.fibre100 = Double(fibre).map { $0 * factor }; food.sugar100 = Double(sugar).map { $0 * factor }; food.salt100 = Double(salt).map { $0 * factor }; food.satFat100 = Double(sat).map { $0 * factor }
        let saved = Store(ctx).upsert(food)
        toaster.show("Saved \(saved.name)"); dismiss(); onSaved?(saved)
    }
}
