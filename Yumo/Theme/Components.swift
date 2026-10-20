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
            .foregroundStyle(Color.yumo.onAccent).frame(maxWidth: .infinity).frame(height: size.height)
        }
        .buttonStyle(LiftButtonStyle(fill: disabled ? .yumo.accentSoft : .yumo.accent, edge: disabled ? .yumo.accentSoftEdge : .yumo.accentEdge, lift: Lift.primary, radius: size.radius))
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
        Button(action: action) { Image(systemName: "gearshape").font(.system(size: 20, weight: .semibold)).foregroundStyle(Color.yumo.ink).frame(width: 44, height: 44) }   // rev 9: gear outline, not a dots glyph
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
    var options: [(T, String)]; @Binding var selection: T; var compact = false
    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { opt in
                let on = opt.0 == selection
                Button { withAnimation(Motion.snap) { selection = opt.0 } } label: {
                    Text(opt.1).font(.yumo.segment).tabular()
                        .foregroundStyle(on ? Color.yumo.ink : Color.yumo.inkMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, compact ? 6 : 8)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(on ? Color.yumo.surface : .clear).shadow(color: on ? .black.opacity(0.1) : .clear, radius: 1.5, y: 1))
                }.buttonStyle(PlainPressStyle())
            }
        }
        .padding(2).background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Color.yumo.control))
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
        Text(text).font(.yumo.action).foregroundStyle(Color.yumo.onAccent).tabular().padding(.horizontal, 18).padding(.vertical, 12)
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
    @Environment(\.pushDismiss) private var pushDismiss
    var body: some View {
        ZStack {
            HStack { Button(action: { if let pd = pushDismiss { pd(onBack) } else { onBack() } }) { HStack(spacing: 2) { Text("‹").font(.nunito(26, .extrabold)); Text(back).font(.yumo.title) }.foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle()); Spacer() }
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
/// Tab glyph (rev 11 §5): calendar tile in a 28 box — rounded rect 23 × 22 at (2.5,3.5) r 6 stroke 2.2, header line y 10 stroke 2.2, the real day number 10.5/800 tracking −0.3 centred in the pane below the line (11 → 26).
struct CalendarTileGlyph: View { var color: Color; var day: Int
    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(color, lineWidth: 2.2).frame(width: 23, height: 22).offset(x: 2.5, y: 3.5)
            Rectangle().fill(color).frame(width: 23, height: 2.2).offset(x: 2.5, y: 8.9)
            Text("\(day)").font(.nunito(10.5, .extrabold)).kerning(-0.3).tabular().foregroundStyle(color).frame(width: 23, height: 15).offset(x: 2.5, y: 11)
        }.frame(width: 28, height: 28, alignment: .topLeading)
    }
}
/// Rev 10 tab glyph: three bars 40 / 68 / 100 % of 28, gap 3, radius 3. motion.tabPop grows them from the baseline (400 ms, 70 ms stagger) on select.
struct ProgressBarsGlyph: View { var active: Bool
    @State private var grown = [true, true, true]
    var body: some View {
        HStack(alignment: .bottom, spacing: 3) { ForEach(Array([0.40, 0.68, 1.0].enumerated()), id: \.offset) { i, f in RoundedRectangle(cornerRadius: 3, style: .continuous).fill(active ? Color.yumo.accent : .yumo.inkMuted).frame(width: 7, height: 28 * f).scaleEffect(y: grown[i] ? 1 : 0, anchor: .bottom) } }.frame(width: 28, height: 28, alignment: .bottom)
            .onChange(of: active) { guard active else { return }; grown = [false, false, false]; for i in 0..<3 { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.4).delay(Double(i) * 0.07)) { grown[i] = true } } }
    }
}
/// Type it tile glyph (Features.typeIt).
struct KeyboardGlyph: View { var color: Color
    var body: some View {
        VStack(spacing: 3) { ForEach(0..<3, id: \.self) { r in HStack(spacing: 3) { ForEach(0..<(r == 2 ? 1 : 6), id: \.self) { _ in RoundedRectangle(cornerRadius: 2).fill(color).frame(width: r == 2 ? 30 : 5, height: 5) } } } }
            .padding(5).overlay(RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: 2.5)).frame(width: 44, height: 32)
    }
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
    var title: String; var onClose: () -> Void; var closeAnchor = false; @ViewBuilder var right: () -> Right
    var body: some View {
        VStack(spacing: 10) {
            Capsule().fill(Color.yumo.grabber).frame(width: 40, height: 5)
            ZStack { HStack { if closeAnchor { CloseButton(action: onClose).tourAnchor(.sheetClose) } else { CloseButton(action: onClose) }; Spacer(); right() }; Text(title).font(.yumo.title) }
        }.padding(.top, 10).padding(.horizontal, Space.gutter)
    }
}
extension View {
    func yumoSheet() -> some View { self.presentationCornerRadius(Radius.sheet).presentationBackground(Color.yumo.bg).presentationDragIndicator(.hidden) }
}

