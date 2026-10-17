import SwiftUI

/// Scrim + spotlight cutout + bubble, and the "Good luck!" finish. Lives in the tour's own window.
struct TourOverlay: View {
    @State private var tour = Tour.shared
    @State private var bubbleHeight: CGFloat = 160
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                if tour.active && !tour.finishing {
                    TourSpotlight(rect: tour.targetRect, radius: tour.targetRadius)
                        .fill(Color.yumo.tourScrim, style: FillStyle(eoFill: true))
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture { if !tour.stop.act { tour.advance() } }   // act stops: the scrim swallows every other tap
                    if tour.bubbleVisible && tour.ready {
                        let place = placement(in: geo.size, safeTop: geo.safeAreaInsets.top)
                        TourBubble(stop: tour.stop, step: tour.step, total: Tour.stops.count, arrowX: place.arrowX, arrowUp: place.arrowUp, showArrow: place.arrow,
                                   onSkip: { tour.skip() }, onNext: { tour.advance() })
                            .background(GeometryReader { g in Color.clear.onAppear { bubbleHeight = g.size.height }.onChange(of: g.size.height) { bubbleHeight = g.size.height } })
                            .frame(width: geo.size.width - 32)
                            .offset(x: 16, y: place.y - geo.safeAreaInsets.top)
                            .transition(.opacity.combined(with: .offset(y: 10)))
                    }
                }
                if tour.finishing { TourFinish(targetKcal: tour.summaryTarget).ignoresSafeArea().transition(.opacity) }
            }
        }
    }
    /// Below the target (gap 14) if it fits above the tab bar; else above if it fits under the status bar (y ≥ 70); else pinned at y 70, no arrow.
    func placement(in size: CGSize, safeTop: CGFloat) -> (y: CGFloat, arrowX: CGFloat, arrowUp: Bool, arrow: Bool) {
        let r = tour.targetRect, h = bubbleHeight, gap: CGFloat = 14, tabBar: CGFloat = 84
        let screenH = size.height + safeTop + 34
        let ax = min(max(r.midX - 16, 20), size.width - 32 - 20)
        if r.maxY + gap + h <= screenH - tabBar { return (r.maxY + gap, ax, true, true) }
        if r.minY - gap - h >= 70 { return (r.minY - gap - h, ax, false, true) }
        return (70, ax, true, false)
    }
}

/// The scrim with a rounded cutout; the cutout rect animates (glide 600 ms).
struct TourSpotlight: Shape {
    var rect: CGRect; var radius: CGFloat
    var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>, AnimatablePair<CGFloat, CGFloat>> {
        get { AnimatablePair(AnimatablePair(rect.minX, rect.minY), AnimatablePair(rect.width, rect.height)) }
        set { rect = CGRect(x: newValue.first.first, y: newValue.first.second, width: newValue.second.first, height: newValue.second.second) }
    }
    func path(in bounds: CGRect) -> Path {
        var p = Path(); p.addRect(bounds)
        p.addRoundedRect(in: rect, cornerSize: CGSize(width: radius, height: radius), style: .continuous)
        return p
    }
}

/// Ink bubble: title + "n of 10", body, Skip tour · Got it / cue, progress dots; 14 pt rotated-square arrow toward the target.
struct TourBubble: View {
    var stop: Tour.Stop; var step: Int; var total: Int; var arrowX: CGFloat; var arrowUp: Bool; var showArrow: Bool
    var onSkip: () -> Void; var onNext: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) { Text(stop.title).font(.nunito(15, .extrabold)).foregroundStyle(.white); Spacer(); Text("\(step) of \(total)").font(.nunito(12, .extrabold)).foregroundStyle(.white.opacity(0.55)) }
            Text(stop.body).font(.nunito(14, .semibold)).foregroundStyle(.white.opacity(0.85)).lineSpacing(14 * 0.45).fixedSize(horizontal: false, vertical: true)
            HStack {
                Button(action: onSkip) { Text("Skip tour").font(.nunito(13, .extrabold)).foregroundStyle(.white.opacity(0.55)).padding(.vertical, 6) }.buttonStyle(PlainPressStyle())
                Spacer()
                if stop.act, let cue = stop.cue { Text(cue).font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }
                else { Button(action: onNext) { Text(stop.button).font(.nunito(14, .black)).foregroundStyle(.white).padding(.vertical, 10).padding(.horizontal, 18) }
                        .buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: 3, radius: 100)) }
            }.padding(.top, 2)
            HStack(spacing: 5) { ForEach(1...total, id: \.self) { i in Circle().fill(i == step ? Color.yumo.accent : .white.opacity(0.25)).frame(width: 6, height: 6) } }
        }
        .padding(.vertical, 14).padding(.horizontal, 16)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.yumo.ink))
        .lifted(.yumo.toastEdge, lift: 4, radius: 18)
        .overlay(alignment: arrowUp ? .topLeading : .bottomLeading) {
            if showArrow { Rectangle().fill(Color.yumo.ink).frame(width: 14, height: 14).rotationEffect(.degrees(45)).offset(x: arrowX - 7, y: arrowUp ? -6 : 6) }
        }
    }
}

