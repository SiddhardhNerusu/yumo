import SwiftUI

// MARK: - Colour tokens (DESIGN_SYSTEM.md rev 2 › Colour — "Sand & ink"). Values taken from the rev 2 prototype, which wins over the doc.
// All neutrals are one OKLCH hue family (h 81–85°); danger is the accent's triad (h 19°). Never introduce a hue outside this set.
extension Color {
    /// Every colour is a token; light and dark ("Lit from above") values from FIDELITY_AUDIT §1. Never a system colour.
    enum yumo {
        static let accent      = Color(light: 0x4CC417, dark: 0x4CC417)   // oklch(0.72 0.22 139°)
        static let accentEdge  = Color(light: 0x3BA40F, dark: 0x3BA40F)
        static let accentSoft  = Color(light: 0xC4EFAE, dark: 0x35602A)
        static let accentSoftEdge = Color(light: 0xA9E08C, dark: 0x2A4A22)   // disabled PrimaryButton edge
        static let accentTint  = Color(light: 0xE9F5DF, dark: 0x2E4A24)
        static let accentTintEdge = Color(light: 0xCFEFC0, dark: 0x243A1C)
        static let accentWash  = Color(light: 0x8FE065, dark: 0x8FE065)
        static let danger      = Color(light: 0xC8353F, dark: 0xE05A62)   // triad of the accent; text and swipe-remove only
        static let dangerFill  = Color(light: 0xC8353F, dark: 0xC8353F)   // rev 10: swipe-delete action fill (white bin on it)
        static let dangerTint  = Color(light: 0xFBE9EA, dark: 0x4A2326)
        static let pressed     = Color(light: 0xF3EEE2, dark: 0x33302C)   // rev 10: row background while a finger is down (surface mixed 6 % toward ink)
        static let bg          = Color(light: 0xEBE2D2, dark: 0x1A1917)   // sand
        static let surface     = Color(light: 0xFFFBF3, dark: 0x2B2926)   // parchment
        static let surfaceEdge = Color(light: 0xD6CAB2, dark: 0x0F0E0D)
        static let track       = Color(light: 0xEFE7D8, dark: 0x3A3733)
        static let control     = Color(light: 0xE2D8C5, dark: 0x3A3733)
        static let hairline    = Color(light: 0xE6DCC8, dark: 0x3A3733)
        static let grabber     = Color(light: 0xC9BFAA, dark: 0x4A463F)
        static let insetEdge   = Color(light: 0xE6E1D6, dark: 0x3A3733)   // InsetField inner edge
        static let ink         = Color(light: 0x1F1C17, dark: 0xF2EDE3)   // warm black / warm white
        static let inkMuted    = Color(light: 0x8C8578, dark: 0xA39D92)
        static let onAccent    = Color(light: 0xFFFFFF, dark: 0xFFFFFF)   // labels on accent fills
        static let toastEdge   = Color(light: 0x0E0D0B, dark: 0x0E0D0B)
        static let torchOn     = Color(light: 0xFFD84D, dark: 0xFFD84D)
        static let liftHighlight = Color(hex: 0xFFFBF3).opacity(0.07)    // 1 pt top highlight on lifted elements in dark mode
        static let floatingShadow = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor.black.withAlphaComponent(0.5) : UIColor(red: 31/255, green: 28/255, blue: 23/255, alpha: 0.18) })   // the one blurred shadow (CalendarPopover)
        static let warning     = Color(light: 0xC9962A, dark: 0xD9A94A)   // tetrad −90°: ONLY the StatusDot for "low this week"; never text, fill or border
        static let tourScrim   = Color(hex: 0x1F1C17).opacity(0.55)
        static let backdrop    = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor.black.withAlphaComponent(0.6) : UIColor.black.withAlphaComponent(0.45) })
        static let scanMask    = Color.black.opacity(0.35)
    }
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
    /// sRGB, resolved per appearance.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { tc in let h = tc.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((h >> 16) & 0xFF) / 255, green: CGFloat((h >> 8) & 0xFF) / 255, blue: CGFloat(h & 0xFF) / 255, alpha: 1) })
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
        static let hero = Font.nunito(72, .extrabold)          // Today hero number, kerning −2.5 (heroXL)
        static let plan = Font.nunito(64, .extrabold)          // onboarding Daily target, Calorie target hero, kerning −2
        static let verdict = Font.nunito(64, .extrabold)       // rev 10: weekly review page 1 number, kerning −2
        static let headline = Font.nunito(28, .extrabold)      // rev 10: review page 1 line under the number, kerning −0.4
        static let display = Font.nunito(34, .extrabold)       // "Today ▾", "Progress", Maintenance value, kerning −0.4
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
        static let tabLabel = Font.nunito(11, .extrabold)      // rev 10: 11/800
        static let inlineTitle = Font.nunito(17, .extrabold)   // rev 10: collapsed nav title
        static let wordmark = Font.nunito(48, .black)
    }
}

