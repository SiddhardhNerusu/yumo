import SwiftUI

// MARK: - Buttons
enum PrimarySize { case hero, regular, compact
    var height: CGFloat { switch self { case .hero: 60; case .regular: 56; case .compact: 50 } }
    var radius: CGFloat { switch self { case .hero: Radius.buttonHero; case .regular: Radius.button; case .compact: Radius.field } }
    var font: Font { switch self { case .hero: .yumo.buttonHero; case .regular: .yumo.button; case .compact: .yumo.buttonCompact } }
}
struct PrimaryButton: View {
    var label: String; var size: PrimarySize = .regular; var plus = false; var disabled = false; var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if plus { Text("+").font(.nunito(26, .black)).offset(y: -2) }
                Text(label).font(size.font)
            }
            .foregroundStyle(Color.white).frame(maxWidth: .infinity).frame(height: size.height)
        }
        .buttonStyle(LiftButtonStyle(fill: disabled ? .yumo.accentSoft : .yumo.accent, edge: disabled ? .yumo.accentSoft : .yumo.accentEdge, lift: disabled ? 0 : Lift.primary, radius: size.radius))
        .disabled(disabled)
    }
}
struct SecondaryButton: View {
    var label: String; var size: PrimarySize = .compact; var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(label).font(.nunito(size == .compact ? 15 : 18, .extrabold)).foregroundStyle(Color.yumo.ink).frame(maxWidth: .infinity).frame(height: size.height)
        }.buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: Lift.card, radius: size.radius))
    }
}
struct TextAction: View {
    var label: String; var danger = false; var action: () -> Void
    var body: some View { Button(action: action) { Text(label).font(.yumo.action).foregroundStyle(danger ? Color.yumo.danger : .yumo.accent) }.buttonStyle(PlainPressStyle()) }
}
struct AddCircleButton: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) { Text("+").font(.nunito(24, .extrabold)).foregroundStyle(Color.yumo.accent).frame(width: 36, height: 36) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.accentTint, edge: .yumo.accentTintEdge, lift: Lift.small, radius: 18))
    }
}
struct CloseButton: View {
    var action: () -> Void
    var body: some View { Button(action: action) { Text("✕").font(.yumo.title).foregroundStyle(Color.yumo.ink).frame(width: 44, height: 44).background(Circle().fill(Color.yumo.control)) }.buttonStyle(PlainPressStyle()) }
}
struct CogButton: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) { Image(systemName: "gearshape.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(Color.yumo.ink).frame(width: 44, height: 44) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.control, edge: .yumo.surfaceEdge, lift: Lift.small, radius: 22))
            .accessibilityLabel("Settings")
    }
}
struct StepperButton: View {
    var glyph: String; var big = false; var action: () -> Void
    var body: some View {
        Button(action: action) { Text(glyph).font(.nunito(big ? 28 : 22, .extrabold)).foregroundStyle(Color.yumo.ink).frame(width: big ? 56 : 44, height: big ? 56 : 36) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: big ? Lift.card : Lift.small, radius: big ? Radius.button : Radius.control))
    }
}
struct ValueStepper: View {
    var value: String; var big = false; var onMinus: () -> Void; var onPlus: () -> Void
    var body: some View {
        HStack(spacing: 10) { StepperButton(glyph: "−", big: big, action: onMinus); Text(value).font(.yumo.title).tabular().frame(minWidth: 56); StepperButton(glyph: "+", big: big, action: onPlus) }
    }
}
struct ArrowButton: View {
    var glyph: String; var disabled = false; var action: () -> Void
    var body: some View {
        Button(action: action) { Text(glyph).font(.nunito(26, .extrabold)).foregroundStyle(Color.yumo.accent).frame(width: 44, height: 44) }
            .buttonStyle(PlainPressStyle()).disabled(disabled).opacity(disabled ? 0.3 : 1)
    }
}

