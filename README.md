# Yumo

Minimal iOS calorie and macro tracker. Native SwiftUI, iOS 17+, SwiftData, no third-party packages.

- **Rule book: `docs/RULEBOOK.md`** is the source of truth for every UI change (start with "The card" and the Definition of done). It ranks: Sid's words, then the rule book, then the design handoff, then platform defaults.
- Design tokens and components: the Yumo Design System artifact (tokens, components, calculations). `Yumo/Theme/Theme.swift` implements it as `Color.yumo.*`, `Font.yumo.*`, `Radius`, `Lift`, `Space`, `Motion`.
- Project file is generated: edit `project.yml`, then `xcodegen generate` (brew install xcodegen).
- Build: open `Yumo.xcodeproj` or `xcodebuild -scheme Yumo -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build`.
- Release: `Scripts/testflight.sh` (see `docs/TESTFLIGHT.md`).
- Fonts: put the Nunito TTFs in `Yumo/Resources/Fonts/` (OFL). Without them the app falls back to SF Pro Rounded.

Rev 2 (15 Oct 2026) is in: Sand & ink theme, AddChip meal headers, full-screen scanner, grouped three-tier search with a bundled USDA generic catalogue, typed grams, micronutrients, adaptive target with weekly check-in, training/rest targets. See CHANGELOG.md.

Layout: `Theme/` tokens + components · `Domain/` models, calculations, store, services (reminders, HealthKit, CSV) · `Networking/` Open Food Facts · `Screens/` Today, Add (pick/scan/search/create/detail), Progress (chart, weight log, ruler sheet), Settings (target, about you, macros, saved meals, my foods), Onboarding.

Food data © Open Food Facts contributors, ODbL. Generic catalogue from USDA FoodData Central (public domain); rebuild with `python3 tools/build-catalogue.py`. USDA Branded fallback needs a free api.data.gov key pasted into `USDABranded.apiKey`.