// MARK: - Rev 2 components (DESIGN_SYSTEM.md › Rev 2 component additions)

/// Rev 10: 40 × 34, radius.control 12, accent fill, white "+" 22/900, lift.primary 3 pt (0 3 0 accent.edge); 44 × 44 hit area. Meal-card headers (empty and filled) and the Design System page.
struct AddChip: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) { Text("+").font(.nunito(22, .black)).foregroundStyle(Color.yumo.onAccent).offset(y: -1) }
            .buttonStyle(AddChipStyle())
            .accessibilityLabel("Add food")
    }
}
struct AddChipStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.frame(width: 40, height: 34)
            .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Color.yumo.accent))
            .lifted(.yumo.accentEdge, lift: Lift.card, radius: Radius.control, pressed: configuration.isPressed)
            .animation(Motion.press, value: configuration.isPressed)
            .frame(width: 44, height: 44).contentShape(Rectangle())
    }
}

/// Numeric entry: 40 pt, radius 12, track fill, inner edge inset 0 2 0, value 17/800 right-aligned, unit 17/700 muted.
struct InsetField: View {
    @Binding var text: String; var unit: String; var width: CGFloat = 120; var placeholder = "0"
    var body: some View {
        HStack(spacing: 6) {
            TextField(placeholder, text: $text).keyboardType(.decimalPad).font(.nunito(17, .extrabold)).tabular().multilineTextAlignment(.trailing).frame(minWidth: 40)
                // a number field selects its value on focus so typing replaces it ("250", not "250100") — every InsetField is numeric
                .onReceive(NotificationCenter.default.publisher(for: UITextField.textDidBeginEditingNotification)) { n in if let tf = n.object as? UITextField, tf.keyboardType == .decimalPad { DispatchQueue.main.async { tf.selectAll(nil) } } }
            Text(unit).font(.nunito(17, .bold)).foregroundStyle(Color.yumo.inkMuted)
        }
        .padding(.horizontal, 12).frame(width: width, height: 40)
        .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Color.yumo.track))
        .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).stroke(Color.yumo.insetEdge, lineWidth: 2).mask(Rectangle().padding(.bottom, 36)))
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

// MARK: - Rev 3 components (DESIGN_SYSTEM.md › Rev 3)

/// Keyboard glyph for the Type it tile.

/// Inset disambiguation list: bg fill, radius 14, padding 4 × 12; rows 10 pt vertical with a 22 pt ring; footer rows 14/800 accent ›.
struct AskList<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(.vertical, 4).padding(.horizontal, 12)
            .background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Color.yumo.bg))
    }
}
struct AskOption: View {
    var name: String; var sub: String; var kcal: String; var selected = false; var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Circle().stroke(selected ? Color.yumo.accent : Color.yumo.grabber, lineWidth: 2).frame(width: 22, height: 22).overlay { if selected { Circle().fill(Color.yumo.accent).frame(width: 12, height: 12) } }
                VStack(alignment: .leading, spacing: 1) { Text(name).font(.nunito(16, .bold)).foregroundStyle(Color.yumo.ink); Text(sub).font(.nunito(13, .bold)).foregroundStyle(Color.yumo.inkMuted) }
                Spacer(); Text(kcal).font(.nunito(15, .extrabold)).tabular().foregroundStyle(Color.yumo.ink)
            }.padding(.vertical, 10).contentShape(Rectangle())
        }.buttonStyle(PlainPressStyle())
    }
}
struct AskFooter: View { var label: String; var action: () -> Void
    var body: some View { Button(action: action) { HStack(spacing: 4) { Text(label); Text("›") }.font(.nunito(14, .extrabold)).foregroundStyle(Color.yumo.accent).padding(.vertical, 10) }.buttonStyle(PlainPressStyle()) }
}