// MARK: - Segmented
struct Segmented<T: Hashable>: View {
    var options: [(T, String)]; @Binding var selection: T; var compact = false; var dark = false
    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { opt in
                let on = opt.0 == selection
                Button { withAnimation(Motion.snap) { selection = opt.0 } } label: {
                    Text(opt.1).font(.yumo.segment).tabular()
                        .foregroundStyle(on ? Color.yumo.ink : (dark ? Color.white : Color.yumo.inkMuted))
                        .frame(maxWidth: .infinity).padding(.vertical, compact ? 6 : 8)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(on ? Color.yumo.surface : .clear).shadow(color: on ? .black.opacity(0.1) : .clear, radius: 1.5, y: 1))
                }.buttonStyle(PlainPressStyle())
            }
        }
        .padding(2).background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(dark ? Color.black.opacity(0.35) : Color.yumo.control))
    }
}

// MARK: - Tag, Chip, Overline, Toast
struct Tag: View { var label: String
    var body: some View { Text(label).font(.yumo.tag).foregroundStyle(Color.yumo.accent).padding(.horizontal, 7).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: Radius.tag).fill(Color.yumo.accentTint)) }
}
struct Overline: View { var text: String
    var body: some View { Text(text.uppercased()).font(.yumo.overline).kerning(0.7).foregroundStyle(Color.yumo.inkMuted).padding(.leading, 4) }
}
struct ToastView: View { var text: String
    var body: some View {
        Text(text).font(.yumo.action).foregroundStyle(.white).tabular().padding(.horizontal, 18).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(Color.yumo.ink)).lifted(.yumo.toastEdge, lift: 3, radius: Radius.field)
    }
}
@Observable final class Toaster {
    var text: String? ; private var task: Task<Void, Never>?
    func show(_ t: String) { task?.cancel(); withAnimation(Motion.toastIn) { text = t }; task = Task { try? await Task.sleep(for: .seconds(Motion.toastHold)); if !Task.isCancelled { withAnimation(.easeIn(duration: 0.2)) { self.text = nil } } } }
}

// MARK: - Progress bars
struct Bar: View { var fraction: Double; var height: CGFloat; var fill: Color
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.yumo.track)
                Capsule().fill(fill).frame(width: max(0, min(1, fraction)) * g.size.width)
            }
        }.frame(height: height).animation(Motion.bar, value: fraction)
    }
}

// MARK: - Settings-style row
struct SettingsRow<Right: View>: View {
    var label: String; var sub: String? = nil; var danger = false; @ViewBuilder var right: () -> Right
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.yumo.title).foregroundStyle(danger ? Color.yumo.danger : .yumo.ink)
                if let sub { Text(sub).font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted) }
            }
            Spacer(minLength: 8)
            right()
        }
        .padding(.vertical, Space.rowSettings).padding(.trailing, Space.cardPad).frame(minHeight: 48)
    }
}
struct ChevronValue: View { var value: String
    var body: some View { HStack(spacing: 4) { Text(value).font(.yumo.body).tabular().foregroundStyle(Color.yumo.inkMuted); Text("›").font(.yumo.title).foregroundStyle(Color.yumo.inkMuted) } }
}
struct ListCard<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { VStack(spacing: 0) { content() }.padding(.leading, Space.cardPad).listCard() }
}

// MARK: - Nav header for pushed pages
struct PageHeader: View {
    var back: String; var title: String; var onBack: () -> Void
    var body: some View {
        ZStack {
            HStack { Button(action: onBack) { HStack(spacing: 2) { Text("‹").font(.nunito(26, .extrabold)); Text(back).font(.yumo.title) }.foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle()); Spacer() }
            Text(title).font(.yumo.title)
        }.frame(height: 44)
    }
}

