import SwiftUI
import SwiftData

struct SettingsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var page: Page? = nil
    @State private var share: [URL]? = nil
    @State private var confirmDelete = false
    @State private var confirmSignOut = false
    @State private var tick = 0
    @State private var timeEdit: TimeEdit? = nil
    struct TimeEdit: Identifiable { var id: String; var minutes: Int }
    enum Page: String, Identifiable { case target, macros, nutrients, staples, savedMeals, myFoods, password; var id: String { rawValue } }
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile(); let t = store.targets()
        VStack(spacing: 0) {
            PageHeader(back: "Progress", title: "Settings", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGap) {
                    section("Goals") {
                        row("Calorie target", "\(Fmt.k(t.kcal)) · \(p.goalMode.rawValue)\(p.goalMode == .maintain ? "" : " \(Fmt.delta(p.paceKgPerWeek, unit: "kg/wk"))")") { page = .target }.hairline()
                        row("Macros", "P \(t.protein) · C \(t.carbs) · F \(t.fat)") { page = .macros }.hairline()
                        row("Nutrients", "\(p.pinnedNutrients.count) pinned") { page = .nutrients }
                    }
                    section("Units") {
                        SettingsRow(label: "Weight") { Segmented(options: [(false, "kg"), (true, "lb")], selection: Binding(get: { p.weightUnitLb }, set: { p.weightUnitLb = $0; store.save(); tick += 1 })).frame(width: 140) }.hairline()
                        SettingsRow(label: "Volume") { Segmented(options: [(false, "ml"), (true, "fl oz")], selection: Binding(get: { p.volumeUnitFlOz }, set: { p.volumeUnitFlOz = $0; store.save(); tick += 1 })).frame(width: 140) }
                    }
                    section("Food") {
                        row("Staples", store.staples().isEmpty ? "None yet" : "\(store.staples().count) food\(store.staples().count == 1 ? "" : "s")") { page = .staples }.hairline()
                        row("Saved meals", "\(store.savedMeals().count)") { page = .savedMeals }.hairline()
                        row("My foods", "\(store.foods().filter { $0.useCount > 0 || $0.source == .user }.count)") { page = .myFoods }
                    }
                    section("Reminders") {
                        SettingsRow(label: "Log weight · \(Reminders.time(p.reminderWeightMinutes))") { Toggle("", isOn: Binding(get: { p.reminderWeightOn }, set: { p.reminderWeightOn = $0; store.save(); Reminders.reschedule(p); tick += 1 })).labelsHidden().tint(.yumo.accent) }.contentShape(Rectangle()).onTapGesture { timeEdit = TimeEdit(id: "weight", minutes: p.reminderWeightMinutes) }.hairline()
                        SettingsRow(label: "Log dinner · \(Reminders.time(p.reminderDinnerMinutes))") { Toggle("", isOn: Binding(get: { p.reminderDinnerOn }, set: { p.reminderDinnerOn = $0; store.save(); Reminders.reschedule(p); tick += 1 })).labelsHidden().tint(.yumo.accent) }.contentShape(Rectangle()).onTapGesture { timeEdit = TimeEdit(id: "dinner", minutes: p.reminderDinnerMinutes) }
                    }
                    section("Data") {
                        row("Export as CSV", "All days") { share = CSVExport.files(store) }.hairline()
                        row("Apple Health", "Weight & energy") { Task { if await HealthSync.request() { toaster.show("Apple Health connected") } else { toaster.show("Health not available") } } }
                    }
                    section("Account") {
                        SettingsRow(label: "Username") { Text(p.username).font(.yumo.body).foregroundStyle(Color.yumo.inkMuted) }.hairline()
                        row("Change password", "") { page = .password }.hairline()
                        SettingsRow(label: "Sign out") { EmptyView() }.contentShape(Rectangle()).onTapGesture { confirmSignOut = true }
                    }
                    section("Help") {
                        SettingsRow(label: "Show me around") { ChevronValue(value: "Replay the tour") }.contentShape(Rectangle()).onTapGesture { let s = store; dismiss(); session.tab = .today; Task { try? await Task.sleep(for: .milliseconds(600)); Tour.shared.start(store: s, session: session) } }
                    }
                    section("About") {
                        SettingsRow(label: "Food data") { ChevronValue(value: "Open Food Facts · ODbL") }.contentShape(Rectangle()).onTapGesture { UIApplication.shared.open(URL(string: "https://world.openfoodfacts.org")!) }.hairline()
                        SettingsRow(label: "Version") { Text("\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"))").font(.yumo.body).tabular().foregroundStyle(Color.yumo.inkMuted) }.hairline()
                        SettingsRow(label: "Delete account", danger: true) { EmptyView() }.contentShape(Rectangle()).onTapGesture { confirmDelete = true }
                    }
                    Text("Product data © Open Food Facts contributors, available under the Open Database License.").font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 4).padding(.top, 4)
                }.padding(.horizontal, Space.gutter).padding(.bottom, 40)
            }
        }
        .id(tick)
        .background(Color.yumo.bg.ignoresSafeArea())
        .fullScreenCover(item: $page) { pg in
            switch pg {
            case .target: CalorieTargetScreen(); case .macros: MacrosScreen(); case .nutrients: NutrientsSettingsScreen(); case .staples: StaplesScreen(onChange: { tick += 1 }); case .savedMeals: SavedMealsScreen(); case .myFoods: MyFoodsScreen(); case .password: ChangePasswordScreen()
            }
        }
        .onChange(of: page) { if page == nil { tick += 1 } }
        .sheet(item: $timeEdit) { t in
            TimeSheet(title: t.id == "weight" ? "Log weight reminder" : "Log dinner reminder", minutes: t.minutes) { m in
                if t.id == "weight" { p.reminderWeightMinutes = m; p.reminderWeightOn = true } else { p.reminderDinnerMinutes = m; p.reminderDinnerOn = true }
                store.save(); Reminders.reschedule(p); tick += 1
            }.yumoSheet().presentationDetents([.height(380)])
        }
        .sheet(item: Binding(get: { share.map { ShareItems(urls: $0) } }, set: { _ in share = nil })) { ShareSheet(items: $0.urls) }
        .alert("Delete account?", isPresented: $confirmDelete) { Button("Delete", role: .destructive) { store.deleteEverything(); session.onboarded = false; dismiss() }; Button("Cancel", role: .cancel) {} } message: { Text("All your data is deleted. This cannot be undone.") }
        .alert("Sign out?", isPresented: $confirmSignOut) { Button("Sign out", role: .destructive) { p.onboarded = false; store.save(); session.onboarded = false; dismiss() }; Button("Cancel", role: .cancel) {} } message: { Text("Your data stays on this phone. Sign back in with your username and password.") }
    }
    func section<C: View>(_ title: String, @ViewBuilder _ c: @escaping () -> C) -> some View { VStack(alignment: .leading, spacing: 8) { Overline(text: title).padding(.top, 10); ListCard(content: c) } }
    func row(_ label: String, _ value: String, action: @escaping () -> Void) -> some View { SettingsRow(label: label) { ChevronValue(value: value) }.contentShape(Rectangle()).onTapGesture(perform: action) }
}
struct ShareItems: Identifiable { var id = UUID(); var urls: [URL] }
struct ShareSheet: UIViewControllerRepresentable {
    var items: [URL]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

struct ChangePasswordScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    @State private var current = ""; @State private var new1 = ""; @State private var new2 = ""
    var body: some View {
        let p = Store(ctx).profile()
        let ok = Store.hash(current, salt: p.username.lowercased()) == p.passwordHash && new1.count >= 8 && new1 == new2
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Change password", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            VStack(spacing: 12) {
                SecureField("Current password", text: $current).textContentType(.password).modifier(FieldStyle())
                SecureField("New password · 8+ characters", text: $new1).textContentType(.newPassword).modifier(FieldStyle())
                SecureField("Confirm new password", text: $new2).textContentType(.newPassword).modifier(FieldStyle())
                PrimaryButton(label: "Save password", disabled: !ok) { p.passwordHash = Store.hash(new1, salt: p.username.lowercased()); Store(ctx).save(); toaster.show("Password changed"); dismiss() }.padding(.top, 8)
            }.padding(Space.gutter)
            Spacer()
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
}
struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View { content.font(.yumo.bodyStrong).padding(.horizontal, 16).frame(height: 52).background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.surface)).lifted(radius: Radius.field).autocorrectionDisabled().textInputAutocapitalization(.never) }
}