/// Plan row: 17/700 name + 12/700 muted meal caption; right `from → to` or a plain amount; tags prepped / kept.
struct PlanRow: View {
    var name: String; var caption: String; var from: Double; var to: Double; var tag: String?; var tagAccent: Bool; var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) { Text(name).font(.nunito(17, .bold)).foregroundStyle(Color.yumo.ink).lineLimit(1)
                        if let tag { Text(tag).font(.yumo.tag).foregroundStyle(tagAccent ? Color.yumo.accent : .yumo.inkMuted).padding(.horizontal, 7).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: Radius.tag).fill(tagAccent ? Color.yumo.accentTint : .yumo.track)) } }
                    Text(caption).font(.nunito(12, .bold)).foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
                }
                Spacer()
                if abs(from - to) >= 2.5 {
                    HStack(spacing: 6) { Text("\(Fmt.g(from)) g").font(.nunito(15, .bold)).strikethrough().foregroundStyle(Color.yumo.inkMuted); Text("→").font(.nunito(15, .bold)).foregroundStyle(Color.yumo.inkMuted); Text("\(Fmt.g(to)) g").font(.nunito(17, .extrabold)).foregroundStyle(Color.yumo.accent) }.tabular()
                } else { Text("\(Fmt.g(to)) g").font(.nunito(17, .extrabold)).tabular().foregroundStyle(Color.yumo.ink) }
            }.padding(.vertical, 10).padding(.trailing, Space.cardPad).contentShape(Rectangle())
        }.buttonStyle(PlainPressStyle()).hairline()
    }
}

/// Input row: 17/700 text + 12/700 hint under it, InsetField grams, 32 pt ✕.
struct InputRow: View {
    @Binding var text: String; @Binding var grams: String; var hint: String; var hintAccent = false; var onRemove: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                TextField("Food", text: $text).font(.nunito(17, .bold)).autocorrectionDisabled()
                Text(hint).font(.nunito(12, .bold)).foregroundStyle(hintAccent ? Color.yumo.accent : .yumo.inkMuted).lineLimit(1)
            }
            InsetField(text: $grams, unit: "g", width: 96)
            Button(action: onRemove) { Text("✕").font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.inkMuted).frame(width: 32, height: 32) }.buttonStyle(PlainPressStyle())
        }.padding(.vertical, 8).padding(.trailing, 12).hairline()
    }
}

/// Selectable explanation tile: radius 16, bg fill, 12 × 14 padding; selected = tint fill + 2.5 pt accent inset ring.
struct OptionTile: View {
    var title: String; var body_: String; var selected: Bool; var action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.nunito(15, .extrabold)).foregroundStyle(Color.yumo.ink)
                Text(body_).font(.nunito(13, .bold)).foregroundStyle(Color.yumo.inkMuted).fixedSize(horizontal: false, vertical: true)
            }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 12).padding(.horizontal, 14)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(selected ? Color.yumo.accentTint : .yumo.bg))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.yumo.accent, lineWidth: selected ? 2.5 : 0))
        }.buttonStyle(PlainPressStyle()).animation(Motion.snap, value: selected)
    }
}

// MARK: - Rev 5 components (DESIGN_SYSTEM.md › Rev 5)