// MARK: - Glyphs (drawn, not from a library)
struct CogGlyph: View {
    var body: some View {
        ZStack {
            Circle().stroke(Color.yumo.ink, lineWidth: 2.5).padding(2.5)
            Circle().fill(Color.yumo.ink).frame(width: 3.5, height: 3.5)
            ForEach(0..<4, id: \.self) { i in Capsule().fill(Color.yumo.ink).frame(width: 2.5, height: 4).offset(y: -8).rotationEffect(.degrees(Double(i) * 90)) }
        }
    }
}
struct TodayGlyph: View { var color: Color
    var body: some View { RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: 2.5).overlay(Capsule().fill(color).frame(width: 6, height: 2.5)).frame(width: 18, height: 18) }
}
struct ProgressGlyph: View { var color: Color
    var body: some View { HStack(alignment: .bottom, spacing: 2) { ForEach([8, 13, 18], id: \.self) { h in RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 5, height: CGFloat(h)) } }.frame(width: 18, height: 18) }
}
struct BarcodeGlyph: View { var color: Color
    var body: some View { HStack(spacing: 2) { ForEach(Array([3, 2, 4, 2, 3, 2, 5, 2, 3, 4].enumerated()), id: \.offset) { _, w in RoundedRectangle(cornerRadius: 1).fill(color).frame(width: CGFloat(w)) } }.frame(width: 40, height: 26) }
}
struct MagnifierGlyph: View { var color: Color; var size: CGFloat = 20
    var body: some View {
        ZStack { Circle().stroke(color, lineWidth: size * 0.14).frame(width: size * 0.66, height: size * 0.66).offset(x: -size * 0.12, y: -size * 0.12)
            Capsule().fill(color).frame(width: size * 0.14, height: size * 0.4).rotationEffect(.degrees(-45)).offset(x: size * 0.27, y: size * 0.27) }.frame(width: size, height: size)
    }
}
struct CheckCircle: View { var on: Bool
    var body: some View { ZStack { Circle().fill(on ? Color.yumo.accent : .yumo.track); if on { Image(systemName: "checkmark").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white) } }.frame(width: 24, height: 24) }
}

// MARK: - Sheet chrome
struct SheetHeader<Right: View>: View {
    var title: String; var onClose: () -> Void; @ViewBuilder var right: () -> Right
    var body: some View {
        VStack(spacing: 10) {
            Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5)
            ZStack { HStack { CloseButton(action: onClose); Spacer(); right() }; Text(title).font(.yumo.title) }
        }.padding(.top, 10).padding(.horizontal, Space.gutter)
    }
}
extension View {
    func yumoSheet() -> some View { self.presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden) }
}

// MARK: - Rev 2 components (DESIGN_SYSTEM.md › Rev 2 component additions)

/// 48 × 40, radius 14, accent fill, white "+" 26/900, lift 3 accent.edge. Meal headers only.
struct AddChip: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) { Text("+").font(.nunito(26, .black)).foregroundStyle(.white).offset(y: -1).frame(width: 48, height: 40) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.accent, edge: .yumo.accentEdge, lift: 3, radius: Radius.addChip))
            .accessibilityLabel("Add food")
    }
}

/// Numeric entry: 40 pt, radius 12, track fill, inner edge inset 0 2 0, value 17/800 right-aligned, unit 17/700 muted.
struct InsetField: View {
    @Binding var text: String; var unit: String; var width: CGFloat = 120
    var body: some View {
        HStack(spacing: 6) {
            TextField("0", text: $text).keyboardType(.decimalPad).font(.nunito(17, .extrabold)).tabular().multilineTextAlignment(.trailing).frame(minWidth: 40)
            Text(unit).font(.nunito(17, .bold)).foregroundStyle(Color.yumo.inkMuted)
        }
        .padding(.horizontal, 12).frame(width: width, height: 40)
        .background(RoundedRectangle(cornerRadius: Radius.inset, style: .continuous).fill(Color.yumo.track))
        .overlay(RoundedRectangle(cornerRadius: Radius.inset, style: .continuous).stroke(Color.yumo.insetEdge, lineWidth: 2).mask(Rectangle().padding(.bottom, 36)))
    }
}

/// 60 × 24, accent 2 pt line, no dots, no axes. Expenditure card only.
struct Sparkline: View {
    var values: [Double]
    var body: some View {
        GeometryReader { g in
            let lo = values.min() ?? 0, hi = values.max() ?? 1, span = max(1, hi - lo)
            Path { p in
                for (i, v) in values.enumerated() {
                    let pt = CGPoint(x: values.count < 2 ? g.size.width / 2 : CGFloat(i) / CGFloat(values.count - 1) * g.size.width, y: g.size.height - CGFloat((v - lo) / span) * g.size.height)
                    i == 0 ? p.move(to: pt) : p.addLine(to: pt)
                }
            }.stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }.frame(width: 60, height: 24)
    }
}

