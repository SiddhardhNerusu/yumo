import SwiftUI

// MARK: - Colour tokens (DESIGN_SYSTEM.md rev 2 › Colour — "Sand & ink"). Values taken from the rev 2 prototype, which wins over the doc.
// All neutrals are one OKLCH hue family (h 81–85°); danger is the accent's triad (h 19°). Never introduce a hue outside this set.
extension Color {
    enum yumo {
        static let accent      = Color(hex: 0x4CC417)   // oklch(0.72 0.22 139°)
        static let accentEdge  = Color(hex: 0x3BA40F)
        static let accentSoft  = Color(hex: 0xC4EFAE)
        static let accentTint  = Color(hex: 0xE9F5DF)
        static let accentTintEdge = Color(hex: 0xCFEFC0)
        static let accentWash  = Color(hex: 0x8FE065)
        static let danger      = Color(hex: 0xC8353F)   // triad of the accent
        static let bg          = Color(hex: 0xEBE2D2)   // sand
        static let surface     = Color(hex: 0xFFFBF3)   // parchment
        static let surfaceEdge = Color(hex: 0xD6CAB2)
        static let track       = Color(hex: 0xEFE7D8)
        static let control     = Color(hex: 0xE2D8C5)
        static let hairline    = Color(hex: 0xE6DCC8)
        static let grabber     = Color(hex: 0xC9BFAA)
        static let insetEdge   = Color(hex: 0xE6E1D6)   // InsetField inner edge
        static let ink         = Color(hex: 0x1F1C17)   // warm black
        static let inkMuted    = Color(hex: 0x8C8578)
        static let toastEdge   = Color(hex: 0x0E0D0B)
        static let torchOn     = Color(hex: 0xFFD84D)
        static let backdrop    = Color.black.opacity(0.45)
        static let scanMask    = Color.black.opacity(0.35)
    }
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}

// MARK: - Type (Nunito; falls back to SF Pro Rounded if the TTFs are not bundled). All numbers tabular.
enum YumoWeight { case medium, semibold, bold, extrabold, black
    var postscript: String { switch self { case .medium: "Nunito-Medium"; case .semibold: "Nunito-SemiBold"; case .bold: "Nunito-Bold"; case .extrabold: "Nunito-ExtraBold"; case .black: "Nunito-Black" } }
    var system: Font.Weight { switch self { case .medium: .medium; case .semibold: .semibold; case .bold: .bold; case .extrabold: .heavy; case .black: .black } }
}
extension Font {
    static func nunito(_ size: CGFloat, _ weight: YumoWeight) -> Font {
        if UIFont(name: weight.postscript, size: size) != nil { return .custom(weight.postscript, size: size) }
        return .system(size: size, weight: weight.system, design: .rounded)
    }
    enum yumo {
        static let hero = Font.nunito(64, .extrabold)
        static let display = Font.nunito(34, .extrabold)
        static let bigStat = Font.nunito(34, .extrabold)
        static let displayMuted = Font.nunito(20, .semibold)
        static let stat = Font.nunito(20, .extrabold)
        static let statBig = Font.nunito(44, .extrabold)
        static let rulerValue = Font.nunito(72, .extrabold)
        static let axis = Font.nunito(11, .extrabold)
        static let pageTitle = Font.nunito(30, .extrabold)
        static let title = Font.nunito(17, .extrabold)
        static let body = Font.nunito(17, .semibold)
        static let bodyStrong = Font.nunito(17, .bold)
        static let action = Font.nunito(15, .extrabold)
        static let subtitle = Font.nunito(15, .bold)
        static let detail = Font.nunito(14, .semibold)
        static let caption = Font.nunito(13, .bold)
        static let captionLight = Font.nunito(13, .semibold)
        static let overline = Font.nunito(12, .extrabold)
        static let footnote = Font.nunito(12, .bold)
        static let buttonHero = Font.nunito(20, .black)
        static let button = Font.nunito(18, .black)
        static let buttonCompact = Font.nunito(15, .extrabold)
        static let tile = Font.nunito(17, .black)
        static let segment = Font.nunito(13, .extrabold)
        static let tag = Font.nunito(12, .extrabold)
        static let tabLabel = Font.nunito(10, .extrabold)
        static let wordmark = Font.nunito(48, .black)
    }
}