/// "Good luck!" — sand cover, app tile pop, 14-dot accent burst, auto-dismiss (README §15 Finish).
struct TourFinish: View {
    var targetKcal: Int
    @State private var t0 = Date()
    var body: some View {
        TimelineView(.animation) { tl in
            let ms = tl.date.timeIntervalSince(t0) * 1000
            ZStack {
                Color.yumo.bg.opacity(ms >= 3000 ? max(0, 1 - (ms - 3000) / 400) : 1)
                VStack(spacing: 0) {
                    ZStack {
                        ForEach(0..<14, id: \.self) { i in
                            let angle = Double(i) / 14 * 2 * .pi, delay = Double(i % 3) * 60, p = min(1, max(0, (ms - 350 - delay) / 1100))
                            let e = TourFinish.easeSnap(p), d = e * 150
                            Circle().fill(Color.yumo.accent).frame(width: i % 2 == 0 ? 11 : 8, height: i % 2 == 0 ? 11 : 8)
                                .offset(x: cos(angle) * d, y: sin(angle) * d).opacity(p > 0 ? 1 - p : 0)
                        }
                        let tp = min(1, max(0, (ms - 100) / 700))
                        Text("y").font(.nunito(56, .black)).foregroundStyle(.white).offset(y: -2).frame(width: 96, height: 96)
                            .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.yumo.accent)).lifted(.yumo.accentEdge, lift: 6, radius: 28)
                            .scaleEffect(TourFinish.pop(tp)).rotationEffect(.degrees(TourFinish.rot(tp))).opacity(tp > 0 ? 1 : 0)
                    }.frame(height: 200)
                    let t1 = min(1, max(0, (ms - 600) / 500)), t2 = min(1, max(0, (ms - 800) / 500))
                    Text("Good luck!").font(.nunito(30, .extrabold)).foregroundStyle(Color.yumo.ink).opacity(t1).offset(y: (1 - t1) * 10)
                    Text("Your target is \(Fmt.k(targetKcal)) kcal.\nLog your first meal when you're ready.").font(.nunito(15, .bold)).tabular().foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.center).padding(.top, 8).opacity(t2).offset(y: (1 - t2) * 10)
                }
            }
        }.allowsHitTesting(true)
    }
    static func easeSnap(_ p: Double) -> Double { let c = 1 - p; return 1 - c * c * (1 - 0.2 * p) }   // ≈ cubic-bezier(.2,.8,.2,1)
    /// scale .4 → 1.08 → .97 → 1 with ease-out(.16,1,.3,1)
    static func pop(_ p: Double) -> Double { let e = 1 - pow(1 - p, 3)
        if e < 0.6 { return 0.4 + (1.08 - 0.4) * (e / 0.6) } else if e < 0.85 { return 1.08 - 0.11 * ((e - 0.6) / 0.25) } else { return 0.97 + 0.03 * ((e - 0.85) / 0.15) } }
    static func rot(_ p: Double) -> Double { let e = 1 - pow(1 - p, 3)
        if e < 0.6 { return -12 + 15 * (e / 0.6) } else if e < 0.85 { return 3 - 3 * ((e - 0.6) / 0.25) } else { return 0 } }
}