/// Scanner frame: four 36 pt L-shapes, 4 pt stroke, white 90 % → accent on lock (300 ms).
struct CornerBrackets: View {
    var locked: Bool
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height, l: CGFloat = 36, r: CGFloat = 22
            Path { p in
                p.move(to: CGPoint(x: 0, y: l)); p.addLine(to: CGPoint(x: 0, y: r)); p.addArc(center: CGPoint(x: r, y: r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false); p.addLine(to: CGPoint(x: l, y: 0))
                p.move(to: CGPoint(x: w - l, y: 0)); p.addLine(to: CGPoint(x: w - r, y: 0)); p.addArc(center: CGPoint(x: w - r, y: r), radius: r, startAngle: .degrees(270), endAngle: .degrees(0), clockwise: false); p.addLine(to: CGPoint(x: w, y: l))
                p.move(to: CGPoint(x: w, y: h - l)); p.addLine(to: CGPoint(x: w, y: h - r)); p.addArc(center: CGPoint(x: w - r, y: h - r), radius: r, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false); p.addLine(to: CGPoint(x: w - l, y: h))
                p.move(to: CGPoint(x: l, y: h)); p.addLine(to: CGPoint(x: r, y: h)); p.addArc(center: CGPoint(x: r, y: h - r), radius: r, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false); p.addLine(to: CGPoint(x: 0, y: h - l))
            }.stroke(locked ? Color.yumo.accent : Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 4, lineCap: .round))
            .animation(.easeOut(duration: 0.3), value: locked)
        }
    }
}

/// 13/700 muted under any computed or sourced number; tap → one-paragraph explainer. Mandatory for every derived number (brief §6).
struct SourceLine: View {
    var text: String; var explainer: String
    @State private var open = false
    var body: some View {
        Button { open = true } label: { Text(text).font(.yumo.caption).tabular().foregroundStyle(Color.yumo.inkMuted).multilineTextAlignment(.leading) }.buttonStyle(PlainPressStyle())
            .sheet(isPresented: $open) {
                VStack(alignment: .leading, spacing: 14) {
                    Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5).frame(maxWidth: .infinity).padding(.top, 10)
                    Text(text).font(.yumo.title)
                    Text(explainer).font(.yumo.subtitle).foregroundStyle(Color.yumo.inkMuted)
                    Spacer()
                }.padding(.horizontal, Space.cardPad).frame(maxWidth: .infinity, alignment: .leading).background(Color.yumo.bg)
                .presentationDetents([.height(260)]).presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden)
            }
    }
}

/// Flashlight outline icon pointing right (26 × 22, 2 pt stroke, white); on: yellow fill with an ink stem.
struct TorchIcon: View {
    var on: Bool
    var body: some View {
        ZStack {
            Path { p in p.move(to: CGPoint(x: 0, y: 4)); p.addLine(to: CGPoint(x: 10, y: 4)); p.addLine(to: CGPoint(x: 15, y: 8)); p.addLine(to: CGPoint(x: 26, y: 8)); p.addLine(to: CGPoint(x: 26, y: 14)); p.addLine(to: CGPoint(x: 15, y: 14)); p.addLine(to: CGPoint(x: 10, y: 18)); p.addLine(to: CGPoint(x: 0, y: 18)); p.closeSubpath() }
                .fill(on ? Color.yumo.torchOn : .clear)
            Path { p in p.move(to: CGPoint(x: 0, y: 4)); p.addLine(to: CGPoint(x: 10, y: 4)); p.addLine(to: CGPoint(x: 15, y: 8)); p.addLine(to: CGPoint(x: 26, y: 8)); p.addLine(to: CGPoint(x: 26, y: 14)); p.addLine(to: CGPoint(x: 15, y: 14)); p.addLine(to: CGPoint(x: 10, y: 18)); p.addLine(to: CGPoint(x: 0, y: 18)); p.closeSubpath() }
                .stroke(on ? Color.yumo.ink : .white, lineWidth: 2)
            if on { Rectangle().fill(Color.yumo.ink).frame(width: 2, height: 10).offset(x: -7) }
        }.frame(width: 26, height: 22)
    }
}
