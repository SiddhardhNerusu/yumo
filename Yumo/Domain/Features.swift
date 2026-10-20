import Foundation

/// Product switches. Everything behind a `false` is built and kept; flip it to bring the feature back.
enum Features {
    /// Type it — the one-line parser ("chicken 180 rice 150" → rows, asks, learned shorthand) and the Scan · Type it pick tiles.
    /// Off since 20 Oct 2026: new users found it confusing; the Add sheet is a plain searchable list with recents on top.
    /// With it on: the sheet opens on the two tiles, the field placeholder shows the line form, digits switch to the parser, the tour's
    /// stop 3 pre-types "oats 80 banana 1". Code: Screens/Add/TypeItView.swift, Domain/TypeToLog.swift (the resolver stays in use by I prepped…).
    static let typeIt = false
    /// The Breakfast · Lunch · Dinner · Snacks switcher inside the Add sheet and the scanner. Off since 20 Oct 2026: the + already chose the meal.
    static let mealSwitcherInAdd = false
}