// MARK: - Shape, lift, spacing, motion
enum Radius {
    static let card: CGFloat = 24           // Today cards, hero, sheets' inner cards (the primary value)
    static let cardDense: CGFloat = 22      // Progress / Settings / list pages
    static let sheet: CGFloat = 30, found: CGFloat = 26
    static let buttonHero: CGFloat = 20, button: CGFloat = 18, field: CGFloat = 16
    static let chip: CGFloat = 14           // AddChip, chips
    static let panel: CGFloat = 14          // inset expand panels, AskList
    static let control: CGFloat = 12        // segmented, ✕ circles, InsetField, AddChip (rev 10), review chip
    static let action: CGFloat = 14         // rev 10: the swipe-action button inside a row
    static let tile: CGFloat = 14           // rev 10: inset stat tiles (Logged / Weigh-ins / Confidence)
    static let statCard: CGFloat = 16       // rev 10: review stat cards
    static let thumb: CGFloat = 10, bar: CGFloat = 8, tag: CGFloat = 6, track: CGFloat = 5
}
enum Lift { static let card: CGFloat = 3, primary: CGFloat = 4, small: CGFloat = 2 }
enum Space {
    static let gutter: CGFloat = 16, cardPad: CGFloat = 20, heroGap: CGFloat = 12, gridGap: CGFloat = 14
    static let cardGap: CGFloat = 12, cardGapDense: CGFloat = 10          // Today · Progress/Settings
    static let rowFood: CGFloat = 9, rowHeader: CGFloat = 13 /* rev 10 §2.1: 13 + AddChip 34 + 13 = 60, the row height */, rowHeaderDense: CGFloat = 11, rowSettings: CGFloat = 12, rowFooter: CGFloat = 10
    static let bottomClear: CGFloat = 105, bottomClearToday: CGFloat = 115, toastBottom: CGFloat = 100   // rev 10 §4.7: list ends 115 (Today) / 105 (Progress) above the screen bottom
}
enum Motion {
    static let sheet = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.42)
    static let push = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.36)     // pushed pages: fade + 12 pt rise, 360 ms, one curve
    static let expand = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.36)   // rev 5: every disclosure unfolds on this and nothing else
    static let snap = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.35)
    // motion.swipeStage (rev 10 §3): open snap 320 ms spring curve · commit slide-out 260 ms one curve · glyph slide 200 ms spring · glyph scale 180 ms overshoot
    static let swipeOpen = Animation.timingCurve(0.2, 0.9, 0.3, 1.1, duration: 0.32)
    static let swipeCommit = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.26)
    static let swipeGlyph = Animation.timingCurve(0.2, 0.9, 0.3, 1.1, duration: 0.20)
    static let swipeGlyphScale = Animation.timingCurve(0.34, 1.5, 0.64, 1, duration: 0.18)
    static let dayChange = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.32)   // motion.dayChange: ±14 pt slide + fade; also motion.reviewPage
    static let titleCollapse = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.15) // motion.titleCollapse: only the momentum tail; otherwise linear with scroll
    static let pressIn = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.10)      // motion.pressHighlight: rows → color.pressed 100 ms in
    static let pressOut = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.20)     // … 200 ms out
    static let tabPop = Animation.timingCurve(0.34, 1.5, 0.64, 1, duration: 0.40)    // motion.tabPop scale 1 → 1.12 → 1 (also the review verdict tick)
    static let bar = Animation.timingCurve(0.34, 1.3, 0.64, 1, duration: 0.45)   // motion.barFill: the one curve with ≈ +2 % overshoot
    static let countUp = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.5)
    static let press = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.12)
    static let toastIn = Animation.easeOut(duration: 0.25)
    static let toastHold: Double = 1.8
}

// MARK: - Lift modifier: solid bottom edge, no blur. Pressed = translate down by the lift and edge → 0.
struct Lifted: ViewModifier {
    var edge: Color; var lift: CGFloat; var radius: CGFloat; var pressed: Bool = false
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content
            .overlay { if scheme == .dark { TopHighlight(radius: radius) } }   // dark: 1 pt top highlight keeps the lift legible
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous).fill(edge)
                    .offset(y: pressed ? 0 : lift)
            )
            .offset(y: pressed ? lift : 0)
    }
}
/// `inset 0 1 0 rgba(255,251,243,.07)`: a 1 pt highlight along the top edge, clipped to the shape.
struct TopHighlight: View { var radius: CGFloat
    var body: some View { RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.yumo.liftHighlight).mask(VStack { Rectangle().frame(height: 1); Spacer(minLength: 0) }).allowsHitTesting(false) }
}
extension View {
    func lifted(_ edge: Color = .yumo.surfaceEdge, lift: CGFloat = Lift.card, radius: CGFloat = Radius.cardDense, pressed: Bool = false) -> some View {
        modifier(Lifted(edge: edge, lift: lift, radius: radius, pressed: pressed))
    }
    func card(padding: EdgeInsets = EdgeInsets(top: Space.cardPad, leading: Space.cardPad, bottom: Space.cardPad, trailing: Space.cardPad), radius: CGFloat = Radius.cardDense) -> some View {
        self.padding(padding)
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.yumo.surface))
            .lifted(radius: radius)
    }
    func listCard(radius: CGFloat = Radius.cardDense) -> some View {
        self.background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.yumo.surface))
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .lifted(radius: radius)
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
            .animation(Motion.press, value: configuration.isPressed)   // motion.press: 120 ms so the spring-back is visible
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
    static let weekdayF: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "EEE"; return f }()
    static func weekday(_ d: Date) -> String { weekdayF.string(from: d) }
    static let monthF: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "MMMM yyyy"; return f }()
    static func monthTitle(_ d: Date) -> String { monthF.string(from: d) }
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
