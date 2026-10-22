import SwiftUI
import SwiftData

@main
struct YumoApp: App {
    let container: ModelContainer = {
        let schema = Schema([UserProfile.self, Food.self, FoodEntry.self, WeightEntry.self, SavedMeal.self, WeeklyEstimate.self, LearnedPattern.self, UserAlias.self, PrepDay.self, Staple.self, Supplement.self, FoodPreference.self])
        do { return try ModelContainer(for: schema, configurations: [ModelConfiguration(schema: schema)]) }
        catch { fatalError("ModelContainer: \(error)") }
    }()
    @State private var toaster = Toaster()
    @State private var session = Session()
    @State private var swipes = SwipeCoordinator()
    @AppStorage("yumo.appearance") private var appearance = "system"
    var body: some Scene {
        WindowGroup {
            RootView().environment(toaster).environment(session).environment(swipes).tint(.yumo.accent)
                .onChange(of: appearance, initial: true) { Appearance.apply() }
        }.modelContainer(container)
    }
}

/// Settings › About › Appearance, set on every window (22 Oct audit: going back to System from Dark didn't take until a relaunch —
/// SwiftUI's preferredColorScheme(nil) leaves the window's override in place). New windows (toasts, the tour) take `style` when made.
enum Appearance {
    static var style: UIUserInterfaceStyle { switch UserDefaults.standard.string(forKey: "yumo.appearance") { case "light": .light; case "dark": .dark; default: .unspecified } }
    @MainActor static func apply() {
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) { for w in scene.windows { w.overrideUserInterfaceStyle = style } }
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
    var reviewAutoShown = false        // the weekly review auto-opens at most once per launch (rev 10 §7.1); the chip reopens it
    var showReview = false             // presents the weekly review (full-screen page) from MainTabs
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
        }
        .background(Color.yumo.bg.ignoresSafeArea())
        .task {
            ToastLayer.install(toaster)   // above every sheet and cover, not under them
            KeyboardDismiss.shared.install()   // tap outside / swipe down puts any keyboard away
            Appearance.apply()
            let store = Store(ctx)
            SeedFoods.seed(store)
            Expenditure.runIfDue(store)
            session.onboarded = store.profile().onboarded
            Reminders.reschedule(store.profile())
            ready = true   // the UI first; the catalogue sync and the search index follow off the main thread (21 Oct: a black launch screen on the phone)
            store.backfillLastAmounts()
            let container = ctx.container
            Task.detached(priority: .utility) {
                let changed = await Catalogue.sync(container)
                let count = (try? ModelContext(container).fetchCount(FetchDescriptor<Food>())) ?? 0
                _ = await FoodIndex.shared.snapshot(for: container, count: count)
                if changed { await MainActor.run { session.changed() } }
            }
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
        .pushCover(isPresented: $s.showReview, onDismiss: { session.changed() }) { WeeklyReviewScreen() }
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

/// Rev 10 §5: 83 pt (49 bar + 34 home area), surface @ .94 + blur 16, hairline top; two columns, padding-top 7, gap 4, 28 pt glyphs, 11/800 labels.
struct TabBar: View {
    @Binding var active: Session.Tab
    @Environment(Session.self) private var session
    @State private var todayPop = false
    var body: some View {
        HStack(spacing: 0) {
            tab(.today, "Today") { CalendarTileGlyph(color: active == .today ? .yumo.accent : .yumo.inkMuted, day: Calendar.current.component(.day, from: Date())).scaleEffect(todayPop ? 1.12 : 1) }
            tab(.progress, "Progress") { ProgressBarsGlyph(active: active == .progress) }.tourAnchor(.progressTab)
        }
        .padding(.top, 7).frame(height: 49, alignment: .top)
        .frame(maxWidth: .infinity)
        .background(Color.yumo.surface.opacity(0.94).background(.ultraThinMaterial).ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
    }
    func tab<G: View>(_ t: Session.Tab, _ label: String, @ViewBuilder glyph: () -> G) -> some View {
        Button {
            if active == t {   // re-tap: on a past day the Today tab returns to today (rev 11, iOS pop-to-root); otherwise scroll to the top
                if t == .today, !Calendar.current.isDateInToday(session.selectedDate) { session.selectedDate = Date().startOfDay } else { session.scrollToTop(t) }
            }
            active = t; if t == .progress { Tour.shared.didAct(.progressTab) }
            if t == .today { withAnimation(Motion.tabPop) { todayPop = true }; Task { try? await Task.sleep(for: .milliseconds(200)); withAnimation(Motion.tabPop) { todayPop = false } } }   // motion.tabPop
        } label: {
            VStack(spacing: 4) { glyph().frame(width: 28, height: 28); Text(label).font(.yumo.tabLabel) }
                .foregroundStyle(active == t ? Color.yumo.accent : .yumo.inkMuted).frame(maxWidth: .infinity)
        }.buttonStyle(PlainPressStyle())
    }
}