struct TimeSheet: View {
    @Environment(\.dismiss) private var dismiss
    var title: String; var minutes: Int; var onSave: (Int) -> Void
    @State private var date = Date()
    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: title, onClose: { dismiss() }) { Color.clear.frame(width: 44, height: 44) }
            DatePicker("", selection: $date, displayedComponents: .hourAndMinute).datePickerStyle(.wheel).labelsHidden().padding(.top, 8)
            PrimaryButton(label: "Save") { let c = Calendar.current.dateComponents([.hour, .minute], from: date); onSave((c.hour ?? 0) * 60 + (c.minute ?? 0)); dismiss() }.padding(.horizontal, Space.gutter).padding(.bottom, 8)
        }
        .background(Color.yumo.bg)
        .onAppear { date = Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date() }
    }
}

/// Settings › Nutrients: every tracked nutrient with an editable target and UL, pins (max 3), Show on Today, Reset to defaults.
struct NutrientsSettingsScreen: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @Environment(Toaster.self) private var toaster
    @State private var tick = 0
    @State private var editing: Nutrient? = nil
    @State private var rdaText = ""; @State private var ulText = ""
    var store: Store { Store(ctx) }
    var body: some View {
        let p = store.profile(); let t = store.targets()
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Nutrients", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: Space.cardGap) {
                    ListCard { SettingsRow(label: "Show on Today", sub: "Up to 3 pinned nutrients under the macros") { Toggle("", isOn: Binding(get: { p.showNutrientsOnToday }, set: { p.showNutrientsOnToday = $0; store.save(); tick += 1 })).labelsHidden().tint(.yumo.accent) } }
                    Overline(text: "Targets · NIH DRI by sex and age").padding(.top, 10)
                    ListCard {
                        ForEach(Nutrients.all) { n in
                            let (goal, ul) = Nutrients.target(n, profile: p, kcal: t.kcal)
                            let pinned = p.pinnedNutrients.contains(n.key)
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) { Text(n.name).font(.yumo.bodyStrong); if pinned { Tag(label: "Today") } }
                                    Text([goal.map { "target \(Nutrients.format($0, unit: n.unit)) \(n.unit)" }, ul.map { "limit \(Nutrients.format($0, unit: n.unit)) \(n.unit)" }].compactMap { $0 }.joined(separator: " · ").isEmpty ? "no target · shown only" : [goal.map { "target \(Nutrients.format($0, unit: n.unit)) \(n.unit)" }, ul.map { "limit \(Nutrients.format($0, unit: n.unit)) \(n.unit)" }].compactMap { $0 }.joined(separator: " · ")).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted)
                                }
                                Spacer()
                                Button { if pinned { p.pinnedNutrients.removeAll { $0 == n.key } } else if p.pinnedNutrients.count < 3 { p.pinnedNutrients.append(n.key) } else { toaster.show("Up to 3 pins"); return }; store.save(); tick += 1 } label: { Image(systemName: pinned ? "pin.fill" : "pin").font(.system(size: 15, weight: .bold)).foregroundStyle(pinned ? Color.yumo.accent : .yumo.inkMuted).frame(width: 36, height: 36) }.buttonStyle(PlainPressStyle())
                                Button { editing = n; rdaText = goal.map { Nutrients.format($0, unit: n.unit) } ?? ""; ulText = ul.map { Nutrients.format($0, unit: n.unit) } ?? "" } label: { Text("Edit").font(.yumo.action) }.buttonStyle(PlainPressStyle())
                            }.padding(.vertical, 10).padding(.trailing, Space.cardPad).hairline()
                        }
                    }
                    HStack { Spacer(); TextAction(label: "Reset to defaults") { p.nutrientOverrides = [:]; store.save(); toaster.show("Targets reset"); tick += 1 }; Spacer() }.padding(.top, 8)
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }
        .id(tick).background(Color.yumo.bg.ignoresSafeArea())
        .alert(editing.map { "\($0.name) (\($0.unit))" } ?? "", isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
            TextField("Target", text: $rdaText).keyboardType(.decimalPad)
            TextField("Upper limit", text: $ulText).keyboardType(.decimalPad)
            Button("Save") { if let n = editing { p.nutrientOverrides[n.key] = [Double(rdaText), Double(ulText)]; store.save(); tick += 1 } }
            Button("Cancel", role: .cancel) {}
        } message: { Text("Leave a field empty for none.") }
    }
}
