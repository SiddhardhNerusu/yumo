import SwiftUI
import SwiftData
import UIKit

/// First-run guided tour (README §15): runs on top of the live UI in its own window above every sheet.
/// Ten stops; explain stops advance on Got it or a scrim tap; act stops let only the lit control through and advance when it fires.
@Observable final class Tour {
    static let shared = Tour()

    enum Anchor: String { case hero, breakfastAdd, typeItField, sheetClose, progressTab, weightCard, maintenanceCard, caloriesCard, nutrientsRow, cog
        /// Spotlight padding: buttons +6, fields +4, cards 0.
        var pad: CGFloat { switch self { case .breakfastAdd, .sheetClose, .progressTab, .cog: 6; case .typeItField: 4; default: 0 } }
        var radius: CGFloat { switch self { case .breakfastAdd: Radius.chip + 6; case .sheetClose, .progressTab, .cog: 22 + 6; case .typeItField: Radius.field + 4; case .nutrientsRow, .weightCard, .maintenanceCard, .caloriesCard: Radius.cardDense; case .hero: Radius.card } }
    }
    /// A stop lights one control; a two-phase stop (4) lights a second control under the same counter once the first has fired.
    struct Stop { var anchor: Anchor; var act: Bool; var title: String; var body: String; var cue: String?; var waitMs: Int = 520; var button = "Got it"; var second: Anchor? = nil; var secondBody: String? = nil; var secondCue: String? = nil }
    /// The settled nine (DEVIATIONS_REV9 A4): hero · Breakfast + (opens Type it for real) · the field · ✕ then Progress · Weight · Maintenance · Calories · Nutrients · cog → Settings, then "Good luck!".
    static let stops: [Stop] = [
        Stop(anchor: .hero, act: false, title: "Your day in one place", body: "Calories and macros from your plan. Everything you log fills these bars.", cue: nil),
        Stop(anchor: .breakfastAdd, act: true, title: "This is how you add food", body: "Every meal has a +. Tap it now.", cue: "Tap the +", waitMs: 1000),
        Stop(anchor: .typeItField, act: false, title: "One line, all your foods", body: "Foods and grams together — “oats 80 banana 1” becomes two rows. When a word could mean two things, Yumo asks once and remembers. Type a name on its own and it's your search. Scan a barcode for anything packaged.", cue: nil),
        Stop(anchor: .sheetClose, act: true, title: "Close this for now", body: "Nothing is logged until you tap Log. Tap ✕.", cue: "Tap ✕", second: .progressTab, secondBody: "Weight, maintenance and the week live on the other tab. Tap Progress.", secondCue: "Tap Progress"),
        Stop(anchor: .weightCard, act: false, title: "Weigh in most mornings", body: "Log it here. The line is your 7-day trend, so one heavy day never fools you. Hold the chart to read any point.", cue: nil),
        Stop(anchor: .maintenanceCard, act: false, title: "Measured maintenance", body: "After a few weeks of logging and weigh-ins, Yumo works out what you actually burn — not what a formula guesses — and adjusts your target each week. You always approve the change.", cue: nil),
        Stop(anchor: .caloriesCard, act: false, title: "Your week", body: "Each day's calories against your target. Green is today.", cue: nil),
        Stop(anchor: .nutrientsRow, act: false, title: "Beyond macros", body: "Fibre, sodium, iron and 24 more against daily targets. Pin up to three to Today.", cue: nil),
        Stop(anchor: .cog, act: true, title: "Everything else lives here", body: "Targets, macros, staples, supplements, units. Tap the cog.", cue: "Tap the cog", waitMs: 700),
    ]
    static let presetLine = "oats 80 banana 1"

    private(set) var active = false
    private(set) var step = 1                 // 1…10
    private(set) var finishing = false
    var targetRect: CGRect = .zero            // screen coordinates
    var targetRadius: CGFloat = 22
    var bubbleVisible = false
    var settled = false                       // the spotlight has arrived; the bubble may appear
    var ready = false                         // frames available for the current step
    var stop: Stop { Tour.stops[step - 1] }
    private(set) var phase = 0                // 0, or 1 on a two-phase stop once its first control fired
    var currentAnchor: Anchor { phase == 1 ? (stop.second ?? stop.anchor) : stop.anchor }
    var currentBody: String { phase == 1 ? (stop.secondBody ?? stop.body) : stop.body }
    var currentCue: String? { phase == 1 ? stop.secondCue : stop.cue }
    var summaryTarget: Int = 0

    @ObservationIgnored private var probes: [Anchor: WeakBox] = [:]    // bookkeeping, never drives a render (an observed dictionary here re-rendered every probe forever)
    @ObservationIgnored private var link: CADisplayLink?
    @ObservationIgnored private var window: TourWindow?
    @ObservationIgnored private var ctx: ModelContext?
    @ObservationIgnored private var advanceTask: Task<Void, Never>?
    @ObservationIgnored var onFinished: (() -> Void)?
    @ObservationIgnored var session: Session?

