import SwiftUI
import SwiftData

@main
struct YumoApp: App {
    let container: ModelContainer = {
        let schema = Schema([UserProfile.self, Food.self, FoodEntry.self, WeightEntry.self, SavedMeal.self, DayFlag.self, WeeklyEstimate.self])
        do { return try ModelContainer(for: schema, configurations: [ModelConfiguration(schema: schema)]) }
        catch { fatalError("ModelContainer: \(error)") }
    }()
    @State private var toaster = Toaster()
    @State private var session = Session()
    var body: some Scene {
        WindowGroup {
            RootView().environment(toaster).environment(session).tint(.yumo.accent).preferredColorScheme(.light)
        }.modelContainer(container)
    }
}

/// App-level state: which screen is up, selected day, refresh ticks.
@Observable final class Session {
    var onboarded = false
    var tab: Tab = .today
    var selectedDate = Date().startOfDay
    var tick = 0                       // bump to re-query after mutations
    var presentSettings = false
    func changed() { tick &+= 1 }
    enum Tab { case today, progress }
}

struct RootView: View {
    @Environment(\.modelContext) private var ctx
    @Environment(Session.self) private var session
    @Environment(Toaster.self) private var toaster
    @State private var ready = false
    @Environment(\.scenePhase) private var phase
    var body: some View {
        ZStack(alignment: .bottom) {
            if ready {
                if session.onboarded { MainTabs() } else { OnboardingFlow() }
            }
            if let t = toaster.text { ToastView(text: t).padding(.bottom, Space.toastBottom).transition(.move(edge: .bottom).combined(with: .opacity)).zIndex(99) }
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .task {
            let store = Store(ctx)
            SeedFoods.seed(store)
            Catalogue.sync(store)
            Expenditure.runIfDue(store)
            session.onboarded = store.profile().onboarded
            Reminders.reschedule(store.profile())
            ready = true
        }
        .onChange(of: phase) { if phase == .active { Task { let n = await PendingLookups.retry(Store(ctx)); if n > 0 { toaster.show(n == 1 ? "1 scanned food found" : "\(n) scanned foods found") } } } }
    }
}

struct MainTabs: View {
    @Environment(Session.self) private var session
    var body: some View {
        @Bindable var s = session
        ZStack(alignment: .bottom) {
            Group {
                switch session.tab { case .today: TodayScreen(); case .progress: ProgressScreen() }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
            TabBar(active: $s.tab)
        }.ignoresSafeArea(.keyboard)
    }
}

struct TabBar: View {
    @Binding var active: Session.Tab
    var body: some View {
        HStack(spacing: 0) {
            tab(.today, "Today") { TodayGlyph(color: active == .today ? .yumo.accent : .yumo.inkMuted) }
            tab(.progress, "Progress") { ProgressGlyph(color: active == .progress ? .yumo.accent : .yumo.inkMuted) }
        }
        .padding(.top, 3).frame(height: 50)
        .frame(maxWidth: .infinity)
        .background(Color.yumo.surface.opacity(0.92).background(.ultraThinMaterial).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
    }
    func tab<G: View>(_ t: Session.Tab, _ label: String, @ViewBuilder glyph: () -> G) -> some View {
        Button { active = t } label: {
            VStack(spacing: 3) { glyph(); Text(label).font(.yumo.tabLabel) }
                .foregroundStyle(active == t ? Color.yumo.accent : .yumo.inkMuted).frame(maxWidth: .infinity).frame(height: 38)
        }.buttonStyle(PlainPressStyle())
    }
}
