import SwiftUI
import UIKit.UIGestureRecognizerSubclass

// MARK: - motion.swipeStage (REV10_SPEC §3) — the one two-stage swipe engine, two directions.
// Leading (drag right) = add: color.accent + white "+". Trailing (drag left) = delete: color.danger.fill + white bin.
// Stage 1: > 32 pt snaps open at 72 and the inset action button is tappable. Stage 2: ≥ 50 % of the row width arms
// (haptic .medium, glyph rides to the row edge, scale 1.18); release commits (260 ms slide-out). Rubber-band 0.25× past full width.

enum SwipeEdge { case leading, trailing }

/// One row open at a time; a drag on any other row (or a scroll on Today) closes it.
@Observable final class SwipeCoordinator {
    var openId: String? = nil
    var scrollTick = 0
    func closeAll() { openId = nil }
}

struct SwipeActionRow<Content: View>: View {
    var id: String
    var edge: SwipeEdge
    var pressHighlight = true           // FoodRow / WeightRow: color.pressed while a finger is down. Not the repeat row (§4.5).
    var onTap: (() -> Void)? = nil
    var onCommit: () -> Void
    @ViewBuilder var content: () -> Content
    @Environment(SwipeCoordinator.self) private var coord
    @State private var dx: CGFloat = 0
    @State private var open = false
    @State private var armed = false
    @State private var moved = false      // a drag happened in this touch → the Button's tap is ignored
    @State private var committed = false
    @State private var width: CGFloat = 0
    private let openAt: CGFloat = 72
    private var sign: CGFloat { edge == .leading ? 1 : -1 }
    private var reveal: CGFloat { abs(dx) }

    var body: some View {
        Button {
            if moved || committed { return }
            if open { close() } else { onTap?() }
        } label: { content().frame(maxWidth: .infinity) }
        .buttonStyle(RowPressStyle(highlight: pressHighlight && !open))
        .offset(x: dx)
        .background(alignment: edge == .leading ? .leading : .trailing) { actionButton }
        .background { GeometryReader { g in Color.clear.onAppear { width = g.size.width }.onChange(of: g.size.width) { width = g.size.width } } }
        .clipped()
        .overlay { HorizontalPan(onBegan: panBegan, onChanged: panChanged, onEnded: panEnded) }   // UIKit pan: horizontal only, so a vertical drag on a row still scrolls
        .onChange(of: coord.openId) { if coord.openId != id, open { close() } }
        .onChange(of: coord.scrollTick) { if open { close() } }
    }

    /// Transparent revealed area; inside it the action button (inset 6 top/bottom, 8 on the outer edge, radius.action).
    private var actionButton: some View {
        let w = max(0, reveal - 8)
        return Button { commit() } label: {
            RoundedRectangle(cornerRadius: Radius.action, style: .continuous)
                .fill(edge == .leading ? Color.yumo.accent : .yumo.dangerFill)
                .frame(width: w)
                .padding(.vertical, 6)
                .overlay(alignment: edge == .leading ? .leading : .trailing) {
                    glyph.frame(width: 64).scaleEffect(armed ? 1.18 : 1)
                        .offset(x: sign * (armed ? max(0, reveal - openAt) : 0))   // armed: the glyph rides to the row edge
                        .animation(Motion.swipeGlyph, value: armed)
                        .animation(Motion.swipeGlyphScale, value: armed)
                        .frame(width: w, alignment: edge == .leading ? .leading : .trailing).clipped()
                }
        }
        .buttonStyle(PlainPressStyle())
        .padding(edge == .leading ? .leading : .trailing, reveal > 0 ? 8 : 0)
        .frame(width: max(0, reveal), alignment: edge == .leading ? .leading : .trailing)
        .accessibilityLabel(edge == .leading ? "Add" : "Delete")
    }
    @ViewBuilder private var glyph: some View {
        if edge == .leading { Text("+").font(.nunito(28, .black)).foregroundStyle(Color.yumo.onAccent).frame(width: 30, height: 30).offset(y: -1) }
        else { BinGlyph().frame(width: 22, height: 22) }
    }