/// 7 × (12/800 initial + 32 pt circle): logged = accent + white tick; today = 2 pt grabber ring; other = 2 pt edge ring; selected = inset 2.5 pt accent.
struct WeekStrip: View {
    var days: [(date: Date, logged: Bool)]; var selected: Date; var onPick: (Date) -> Void
    var body: some View {
        HStack { ForEach(Array(days.enumerated()), id: \.offset) { _, d in
            let sel = Calendar.current.isDate(d.date, inSameDayAs: selected), today = Calendar.current.isDateInToday(d.date)
            Button { onPick(d.date) } label: {
                VStack(spacing: 7) {
                    Text(String(Fmt.weekday(d.date).prefix(1))).font(.nunito(12, .extrabold)).foregroundStyle(sel ? Color.yumo.ink : .yumo.inkMuted)
                    ZStack {
                        Circle().fill(d.logged ? Color.yumo.accent : .clear)
                        if sel { Circle().strokeBorder(Color.yumo.accent, lineWidth: 2.5) } else if !d.logged { Circle().strokeBorder(today ? Color.yumo.grabber : .yumo.surfaceEdge, lineWidth: 2) }
                        if d.logged { TickGlyph(color: .white) }
                    }.frame(width: 32, height: 32)
                        .overlay { if sel && d.logged { Circle().stroke(Color.yumo.accent, lineWidth: 2.5).padding(-4.5).overlay(Circle().stroke(Color.yumo.bg, lineWidth: 3).padding(-1.5)) } }
                        .animation(Motion.expand, value: d.logged).animation(Motion.expand, value: sel)
                }.frame(width: 36)
            }.buttonStyle(PlainPressStyle())
            if d.date != days.last?.date { Spacer(minLength: 0) }
        } }
    }
}
struct TickGlyph: View { var color: Color
    var body: some View { Path { p in p.move(to: CGPoint(x: 1.5, y: 6)); p.addLine(to: CGPoint(x: 5.2, y: 9.5)); p.addLine(to: CGPoint(x: 12.5, y: 1.5)) }.stroke(color, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round)).frame(width: 14, height: 11) }
}

/// Surface pill, radius 12, 8×12 padding, lift.card; count 15/800 (ink > 0, muted at 0) + "day streak" 13/800 muted.
struct StreakPill: View { var count: Int
    var body: some View {
        HStack(spacing: 4) { Text("\(count)").font(.nunito(15, .extrabold)).tabular().foregroundStyle(count > 0 ? Color.yumo.ink : .yumo.inkMuted); Text("day streak").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.inkMuted) }
            .padding(.vertical, 8).padding(.horizontal, 12).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.yumo.surface)).lifted(radius: 12)
    }
}

/// Rev 11 §4.2: Today chip — 36 pt, padding 0 12, surface, radius.control, lift.card: "Today" 13/800 ink · gap 6 · return arrow 14 pt accent. Header right slot whenever the viewed day ≠ today; outranks the review chip and streak pill.
struct TodayChip: View { var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) { Text("Today").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.ink); Image(systemName: "arrow.counterclockwise").font(.system(size: 13, weight: .heavy)).foregroundStyle(Color.yumo.accent).frame(width: 14, height: 14) }
                .padding(.horizontal, 12).frame(height: 36)
        }.buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: Lift.card, radius: Radius.control))
        .accessibilityLabel("Back to today")
    }
}
/// Rev 11 §4.8: text actions that only fade while pressed (opacity .6).
struct FadePressStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label.contentShape(Rectangle()).opacity(configuration.isPressed ? 0.6 : 1) } }

/// Rev 10 §4.2: 24 × 24, radius 7, accent fill, lift 2 accent.edge, white "y" 15/900 tracking −0.5.
struct YumoMark: View { var size: CGFloat = 24
    var body: some View {
        Text("y").font(.nunito(size * 15 / 24, .black)).kerning(-0.5).foregroundStyle(Color.yumo.onAccent).offset(y: -size * 0.06)
            .frame(width: size, height: size).background(RoundedRectangle(cornerRadius: size * 7 / 24, style: .continuous).fill(Color.yumo.accent)).lifted(.yumo.accentEdge, lift: Lift.small, radius: size * 7 / 24)
    }
}
/// Rev 10 §4.2: review chip — 36 pt, padding 0 12 0 6, surface, radius.control, lift.card: Yumo mark 24 · "Your week" 13/800 ink · "›" 13/800 accent. Header right slot, priority over the streak pill.
struct ReviewChip: View { var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) { YumoMark(); Text("Your week").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.ink); Text("›").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }
                .padding(.leading, 6).padding(.trailing, 12).frame(height: 36)
        }.buttonStyle(LiftButtonStyle(fill: .yumo.surface, edge: .yumo.surfaceEdge, lift: Lift.card, radius: Radius.control))
        .accessibilityLabel("Your weekly review")
    }
}