// MARK: - Shape, lift, spacing, motion
enum Radius {
    static let card: CGFloat = 22, sheet: CGFloat = 30, found: CGFloat = 26
    static let buttonHero: CGFloat = 20, button: CGFloat = 18, field: CGFloat = 16, chip: CGFloat = 14, control: CGFloat = 12
    static let thumb: CGFloat = 10, bar: CGFloat = 8, tag: CGFloat = 6, track: CGFloat = 5, addChip: CGFloat = 14, inset: CGFloat = 12
}
enum Lift { static let card: CGFloat = 3, primary: CGFloat = 4, small: CGFloat = 2 }
enum Space {
    static let gutter: CGFloat = 16, cardPad: CGFloat = 20, cardGap: CGFloat = 10, heroGap: CGFloat = 12, gridGap: CGFloat = 14
    static let rowFood: CGFloat = 9, rowHeader: CGFloat = 11, rowSettings: CGFloat = 12, rowFooter: CGFloat = 10
    static let bottomClear: CGFloat = 90, toastBottom: CGFloat = 100
}
enum Motion {
    static let sheet = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.42)
    static let push = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.38)
    static let snap = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.35)
    static let remove = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.32)
    static let add = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.30)
    static let bar = Animation.easeInOut(duration: 0.4)
    static let toastIn = Animation.easeOut(duration: 0.25)
    static let toastHold: Double = 1.8
}

// MARK: - Lift modifier: solid bottom edge, no blur. Pressed = translate down by the lift and edge → 0.
struct Lifted: ViewModifier {
    var edge: Color; var lift: CGFloat; var radius: CGFloat; var pressed: Bool = false
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous).fill(edge)
                    .offset(y: pressed ? 0 : lift)
            )
            .offset(y: pressed ? lift : 0)
    }
}
extension View {
    func lifted(_ edge: Color = .yumo.surfaceEdge, lift: CGFloat = Lift.card, radius: CGFloat = Radius.card, pressed: Bool = false) -> some View {
        modifier(Lifted(edge: edge, lift: lift, radius: radius, pressed: pressed))
    }
    func card(padding: EdgeInsets = EdgeInsets(top: Space.cardPad, leading: Space.cardPad, bottom: Space.cardPad, trailing: Space.cardPad)) -> some View {
        self.padding(padding)
            .background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface))
            .lifted()
    }
    func listCard() -> some View {
        self.background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface))
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .lifted()
    }
    func hairline() -> some View {
        overlay(alignment: .bottom) { Rectangle().fill(Color.yumo.hairline).frame(height: 0.5) }
    }
    func tabular() -> some View { monospacedDigit() }
}

/// Button style that drops a lifted element onto its edge while pressed. No opacity change.
struct LiftButtonStyle: ButtonStyle {
    var fill: Color; var edge: Color; var lift: CGFloat; var radius: CGFloat
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
            .lifted(edge, lift: lift, radius: radius, pressed: configuration.isPressed)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
/// Plain press style: no visual change (text actions, arrows).
struct PlainPressStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label.contentShape(Rectangle()) } }

// MARK: - Formatting
enum Fmt {
    static let kcal: NumberFormatter = { let f = NumberFormatter(); f.numberStyle = .decimal; f.maximumFractionDigits = 0; f.groupingSeparator = ","; f.usesGroupingSeparator = true; return f }()
    static func k(_ v: Double) -> String { kcal.string(from: NSNumber(value: v.rounded())) ?? "0" }
    static func k(_ v: Int) -> String { k(Double(v)) }
    static func kg(_ v: Double) -> String { String(format: "%.1f", v) }
    static func g(_ v: Double) -> String { String(Int(v.rounded())) }
    static func delta(_ v: Double, unit: String = "kg") -> String { v == 0 ? "0.0 \(unit)" : String(format: "%@%.1f %@", v < 0 ? "−" : "+", abs(v), unit) }
    static let dayFormatter: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "EEE d MMM"; return f }()
    static let monthFormatter: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "MMMM yyyy"; return f }()
    static let iso: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"; return f }()
    /// "Today" or "Sun 11 Oct". Never "Yesterday"/"Tomorrow".
    static func dayTitle(_ d: Date) -> String { Calendar.current.isDateInToday(d) ? "Today" : dayFormatter.string(from: d) }
}
extension Date {
    var dayKey: String { Fmt.iso.string(from: self) }
    static func fromKey(_ k: String) -> Date { Fmt.iso.date(from: k) ?? Date() }
    var startOfDay: Date { Calendar.current.startOfDay(for: self) }
    func adding(days: Int) -> Date { Calendar.current.date(byAdding: .day, value: days, to: self) ?? self }
}