    // MARK: lifecycle
    @MainActor func start(store: Store, session: Session, resumeAt: Int? = nil) {
        guard !active else { return }
        ctx = store.ctx; self.session = session
        summaryTarget = store.targets().kcal
        var s = resumeAt ?? 1
        if (2...4).contains(s) { s = 2 }       // the sheet is gone after a relaunch; replay from the + stop
        step = s; phase = 0; finishing = false; active = true; settled = false; ready = false; bubbleVisible = false
        if s >= 5 { session.tab = .progress } else { session.tab = .today }
        persist(step: s)
        showWindow()
        startLink()
        enter(step: s, glide: false)
    }
    @MainActor func skip() { end(markDone: true) }
    @MainActor private func end(markDone: Bool) {
        advanceTask?.cancel(); link?.invalidate(); link = nil
        active = false; finishing = false; bubbleVisible = false
        if markDone, let p = profile() { p.tourDone = true; p.tourStep = nil; try? ctx?.save() }
        session?.tab = .today
        hideWindow()
        onFinished?(); onFinished = nil
    }
    /// Explain stops: Got it / scrim tap.
    @MainActor func advance() {
        guard active, !finishing else { return }
        if step >= Tour.stops.count { finish(); return }
        go(to: step + 1)
    }
    /// Act stops: the real control fired. Advances only when that control is the lit one.
    @MainActor func didAct(_ a: Anchor) {
        guard active, !finishing, stop.act, currentAnchor == a else { return }
        let wait = stop.waitMs
        bubbleVisible = false; settled = false
        advanceTask?.cancel()
        if phase == 0, stop.second != nil {
            // two-phase stop: same counter, the second control lights after the first action lands
            advanceTask = Task { try? await Task.sleep(for: .milliseconds(wait)); guard !Task.isCancelled else { return }; self.phase = 1; self.enter(step: self.step, glide: true) }
            return
        }
        advanceTask = Task { try? await Task.sleep(for: .milliseconds(wait)); guard !Task.isCancelled else { return }; go(to: step + 1) }
    }
    @MainActor private func go(to s: Int) {
        guard s <= Tour.stops.count else { finish(); return }
        step = s; phase = 0; persist(step: s)
        enter(step: s, glide: true)
    }
    @MainActor private func enter(step s: Int, glide: Bool) {
        bubbleVisible = false; settled = false; ready = false
        // spotlight glides 600 ms; the bubble waits 380 ms so the spotlight arrives first
        Task { try? await Task.sleep(for: .milliseconds(380)); guard self.step == s, self.active else { return }
            withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.4)) { self.settled = true; self.bubbleVisible = true } }
    }
    @MainActor private func finish() {
        advanceTask?.cancel()
        bubbleVisible = false
        if let p = profile() { p.tourDone = true; p.tourStep = nil; try? ctx?.save() }
        session?.tab = .today
        withAnimation(.easeInOut(duration: 0.3)) { finishing = true }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task { try? await Task.sleep(for: .milliseconds(3400)); self.end(markDone: true) }
    }
    private func profile() -> UserProfile? { try? ctx?.fetch(FetchDescriptor<UserProfile>()).first }
    private func persist(step: Int) { if let p = profile() { p.tourStep = step; try? ctx?.save() } }

    /// Stop 2's + opens Type it for real with "oats 80 banana 1"; the sheet skips the pick during the tour.
    var wantsPresetLine: Bool { active && (step == 2 || step == 3) }
    var isAct: Bool { active && !finishing && stop.act }

    // MARK: frames
    final class WeakBox { weak var view: UIView?; init(_ v: UIView) { view = v } }
    func register(_ a: Anchor, _ v: UIView) { if probes[a]?.view !== v { probes[a] = WeakBox(v) } }
    private func startLink() {
        link?.invalidate()
        let l = CADisplayLink(target: self, selector: #selector(tick)); l.add(to: .main, forMode: .common); link = l
    }
    @objc private func tick() {
        guard active, !finishing else { return }
        let a = currentAnchor
        guard let v = probes[a]?.view, v.window != nil else { return }
        let r = v.convert(v.bounds, to: nil).insetBy(dx: -a.pad, dy: -a.pad)
        guard r.width > 1, r.height > 1 else { return }
        if !ready {
            ready = true; targetRadius = a.radius
            if targetRect == .zero { targetRect = r } else { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.6)) { targetRect = r } }
        } else if abs(r.minX - targetRect.minX) > 0.5 || abs(r.minY - targetRect.minY) > 0.5 || abs(r.width - targetRect.width) > 0.5 || abs(r.height - targetRect.height) > 0.5 {
            withAnimation(.easeOut(duration: 0.12)) { targetRect = r }   // the target itself moved (scroll): track closely, don't glide
        }
    }
    /// Act stops let the lit control through: the window passes touches inside the cutout to the app.
    func passesThrough(_ point: CGPoint) -> Bool { isAct && ready && targetRect.contains(point) }

    // MARK: window
    @MainActor private func showWindow() {
        guard window == nil, let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }) ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
        let w = TourWindow(windowScene: scene)
        w.windowLevel = .alert + 1
        let host = UIHostingController(rootView: TourOverlay())
        host.view.backgroundColor = .clear
        w.rootViewController = host; w.backgroundColor = .clear; w.isHidden = false
        window = w
    }
    @MainActor private func hideWindow() { window?.isHidden = true; window = nil; targetRect = .zero }
}

/// Passthrough window: on act stops, touches inside the cutout reach the app; everything else lands on the overlay.
final class TourWindow: UIWindow {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if Tour.shared.passesThrough(point) { return nil }
        return super.hitTest(point, with: event)
    }
}

/// Marks a view as a tour target; its on-screen frame is read live while the tour runs.
struct TourAnchorModifier: ViewModifier {
    var anchor: Tour.Anchor
    func body(content: Content) -> some View { content.background(TourProbe(anchor: anchor).allowsHitTesting(false)) }
}
struct TourProbe: UIViewRepresentable {
    var anchor: Tour.Anchor
    func makeUIView(context: Context) -> UIView { let v = UIView(); v.isUserInteractionEnabled = false; v.backgroundColor = .clear; Tour.shared.register(anchor, v); return v }
    func updateUIView(_ v: UIView, context: Context) { Tour.shared.register(anchor, v) }
}
extension View { func tourAnchor(_ a: Tour.Anchor) -> some View { modifier(TourAnchorModifier(anchor: a)) } }