/// Floating month grid: surface, radius 22, lift 4 + the system's one blurred shadow; 32 pt day circles, 5 pt accent dot on logged days, future muted.
struct CalendarPopover: View {
    var month: Date; var selected: Date; var logged: Set<String>; var onPick: (Date) -> Void; var onToday: () -> Void
    var body: some View {
        let cal = Calendar.current, today = Date().startOfDay
        let first = cal.date(from: cal.dateComponents([.year, .month], from: month))!
        let n = cal.range(of: .day, in: .month, for: first)!.count, lead = (cal.component(.weekday, from: first) + 5) % 7
        VStack(spacing: 0) {
            HStack { Text(Fmt.monthTitle(first)).font(.yumo.title); Spacer(); Button(action: onToday) { Text("Today").font(.nunito(13, .extrabold)).foregroundStyle(Color.yumo.accent) }.buttonStyle(PlainPressStyle()) }.padding(.horizontal, 4)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
                ForEach(["M", "T", "W", "T", "F", "S", "S"].indices, id: \.self) { i in Text(["M", "T", "W", "T", "F", "S", "S"][i]).font(.nunito(11, .extrabold)).kerning(0.4).foregroundStyle(Color.yumo.inkMuted).frame(height: 16) }
                ForEach(0..<(lead + n), id: \.self) { i in
                    if i < lead { Color.clear.frame(height: 40) } else {
                        let d = cal.date(byAdding: .day, value: i - lead, to: first)!, future = d > today, sel = cal.isDate(d, inSameDayAs: selected), isToday = cal.isDate(d, inSameDayAs: today)
                        Button { if !future { onPick(d) } } label: {
                            VStack(spacing: 3) {
                                Text("\(i - lead + 1)").font(.nunito(15, .extrabold)).tabular().foregroundStyle(future ? Color.yumo.grabber : sel ? .white : .yumo.ink).frame(width: 32, height: 32)
                                    .background(Circle().fill(sel ? Color.yumo.accent : isToday ? .yumo.accentTint : .clear))
                                Circle().fill(!future && logged.contains(d.dayKey) && !sel ? Color.yumo.accent : .clear).frame(width: 5, height: 5)
                            }.frame(height: 40)
                        }.buttonStyle(PlainPressStyle()).disabled(future)
                    }
                }
            }.padding(.top, 12)
        }
        .padding(EdgeInsets(top: 16, leading: 16, bottom: 14, trailing: 16))
        .background {
            // lift 4 + the system's one blurred shadow (floating layers only), composed as one shape so the edge and the shadow don't double up
            ZStack { RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surfaceEdge).offset(y: 4); RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface) }
                .shadow(color: Color.yumo.floatingShadow, radius: 20, y: 18)
        }
    }
}

/// Rev 10 §2.2 repeat row content (60 pt): 30 pt tint tile with an accent arrow · "Swipe right to add it again" 16/700 ink · sub-line = first two food short-names (+ N other) 12/700 muted · kcal 16/800. Nudges 0 → 22 → 0 → 10 → 0 once (motion.nudge).
struct SwipeHintRow: View {
    var foods: [String]; var kcal: Double; var nudge: Bool
    @State private var dx: CGFloat = 0
    var subline: String {
        let two = foods.prefix(2).joined(separator: ", "), rest = foods.count - 2
        return rest > 0 ? "\(two) + \(rest) other\(rest == 1 ? "" : "s")" : two
    }
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.yumo.accentTint).frame(width: 30, height: 30).overlay(ArrowGlyph(color: .yumo.accent))
            VStack(alignment: .leading, spacing: 1) {
                Text("Swipe right to add it again").font(.nunito(16, .bold)).foregroundStyle(Color.yumo.ink).lineLimit(1)
                Text(subline).font(.nunito(12, .bold)).foregroundStyle(Color.yumo.inkMuted).lineLimit(1)
            }
            Spacer(minLength: 8); Text(Fmt.k(kcal)).font(.nunito(16, .extrabold)).tabular().foregroundStyle(Color.yumo.ink)
        }
        .padding(.leading, Space.cardPad).padding(.trailing, 14).frame(height: 60).offset(x: dx)
        .onAppear { guard nudge else { return }; Task {
            try? await Task.sleep(for: .milliseconds(600))
            for (v, ms) in [(22.0, 400), (0.0, 400), (10.0, 300), (0.0, 300)] { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: Double(ms) / 1000)) { dx = v }; try? await Task.sleep(for: .milliseconds(ms)) }   // motion.nudge
        } }
    }
}
struct ArrowGlyph: View { var color: Color
    var body: some View { Path { p in p.move(to: CGPoint(x: 1, y: 6)); p.addLine(to: CGPoint(x: 13, y: 6)); p.move(to: CGPoint(x: 9, y: 1.5)); p.addLine(to: CGPoint(x: 13.5, y: 6)); p.addLine(to: CGPoint(x: 9, y: 10.5)) }.stroke(color, style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round)).frame(width: 16, height: 12) }
}

