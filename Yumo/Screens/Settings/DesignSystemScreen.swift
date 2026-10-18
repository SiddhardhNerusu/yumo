import SwiftUI

/// Debug: every token and component side by side, to compare 1:1 with `prototypes/Design System.dc.html` (FIDELITY_AUDIT §0.3).
struct DesignSystemScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var seg = 1
    @State private var field = "80"
    let colours: [(String, Color, String, String)] = [
        ("accent", .yumo.accent, "4CC417", "4CC417"), ("accent.edge", .yumo.accentEdge, "3BA40F", "3BA40F"), ("accent.soft", .yumo.accentSoft, "C4EFAE", "35602A"), ("accent.tint", .yumo.accentTint, "E9F5DF", "2E4A24"),
        ("danger", .yumo.danger, "C8353F", "E05A62"), ("bg", .yumo.bg, "EBE2D2", "1A1917"), ("surface", .yumo.surface, "FFFBF3", "2B2926"), ("surface.edge", .yumo.surfaceEdge, "D6CAB2", "0F0E0D"),
        ("track", .yumo.track, "EFE7D8", "3A3733"), ("control", .yumo.control, "E2D8C5", "3A3733"), ("hairline", .yumo.hairline, "E6DCC8", "3A3733"), ("ink", .yumo.ink, "1F1C17", "F2EDE3"), ("ink.muted", .yumo.inkMuted, "8C8578", "A39D92"), ("grabber", .yumo.grabber, "C9BFAA", "4A463F"),
    ]
    let type: [(String, Font, String)] = [("hero 72/800", .yumo.hero, "2,400"), ("display 34/800", .yumo.display, "Today"), ("plan 64/800", .yumo.plan, "2,300"), ("stat 20/800", .yumo.stat, "200"), ("title 18/800", .nunito(18, .extrabold), "Breakfast"), ("title 17/800", .yumo.title, "Add to Lunch"), ("body 17/700", .yumo.bodyStrong, "Chicken breast"), ("body.light 17/600", .yumo.body, "Oats  80 g"), ("action 15/800", .yumo.action, "See all ›"), ("detail 14/600", .yumo.detail, "80 g · raw"), ("caption 13/700", .yumo.caption, "P 33 · C 82 · F 6"), ("micro 12/700", .yumo.footnote, "weighed today"), ("overline 12/800", .yumo.overline, "PROTEINS"), ("button 18/900", .yumo.button, "Log it"), ("tab 11/800", .yumo.tabLabel, "Today"), ("inlineTitle 17/800", .yumo.inlineTitle, "Today"), ("verdict 64/800", .yumo.verdict, "−0.39"), ("headline 28/800", .yumo.headline, "That's a good week.")]
    var body: some View {
        VStack(spacing: 0) {
            PageHeader(back: "Settings", title: "Design system", onBack: { dismiss() }).padding(.horizontal, Space.gutter)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Compare at 1:1 with Design System.dc.html on the same device size. Appearance: \(scheme == .dark ? "dark" : "light").").font(.yumo.caption).foregroundStyle(Color.yumo.inkMuted)
                    Overline(text: "Colour")
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(colours, id: \.0) { n, c, l, d in
                            HStack(spacing: 10) { RoundedRectangle(cornerRadius: 8).fill(c).frame(width: 36, height: 36).overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.yumo.hairline, lineWidth: 1)); VStack(alignment: .leading, spacing: 1) { Text(n).font(.yumo.caption); Text("#\(scheme == .dark ? d : l)").font(.yumo.footnote).tabular().foregroundStyle(Color.yumo.inkMuted) }; Spacer() }
                        }
                    }.padding(14).background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).lifted()
                    Overline(text: "Type · Nunito, tabular digits")
                    VStack(alignment: .leading, spacing: 10) { ForEach(type, id: \.0) { n, f, sample in HStack(alignment: .firstTextBaseline) { Text(sample).font(f).tabular().lineLimit(1).minimumScaleFactor(0.5); Spacer(); Text(n).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) } } }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).lifted()
                    Overline(text: "Lift · solid edges, no blur")
                    VStack(spacing: 12) {
                        Text("Card · 0 3 0 surface.edge · radius 24").font(.yumo.caption).frame(maxWidth: .infinity, alignment: .leading).card(padding: EdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20), radius: Radius.card)
                        PrimaryButton(label: "PrimaryButton · 0 4 0 accent.edge") {}
                        PrimaryButton(label: "Disabled · accent.soft", disabled: true) {}
                        SecondaryButton(label: "SecondaryButton · 0 3 0", size: .regular) {}
                        HStack(spacing: 14) { AddChip {}; AddCircleButton {}; SparkleButton {}; StepperButton(glyph: "−") {}; StepperButton(glyph: "+") {}; Spacer(); StreakPill(count: 6) }
                    }
                    Overline(text: "Controls")
                    VStack(alignment: .leading, spacing: 12) {
                        Segmented(options: [(0, "1W"), (1, "1M"), (2, "3M"), (3, "All")], selection: $seg)
                        HStack(spacing: 12) { InsetField(text: $field, unit: "g"); Tag(label: "Estimate"); Text("weighed").font(.nunito(11, .extrabold)).foregroundStyle(Color.yumo.inkMuted).padding(.horizontal, 7).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: Radius.tag).fill(Color.yumo.track)); Spacer() }
                        Bar(fraction: 0.62, height: 10, fill: .yumo.accent)
                        HStack(spacing: Space.gridGap) { Bar(fraction: 0.8, height: 5, fill: .yumo.ink); Bar(fraction: 0.4, height: 5, fill: .yumo.ink); Bar(fraction: 0.55, height: 5, fill: .yumo.ink) }
                        StackedBar(parts: [0.33, 0.42, 0.25])
                        WeekStrip(days: (0..<7).reversed().map { (Date().adding(days: -$0), $0 % 2 == 1 || $0 == 2) }, selected: Date()) { _ in }
                        ToastView(text: "Oats → Lunch")
                    }.padding(14).background(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Color.yumo.surface)).lifted()
                    Overline(text: "Shape")
                    HStack(spacing: 10) { ForEach([("card 24", Radius.card), ("cardDense 22", Radius.cardDense), ("button 18", Radius.button), ("field 16", Radius.field), ("panel 14", Radius.panel), ("control 12", Radius.control), ("tag 6", Radius.tag)], id: \.0) { n, r in VStack(spacing: 4) { RoundedRectangle(cornerRadius: r, style: .continuous).fill(Color.yumo.surface).frame(height: 44).lifted(radius: r); Text(n).font(.yumo.footnote).foregroundStyle(Color.yumo.inkMuted) } } }
                }.padding(Space.gutter).padding(.bottom, 40)
            }
        }.background(Color.yumo.bg.ignoresSafeArea())
    }
}
