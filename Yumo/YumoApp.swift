import SwiftUI
import SwiftData

@main
struct YumoApp: App {
    let container: ModelContainer = {
        let schema = Schema([UserProfile.self, Food.self, FoodEntry.self, WeightEntry.self, SavedMeal.self, WeeklyEstimate.self, LearnedPattern.self, UserAlias.self, PrepDay.self, Staple.self, Supplement.self])
        do { return try ModelContainer(for: schema, configurations: [ModelConfiguration(schema: schema)]) }
        catch { fatalError("ModelContainer: \(error)") }
    }()
    @State private var toaster = Toaster()
    @State private var session = Session()
    @AppStorage("yumo.appearance") private var appearance = "system"
    var body: some Scene {
        WindowGroup {
            RootView().environment(toaster).environment(session).tint(.yumo.accent).preferredColorScheme(appearance == "light" ? .light : appearance == "dark" ? .dark : nil)
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
    var startTour = false              // set by onboarding's "Open Today"; MainTabs starts the tour once it is on screen
    var scrollTopTick: [Tab: Int] = [:] // bumped when the active tab is tapped again → that screen scrolls to the top (standard iOS)
    func scrollToTop(_ t: Tab) { scrollTopTick[t, default: 0] &+= 1 }
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
        .onAppear {
            let store = Store(ctx); let p = store.profile()
            // Guided tour (README §15): right after onboarding, or resumed if the app was killed mid-tour. Never on a day with existing logs.
            if session.startTour || (p.tourStep != nil && !p.tourDone), store.entries(Date().dayKey).isEmpty {
                let resume = session.startTour ? nil : p.tourStep; session.startTour = false
                Task { try? await Task.sleep(for: .milliseconds(500)); Tour.shared.start(store: store, session: session, resumeAt: resume) }
            } else if session.startTour { session.startTour = false; p.tourDone = true; store.save() }
        }
    }
    @Environment(\.modelContext) private var ctx
}

struct TabBar: View {
    @Binding var active: Session.Tab
    @Environment(Session.self) private var session
    @State private var todayPop = false
    var body: some View {
        HStack(spacing: 0) {
            tab(.today, "Today") { TodayGlyph(color: active == .today ? .yumo.accent : .yumo.inkMuted).scaleEffect(todayPop ? 1.12 : 1) }
            tab(.progress, "Progress") { GrowingProgressGlyph(active: active == .progress) }.tourAnchor(.progressTab)
        }
        .padding(.top, 3).frame(height: 50)
        .frame(maxWidth: .infinity)
        .background(Color.yumo.surface.opacity(0.92).background(.ultraThinMaterial).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
    }
    func tab<G: View>(_ t: Session.Tab, _ label: String, @ViewBuilder glyph: () -> G) -> some View {
        Button {
            if active == t { session.scrollToTop(t) }   // re-tap the active tab → scroll to top
            active = t; if t == .progress { Tour.shared.didAct(.progressTab) }
            if t == .today { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.12)) { todayPop = true }; Task { try? await Task.sleep(for: .milliseconds(120)); withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.12)) { todayPop = false } } }   // motion.tabPop
        } label: {
            VStack(spacing: 3) { glyph(); Text(label).font(.yumo.tabLabel) }
                .foregroundStyle(active == t ? Color.yumo.accent : .yumo.inkMuted).frame(maxWidth: .infinity).frame(height: 38)
        }.buttonStyle(PlainPressStyle())
    }
}

/// motion.tabPop for Progress: the three bars grow from the baseline left → right (scaleY 0 → 1, 400 ms, 70 ms stagger) when the tab becomes active.
struct GrowingProgressGlyph: View { var active: Bool
    @State private var grown = [true, true, true]
    var body: some View {
        HStack(alignment: .bottom, spacing: 2) { ForEach(Array([8, 13, 18].enumerated()), id: \.offset) { i, h in RoundedRectangle(cornerRadius: 2).fill(active ? Color.yumo.accent : .yumo.inkMuted).frame(width: 5, height: CGFloat(h)).scaleEffect(y: grown[i] ? 1 : 0, anchor: .bottom) } }.frame(width: 18, height: 18)
            .onChange(of: active) { guard active else { return }; grown = [false, false, false]; for i in 0..<3 { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.4).delay(Double(i) * 0.07)) { grown[i] = true } } }
    }
}