/// Surface tile with a ▲▼ glyph; vertical drag 10 pt = 5 g; the number turns danger below its floor.
struct MacroDragTile: View {
    var label: String; @Binding var value: Int; var lo: Int; var hi: Int; var danger: Bool; var onBegin: () -> Void = {}
    @State private var start: Int? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.nunito(13, .bold)).foregroundStyle(Color.yumo.inkMuted)
            HStack(alignment: .firstTextBaseline, spacing: 2) { Text("\(value)").font(.nunito(24, .extrabold)).tabular().foregroundStyle(danger ? Color.yumo.danger : .yumo.ink); Text("g").font(.nunito(13, .bold)).foregroundStyle(Color.yumo.inkMuted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.yumo.surface)).lifted(radius: 18)
        .overlay(alignment: .topTrailing) { VStack(spacing: 2) { Text("▲"); Text("▼") }.font(.system(size: 9, weight: .bold)).foregroundStyle(Color.yumo.grabber).padding(.top, 12).padding(.trailing, 10) }
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 2).onChanged { d in
            if start == nil { start = value; onBegin() }
            let v = Int(((Double(start!) + Double(-d.translation.height) / 10 * 5) / 5).rounded()) * 5
            let nv = min(hi, max(lo, v)); if nv != value { value = nv; UISelectionFeedbackGenerator().selectionChanged() }
        }.onEnded { _ in start = nil })
    }
}

/// 10 pt, radius 5, segments accent / ink / muted; widths animate on the token curve.
struct StackedBar: View { var parts: [Double]   // fractions 0…1 in order protein, carbs, fat
    var body: some View {
        GeometryReader { g in
            HStack(spacing: 0) {
                ForEach(parts.indices, id: \.self) { i in Rectangle().fill([Color.yumo.accent, .yumo.ink, .yumo.inkMuted][i % 3]).frame(width: max(0, g.size.width * min(1, parts[i]))) }
                Spacer(minLength: 0)
            }
        }.frame(height: 10).background(Capsule().fill(Color.yumo.track)).clipShape(Capsule()).animation(Motion.expand, value: parts)
    }
}

/// motion.expand: the one disclosure. Height unfolds, content fades and rises 8 pt, chevron rotates 90°; collapse is the exact reverse.
struct Expandable<Content: View>: View {
    var open: Bool; @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0) { if open { content().opacity(open ? 1 : 0).offset(y: open ? 0 : 8).transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 8)), removal: .opacity.combined(with: .offset(y: 8)))) } }
            .frame(maxWidth: .infinity, alignment: .leading).clipped().animation(Motion.expand, value: open)
    }
}
struct ExpandChevron: View { var open: Bool
    var body: some View { Text("›").font(.nunito(16, .extrabold)).foregroundStyle(Color.yumo.grabber).rotationEffect(.degrees(open ? 90 : 0)).animation(Motion.expand, value: open) }
}