    private func panBegan() {
        guard !committed else { return }
        moved = true; coord.openId = id
    }
    private func panChanged(_ tx: CGFloat) {
        guard moved, !committed else { return }
        let base: CGFloat = open ? sign * openAt : 0
        var raw = base + tx
        raw = edge == .leading ? max(0, raw) : min(0, raw)
        if abs(raw) > width, width > 0 { raw = sign * (width + (abs(raw) - width) * 0.25) }   // rubber-band 0.25× past full width
        dx = raw
        let nowArmed = width > 0 && abs(raw) >= width * 0.5
        if nowArmed != armed { armed = nowArmed; UIImpactFeedbackGenerator(style: nowArmed ? .medium : .light).impactOccurred() }
    }
    private func panEnded() {
        defer { Task { try? await Task.sleep(for: .milliseconds(150)); moved = false } }
        guard moved, !committed else { return }
        if armed { commit() }
        else if reveal > 32 { withAnimation(Motion.swipeOpen) { dx = sign * openAt }; open = true; coord.openId = id }
        else { close() }
    }
    private func close() { withAnimation(Motion.swipeOpen) { dx = 0 }; open = false; armed = false; if coord.openId == id { coord.openId = nil } }
    private func commit() {
        guard !committed else { return }
        committed = true; armed = false
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        withAnimation(Motion.swipeCommit) { dx = sign * (width + 40) }
        if coord.openId == id { coord.openId = nil }
        Task { try? await Task.sleep(for: .milliseconds(260)); onCommit() }
    }
}

/// motion.pressHighlight: row background → color.pressed, 100 ms in, 200 ms out. Rows only; buttons keep motion.press.
struct RowPressStyle: ButtonStyle {
    var highlight = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(highlight && configuration.isPressed ? Color.yumo.pressed : Color.yumo.surface)
            .contentShape(Rectangle())
            .animation(configuration.isPressed ? Motion.pressIn : Motion.pressOut, value: configuration.isPressed)
    }
}

/// Bin, 24 × 24 viewBox, stroke 2.2, round caps/joins, no fill (REV10_SPEC §3 paths).
struct BinGlyph: View {
    var color: Color = .yumo.onAccent
    var body: some View {
        GeometryReader { g in
            let s = g.size.width / 24
            Path { p in
                p.move(to: CGPoint(x: 4 * s, y: 7 * s)); p.addLine(to: CGPoint(x: 20 * s, y: 7 * s))
                p.move(to: CGPoint(x: 10 * s, y: 11 * s)); p.addLine(to: CGPoint(x: 10 * s, y: 17 * s))
                p.move(to: CGPoint(x: 14 * s, y: 11 * s)); p.addLine(to: CGPoint(x: 14 * s, y: 17 * s))
                // body: M6 7 l1 12.5 a1.5 1.5 0 0 0 1.5 1.5 h7 a1.5 1.5 0 0 0 1.5 -1.5 L18 7
                p.move(to: CGPoint(x: 6 * s, y: 7 * s)); p.addLine(to: CGPoint(x: 7 * s, y: 19.5 * s))
                p.addQuadCurve(to: CGPoint(x: 8.5 * s, y: 21 * s), control: CGPoint(x: 7 * s, y: 21 * s))
                p.addLine(to: CGPoint(x: 15.5 * s, y: 21 * s))
                p.addQuadCurve(to: CGPoint(x: 17 * s, y: 19.5 * s), control: CGPoint(x: 17 * s, y: 21 * s))
                p.addLine(to: CGPoint(x: 18 * s, y: 7 * s))
                // lid: M9 7 V4.5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 V7
                p.move(to: CGPoint(x: 9 * s, y: 7 * s)); p.addLine(to: CGPoint(x: 9 * s, y: 4.5 * s))
                p.addQuadCurve(to: CGPoint(x: 10.5 * s, y: 3 * s), control: CGPoint(x: 9 * s, y: 3 * s))
                p.addLine(to: CGPoint(x: 13.5 * s, y: 3 * s))
                p.addQuadCurve(to: CGPoint(x: 15 * s, y: 4.5 * s), control: CGPoint(x: 15 * s, y: 3 * s))
                p.addLine(to: CGPoint(x: 15 * s, y: 7 * s))
            }.stroke(color, style: StrokeStyle(lineWidth: 2.2 * s, lineCap: .round, lineJoin: .round))
        }
    }
}

