import SwiftUI
import SwiftData

struct SavedMealsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var meals: [SavedMeal] = []
    @State private var renaming: SavedMeal? = nil
    @State private var newName = ""
    var store: Store { Store(ctx) }
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Saved meals", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(spacing: Space.cardGap) {
                    if meals.isEmpty { Text("No saved meals yet. Use \"Save as meal\" under a meal on Today.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 20) }
                    ForEach(meals, id: \.id) { m in
                        let foods = m.items.compactMap { store.food(id: $0.foodId) }
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(m.name).font(.yumo.title); Tag(label: m.meal.rawValue); Spacer(); Text(Fmt.k(m.items.reduce(0) { $0 + (store.food(id: $1.foodId)?.kcal(for: $1.servingGrams * $1.quantity) ?? 0) })).font(.yumo.title).tabular() }
                            Text(foods.map(\.name).joined(separator: " · ")).font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted)
                            HStack(spacing: 18) {
                                TextAction(label: "Log to \(Meal.forNow().rawValue)") { store.logSavedMeal(m, meal: Meal.forNow(), dayKey: session.selectedDate.dayKey); toaster.show("\(m.name) → \(Meal.forNow().rawValue)"); session.changed() }
                                TextAction(label: "Rename") { newName = m.name; renaming = m }
                                Spacer(); TextAction(label: "Delete", danger: true) { store.delete(m); reload() }
                            }.padding(.top, 2)
                        }.frame(maxWidth: .infinity, alignment: .leading).card()
                    }
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }
        .background(Color.yumo.bg.ignoresSafeArea()).onAppear(perform: reload)
        .alert("Rename meal", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) { TextField("Name", text: $newName); Button("Save") { renaming?.name = newName; store.save(); reload() }; Button("Cancel", role: .cancel) {} }
    }
    func reload() { meals = store.savedMeals() }
}

/// Everything the user scanned, logged or created. This is the catalogue; no separate recent-barcodes list.
struct MyFoodsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    @State private var foods: [Food] = []
    @State private var q = ""
    var store: Store { Store(ctx) }
    var shown: [Food] { let base = foods.filter { $0.useCount > 0 || $0.source == .user }; return q.isEmpty ? base : base.filter { $0.name.lowercased().contains(q.lowercased()) } }
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "My foods", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            HStack(spacing: 10) { MagnifierGlyph(color: .yumo.inkMuted, size: 18); TextField("Filter", text: $q).font(.yumo.body) }.padding(.horizontal, 16).frame(height: 50).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field).padding(.horizontal, Space.gutter).padding(.top, 8)
            ScrollView {
                VStack(spacing: 0) {
                    if shown.isEmpty { Text("Nothing here yet. Foods you scan, log or create appear here.").font(.yumo.detail).foregroundStyle(Color.yumo.inkMuted).padding(.top, 20) }
                    else {
                        ListCard {
                            ForEach(shown, id: \.id) { f in
                                SettingsRow(label: f.name, sub: [f.sourceLine, f.barcode, f.useCount > 0 ? "logged \(f.useCount)×" : nil].compactMap { $0 }.joined(separator: " · ")) {
                                    HStack(spacing: 10) { Text("\(Fmt.k(f.kcal100))").font(.yumo.title).tabular(); Text("/100 g").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
                                }.hairline()
                                .contextMenu { if f.source == .user { Button("Delete", role: .destructive) { ctx.delete(f); store.save(); reload(); toaster.show("Deleted \(f.name)") } } }
                            }
                        }
                    }
                }.padding(Space.gutter).padding(.bottom, 40)
            }.scrollDismissesKeyboard(.interactively)
        }.background(Color.yumo.bg.ignoresSafeArea()).onAppear(perform: reload)
    }
    func reload() { foods = store.foods() }
}