/// Rev 6: 40 pt tint circle with an accent sparkle (four-point star + small companion), lift 0 2 0 accent.tint.edge. The I prepped… entry on the hero card.
struct SparkleButton: View { var action: () -> Void
    @State private var dim = false
    @AppStorage("yumo.twinkleDay") private var twinkleDay = ""
    var body: some View {
        Button(action: action) { SparkleGlyph(color: .yumo.accent).frame(width: 40, height: 40).opacity(dim ? 0.55 : 1).scaleEffect(dim ? 0.92 : 1) }
            .buttonStyle(LiftButtonStyle(fill: .yumo.accentTint, edge: .yumo.accentTintEdge, lift: 2, radius: 20)).accessibilityLabel("I prepped…")
            .onAppear {   // motion.twinkle: once per day when it becomes available, then still
                let today = Date().dayKey; guard twinkleDay != today else { return }; twinkleDay = today
                Task { withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.8)) { dim = true }; try? await Task.sleep(for: .milliseconds(800)); withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.8)) { dim = false } }
            }
    }
}
struct SparkleGlyph: View { var color: Color
    var body: some View {
        Canvas { ctx, size in
            func star(_ c: CGPoint, _ r: CGFloat) -> Path { var p = Path(); let k = r * 0.28
                p.move(to: CGPoint(x: c.x, y: c.y - r)); p.addQuadCurve(to: CGPoint(x: c.x + r, y: c.y), control: CGPoint(x: c.x + k, y: c.y - k))
                p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + r), control: CGPoint(x: c.x + k, y: c.y + k)); p.addQuadCurve(to: CGPoint(x: c.x - r, y: c.y), control: CGPoint(x: c.x - k, y: c.y + k))
                p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - r), control: CGPoint(x: c.x - k, y: c.y - k)); p.closeSubpath(); return p }
            ctx.fill(star(CGPoint(x: size.width * 0.44, y: size.height * 0.54), size.width * 0.26), with: .color(color))
            ctx.fill(star(CGPoint(x: size.width * 0.74, y: size.height * 0.3), size.width * 0.11), with: .color(color))
        }
    }
}

// MARK: - motion.push (FIDELITY_AUDIT §5): every pushed page fades in and rises 12 → 0 pt over 360 ms; back is the exact reverse. No slide.

private struct PushDismissKey: EnvironmentKey { static let defaultValue: ((@escaping () -> Void) -> Void)? = nil }
extension EnvironmentValues { var pushDismiss: ((@escaping () -> Void) -> Void)? { get { self[PushDismissKey.self] } set { self[PushDismissKey.self] = newValue } } }

/// Wraps a pushed page: enters on motion.push; `pushDismiss` in the environment plays the reverse before the real dismissal.
struct PushPage<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @State private var shown = false
    var body: some View {
        content()
            .opacity(shown ? 1 : 0).offset(y: shown ? 0 : 12)
            .background(Color.yumo.bg.ignoresSafeArea())
            .onAppear { withAnimation(Motion.push) { shown = true } }
            .environment(\.pushDismiss, { completion in withAnimation(Motion.push) { shown = false }; Task { try? await Task.sleep(for: .milliseconds(360)); completion() } })
    }
}
extension View {
    /// A full-screen page presented without the system slide: the binding flips with animations disabled and PushPage animates the content.
    func pushCover<C: View>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil, @ViewBuilder content: @escaping () -> C) -> some View {
        let b = Binding(get: { isPresented.wrappedValue }, set: { v in var t = Transaction(); t.disablesAnimations = true; withTransaction(t) { isPresented.wrappedValue = v } })
        return fullScreenCover(isPresented: b, onDismiss: onDismiss) { PushPage(content: content) }
    }
    func pushCover<I: Identifiable, C: View>(item: Binding<I?>, onDismiss: (() -> Void)? = nil, @ViewBuilder content: @escaping (I) -> C) -> some View {
        let b = Binding(get: { item.wrappedValue }, set: { v in var t = Transaction(); t.disablesAnimations = true; withTransaction(t) { item.wrappedValue = v } })
        return fullScreenCover(item: b, onDismiss: onDismiss) { i in PushPage { content(i) } }
    }
}

// MARK: - Rev 9 components