// MARK: - Horizontal pan (UIKit). A SwiftUI DragGesture on a row blocks the ScrollView from scrolling when the drag starts on that row,
// so the swipe is a UIPanGestureRecognizer attached to the enclosing scroll view: it begins only for a horizontal first movement that
// started over this row, and fails for vertical movement so the scroll view's own pan proceeds. The overlay view itself takes no touches.
struct HorizontalPan: UIViewRepresentable {
    var onBegan: () -> Void; var onChanged: (CGFloat) -> Void; var onEnded: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> AnchorView { let v = AnchorView(); v.isUserInteractionEnabled = false; v.backgroundColor = .clear; v.coordinator = context.coordinator; return v }
    func updateUIView(_ v: AnchorView, context: Context) { context.coordinator.parent = self }
    static func dismantleUIView(_ v: AnchorView, coordinator: Coordinator) { coordinator.detach() }

    final class AnchorView: UIView {
        weak var coordinator: Coordinator?
        override func didMoveToWindow() { super.didMoveToWindow(); if window != nil { coordinator?.attach(anchor: self) } else { coordinator?.detach() } }
    }
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var parent: HorizontalPan
        weak var anchor: UIView?
        weak var host: UIView?
        var pan: UIPanGestureRecognizer?
        init(_ p: HorizontalPan) { parent = p }
        func attach(anchor: UIView) {
            guard pan == nil else { return }
            var v: UIView? = anchor.superview
            while let s = v, !(s is UIScrollView) { v = s.superview }
            let host = v ?? anchor.superview
            guard let host else { return }
            let g = DirectionalPan(target: self, action: #selector(handle(_:)))
            g.maximumNumberOfTouches = 1; g.delegate = self; g.cancelsTouchesInView = true
            host.addGestureRecognizer(g)
            self.anchor = anchor; self.host = host; pan = g
        }
        func detach() { if let g = pan { host?.removeGestureRecognizer(g) }; pan = nil }
        @objc func handle(_ g: UIPanGestureRecognizer) {
            switch g.state {
            case .began: parent.onBegan(); parent.onChanged(g.translation(in: host).x)
            case .changed: parent.onChanged(g.translation(in: host).x)
            case .ended, .cancelled, .failed: parent.onEnded()
            default: break
            }
        }
        /// Begin only when the touch started over this row (direction is decided by DirectionalPan itself).
        func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            guard let pan = g as? DirectionalPan, let anchor, pan.horizontal else { return false }
            return anchor.bounds.insetBy(dx: -2, dy: 0).contains(pan.startLocation(in: anchor))
        }
        /// The scroll view's pan waits for this one to decide: horizontal → ours; vertical → ours fails and the list scrolls.
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool { other is UIPanGestureRecognizer && other.view is UIScrollView }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { false }
    }
}

/// A pan that fails as soon as the first movement is more vertical than horizontal, so the enclosing scroll view takes the touch.
final class DirectionalPan: UIPanGestureRecognizer {
    private var start: CGPoint = .zero
    private weak var startView: UIView?
    func startLocation(in v: UIView) -> CGPoint { startView.map { $0.convert(start, to: v) } ?? start }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        if let t = touches.first, let v = view { start = t.location(in: v); startView = v }
    }
    private(set) var horizontal = false
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        if state == .possible, let t = touches.first, let v = view {
            let p = t.location(in: v), dx = abs(p.x - start.x), dy = abs(p.y - start.y)
            if dy > 6, dy > dx { state = .failed; return }   // vertical: fail before the pan can begin, the scroll view takes it
            horizontal = dx > dy && dx > 4
        }
        super.touchesMoved(touches, with: event)
    }
    override func reset() { super.reset(); horizontal = false }
}