/// 24 pt circle, 2 pt accent ring, italic serif "i" 13/900 accent. Replaces every "How ›" / "Why" link beside a computed number.
struct InfoButton: View { var action: () -> Void
    var body: some View {
        Button(action: action) { Text("i").font(.system(size: 13, weight: .black, design: .serif)).italic().foregroundStyle(Color.yumo.accent).frame(width: 24, height: 24).overlay(Circle().strokeBorder(Color.yumo.accent, lineWidth: 2)).frame(width: 44, height: 44).contentShape(Rectangle()) }
            .buttonStyle(PlainPressStyle()).accessibilityLabel("How this works")
    }
}
/// 8 pt dot: warning (low this week) or danger (over an upper limit). Fine = no dot, no row.
struct StatusDot: View { var over: Bool
    var body: some View { Circle().fill(over ? Color.yumo.danger : .yumo.warning).frame(width: 8, height: 8) }
}
/// 64 pt ring: track stroke 7 pt, accent arc = share, count 16/800 centred.
struct Ring: View { var fraction: Double; var label: String; var size: CGFloat = 64
    @State private var shown = 0.0
    var body: some View {
        ZStack { Circle().stroke(Color.yumo.track, lineWidth: 7); Circle().trim(from: 0, to: shown).stroke(Color.yumo.accent, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90)); Text(label).font(.nunito(16, .extrabold)).tabular() }
            .frame(width: size, height: size).onAppear { withAnimation(Motion.bar) { shown = fraction } }.onChange(of: fraction) { withAnimation(Motion.bar) { shown = fraction } }
    }
}
/// motion.countUp: each digit is its own 0–9 column rolling to its value, 500 ms, 40 ms right-to-left stagger; separators static. Numbers never snap.
struct CountUpText: View {
    var value: Int; var font: Font; var color: Color; var kerning: CGFloat = 0
    @State private var shown: Int
    @State private var digitsShown: [Int] = []
    init(value: Int, font: Font, color: Color, kerning: CGFloat = 0) { self.value = value; self.font = font; self.color = color; self.kerning = kerning; _shown = State(initialValue: value) }
    var body: some View {
        let text = Fmt.k(shown), chars = Array(text)
        HStack(spacing: 0) {
            ForEach(chars.indices, id: \.self) { i in
                let ch = chars[i]
                if let d = ch.wholeNumberValue { DigitColumn(digit: d, font: font, color: color, delay: Double(chars.count - 1 - i) * 0.04) }
                else { Text(String(ch)).font(font).foregroundStyle(color) }
            }
        }.kerning(kerning).tabular().onChange(of: value) { shown = value }
    }
}
private struct DigitColumn: View { var digit: Int; var font: Font; var color: Color; var delay: Double
    @State private var current: Int
    init(digit: Int, font: Font, color: Color, delay: Double) { self.digit = digit; self.font = font; self.color = color; self.delay = delay; _current = State(initialValue: digit) }
    var body: some View {
        Text("0").font(font).foregroundStyle(.clear).overlay(
            GeometryReader { g in
                VStack(spacing: 0) { ForEach(0..<10, id: \.self) { n in Text("\(n)").font(font).foregroundStyle(color).frame(height: g.size.height) } }
                    .offset(y: -CGFloat(current) * g.size.height)
            }.clipped()
        ).tabular().onChange(of: digit) { withAnimation(Motion.countUp.delay(delay)) { current = digit } }
    }
}
/// "Which days" picker: M T W T F S S, 28 pt circles — accent + white tick when on, 2 pt edge ring when off. The Today week strip, reused.
struct DayDots: View { @Binding var days: [Bool]
    var body: some View {
        HStack { ForEach(0..<7, id: \.self) { i in
            Button { days[i].toggle() } label: {
                VStack(spacing: 5) {
                    Text(Supplements.dayLetters[i]).font(.nunito(11, .extrabold)).foregroundStyle(Color.yumo.inkMuted)
                    ZStack { Circle().fill(days[i] ? Color.yumo.accent : .clear); if !days[i] { Circle().strokeBorder(Color.yumo.surfaceEdge, lineWidth: 2) }; if days[i] { TickGlyph(color: .yumo.onAccent).scaleEffect(0.85) } }.frame(width: 28, height: 28).animation(Motion.expand, value: days[i])
                }.frame(maxWidth: .infinity)
            }.buttonStyle(PlainPressStyle())
        } }
    }
}
