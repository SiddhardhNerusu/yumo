# Yumo design rule book

v1 · 23 Oct 2026 · from "Mobile UI theory: what works, what doesn't, and why" (Oct 2026)

This book is the set of rules every change to Yumo's screens is checked against: what we do, why, how to check it, and where the app stands today (as of the 22 Oct audit and the Phase 0 fixes). It is the source of truth for every iteration: a new idea, a handoff rev or a fix is held up against it before it ships, and the dated checklist kept with each build is read from it (P19). When sources disagree, Sid's own words win, then this book, then the design handoff and prototype, then Apple's platform defaults (P1). A rule changes only with evidence and Sid's sign-off, dated in the changelog at the end (P5); a deliberate departure is written onto the rule as a dated exception, never by deleting the rule (P3).

## The card

The one page to hold every change against. Each line names the full rules below; the numbers are the ones that decide.

**Touch**
- Every tappable thing takes touches across ≥ 44 × 44 pt (T1), ≥ 56 pt in the body where there's room (T3), 72 pt in corners and edge strips (T4). The hit frame lives inside the label or ButtonStyle (T2). Visuals may stay at handoff sizes; hit areas grow.
- Nothing that removes data sits beside a frequent action (T6). A row that does one thing responds anywhere on it (T7).

**Navigation**
- A labelled tab bar is visible on every screen inside a tab (N1, N4). Drill-downs are native pushes with a visible Back and the edge swipe (N5, N6), at most two levels deep (N13).
- Never a sheet on a sheet, never a hierarchy inside a sheet (N14, N15); every sheet, cover and overlay has a labelled way out (N18).
- Anything in the daily loop is two taps or fewer from Today or the Add sheet (N3). Every entry point shows a word (N2). Every gesture also has a visible control (N21).

**Input**
- Onboarding never answers for the user (I5). Fields have visible labels, not placeholders (I16); numbers go through one parser (I20); validation happens on leaving the field, beside it (I21); every keyboard can be put away without Return (I23).
- Reversible actions happen at once with Undo, never "Are you sure?" (I28). Irreversible ones name the item and label the buttons with outcomes (I29).
- Permissions are asked only when the feature starts; a refusal is explained with a way round and a link to Settings, never nagged (I11, I14).

**Visual**
- Text reaches 4.5:1 on its surface (3:1 from 24 pt, or 18.7 pt Bold) in light and dark (V1). Bright green #4CC417 is a fill: green text uses accentText, and labels on green are ink (V3, V4). Nothing is told by colour alone (V9).
- Running text is 16–17 pt; nothing is under 11 pt; no Light or Thin weights (V16, V17, V19). Type and colour come from named tokens only (V11, V22).
- Every tappable thing shows a signifier beyond colour — a fill, border, lift or chevron (V14). Every icon shows a word unless it is on V32's list.

**Feedback & motion**
- A press shows within 100 ms (F1). No main-thread block of 250 ms or more (F3); the first frame within 400 ms of launch (F2).
- Under ~1 s show nothing; 1–10 s the system spinner with words; over 10 s determinate progress (F5–F7). Every wait ends in a named state — found, couldn't check, empty — and unknown is "—" (F8).
- Small feedback ~100 ms, transitions 250–400 ms, nothing over 500 ms, exits faster than entrances (F11–F14). One system haptic per significant completion, never per keystroke (F23, F24).

**Accessibility**
- All text scales with Dynamic Type up to AX5 without truncating, clipping or overlapping; label–value rows stack at accessibility sizes (A1–A3).
- Every control has a VoiceOver name, role and state (A4–A6). Toasts, errors and new results are announced (A10), and a toast is never the only place its information lives (A11). Swipes and drags have accessibility actions (A12). Charts have a text summary (A18). Reduce Motion turns movement into fades (A21).

**Ethics**
- No shaming copy (E7). Choices have symmetric prominence and nothing that benefits Yumo is pre-selected (E5, E6). Nothing consequential changes without a tap that names it (E8).
- The streak survives one missed day in seven (E9). Never celebrate how often someone does something (E12). Notifications only for what the user switched on (E14). No target below the safety floor (E19). Leaving is as easy as joining (E1).

**Process**
- Sid's words, then this book, then the handoff and prototype, then platform defaults (P1). A request that breaks a MUST goes to Sid first, with the number (P2). Departures are written onto the rule as dated exceptions (P3).
- No release changes a day already logged or replaces an unknown with a guess (P26). Before any structural change, list every capability and ship at parity (P21). Nothing is done until the build succeeds (P9). Run the Definition of done before every commit.

---

Contents: The card · How to read a rule · Index by component · Touch & layout (T) · Navigation (N) · Input, forms & permissions (I) · Visual design (V) · Feedback & motion (F) · Accessibility (A) · Ethics & habits (E) · Change & process (P) · Owner decisions · Definition of done · Things we don't say · Open questions for Sid · Changelog

---

## How to read a rule

**IDs.** Area letter plus number: T touch & layout, N navigation, I input, forms & permissions, V visual design, F feedback & motion, A accessibility, E ethics & habits, P change & process. Numbers are stable: never reused, never renumbered. A retired rule keeps its number, marked "retired <date> — why". A new rule takes the next free number in its area, even if that breaks the importance order.

**Levels** follow the strength of the evidence:

| Level | Means | Evidence behind it | To depart from it |
|---|---|---|---|
| MUST / MUST NOT | Required | Controlled experiments whose mechanism carries over to phones (touch accuracy, hidden navigation, signifiers, working memory); login friction, where Google, Microsoft and the FIDO Passkey Index agree at scale (rated high-confidence by the brief); regulator findings and enforcement (FTC, CMA, Massachusetts Securities Division, DSA Article 25); WCAG 2.2 AA as the standard hard rules 6 and 8 adopt; requirements Apple enforces (App Review, the launch watchdog, the one-shot permission prompt); Sid's hard rules and owner decisions, and the process rules that carry them | A dated owner exception on the rule (P3) |
| SHOULD / SHOULD NOT | The default | Company-reported A/B results, Apple HIG and other vendor guidance, expert heuristics (NN/g), practitioner observation, and the thin areas the brief names (animation timing, skeletons, haptics, modal vs push, phones over 6.5″) | A one-line reason in the CHANGELOG entry; a lasting choice becomes an exception |
| MAY | Allowed, not required | Options the evidence permits | Nothing |

An owner decision or a hard rule may raise a level; the Why line then names it ("MUST via decision 14"). Hard rule 8 makes coverage mandatory in v1, not a heuristic's placement: it raises a rule only where the rule is that coverage (device fit T9, OS support P17, the accessibility rules). The accessibility MUSTs (V1–V5, V9, the A rules) rest on WCAG 2.2 AA as the standard hard rules 6 and 8 adopt, not on a law: as the brief describes them, the UK, EU and US regimes don't currently bind a free tracker from a solo developer (open question 60).

Two things are never matters of taste: Fitts's law with its ~1 mm of finger noise (target size and distance), and the ~4-chunk limit of working memory. Rules that rest on them as hard limits (T1, T2, T6, N19) can only be waived by an exception that names the measured cost. T3's 9–10 mm meets the same bar; its SHOULD is provisional until Sid answers open question 1.

**Sid's hard rules** sit above this book (P1): (1) no hard-coded food lists; (2) root cause only; (3) macros computed, never authored; (4) gates stay green and the exit code is never lost; (5) ask when unsure; (6) design tokens only, with contrast enforced by a test in both themes; (7) Sid commits unless he says otherwise; (8) better not done than half-done: full edge cases, accessibility and failure UX in v1; (9) never punitive or shaming copy, and the eating-disorder safeguards are never weakened (E19). Rules cite them as "hard rule N". "The data bar" is Sid's data-quality bar: never a wrong number, unknown shows "—".

**Fields.**
- **Bold line:** the rule, with its ID and level.
- **In Yumo:** what compliance means here: screens, components, tokens, numbers. Text marked "today", "Breaks:", "Meets:" or "Still" describes the app on 23 Oct, like the Status line.
- **Why:** the evidence and its kind (experimental, field data, company-reported, regulator, standard, platform, practitioner, heuristic, owner). "Yumo choice" marks a number that isn't in the brief; "outside the brief, to verify" marks a source the brief doesn't cover.
- **Check:** how to verify it: a grep, a simulator step or a device test.
- **Status:** meets, partly, breaks, unverified, exception (decision N) or n/a, a few words, and the phase that fixes it. "Unverified" counts as breaks (P14), and a rule whose Check has a device step is "meets" only with a dated device record. "n/a" means the thing the rule governs doesn't exist yet (purchases, a backend, Android, an unbuilt feature). Status lines are the 23 Oct snapshot: they seed the first dated check file (P19), which owns status from then on; these lines are refreshed from it at the end of each phase.
- **Exception:** only where an owner decision departs from the rule or limits it (register below).

**Phases** (the audit plan Sid approved, decision 18): 0 correctness (done, decision 17) · 1 shared components (Components.swift and Theme.swift: targets, type, labels, contrast, toasts, motion) · 2 navigation (NavigationStack, tabs, sheets, entry points) · 3 first run & habits (onboarding, permissions, streak, reminders, review; the account step and tour wait for decision 15) · 4 keep it fixed (tests, device passes, checklists, telemetry).

---

## Index by component

Which rules to read before touching a component. The first ID owns the fix; the others refer to it.

| Component or screen | Rules |
|---|---|
| TextAction | T1 (hit area), V3 (colour), V14 (signifier), A25, F1, E5 |
| AddChip, AddCircleButton (the + buttons) | T1, T8, T12, A5, A4, A7, V32 |
| ScanButton | T2, T1, T4, N2, T13, T14, A7, A20 |
| SparkleButton ✦ (Your day entry) | N2 (label), N20 (name), A4, A20, F20, I8, P7 |
| CloseButton, PageHeader back | N18, N6, T4, A4, A20, V23, V32 |
| TabBar | T5, N1, N9, N10, N11, N23, V31, A8, A23 |
| Segmented, StepperButton, ValueStepper | T1, T3, T10, T11, I25, A6, F11, V29 |
| WeekStrip, CalendarPopover | T11, T3, T10, A5, A6, A13, I26, V8 |
| Toaster, ToastView | F29 (form), F28 (timing), F27, F30, A10, A11, I28, T17, N29 |
| PrimaryButton, SecondaryButton | T3, T8, V4, E5, A2 |
| InsetField, NumberField, FieldStyle | I16, I19, I20, I21, I23, T7, A1, A4 |
| SwipeStage, SwipeActionRow, repeat row | N21, A12, N7, N8, T7, F16, F17, F23 |
| RulerView, MacroDragTile | I25, A12, T18, N21, A6, F4, F16, F24, V16 |
| CountUpText, HeroCard | F13, F19, A16, A21, V9, V24 |
| Charts (LineChart, MacroDonut, Ring, Bar, Sparkline) | A18, A19, T18, F13, F19 |
| Sheets and covers | N14, N15, N16, N17, N18, N19 |
| pushCover, PushPage | N5, N4, N6, F17, A13 |
| Tour, TourOverlay | I6, I7, I8, F17, A13, E5, E17 |
| Theme colours | V1–V12, V29, P12 |
| Theme fonts | V16–V22, A1, A24 |
| Motion tokens | F21, F11–F20, A21 |
| Bars, docked buttons, insets | T22, T16, T17 |
| Onboarding | I1, I5, I9, I10, I25, I27, F18, E6 |
| Permissions (scanner, reminders, Health) | I11–I15, E14, E15 |
| Your day (BalanceSheet) | N2, T7, T15, N14, N19, N20, P21 |
| Food page | T6, T15, T16, N15, N29, I20, I30 |
| Settings | N3, N30, N22, T19, E1 |

---

## Touch & layout (T)

**T1 · MUST · Every tappable element takes touches across at least 44 × 44 pt, whatever size it looks.**
- **In Yumo:** Every Button, `onTapGesture` and row. Under 44 pt today: TextAction (~20 pt tall, 23 uses), AddCircleButton 36, ScanButton 36/40, SparkleButton 40, StepperButton 44 × 36, Segmented ≈34, TodayChip/ReviewChip 36, onboarding ‹ 36, staple ✕ and InputRow ✕ 32, Skip tour ≈30, review page dots 6, Your day amount pill 34, servings ▾ 36, PageHeader ‹ ≈36, calendar day 32 × 40, week-strip day 36 wide. Right already: AddChipStyle, CloseButton, CogButton, ArrowButton, InfoButton, toast Undo, calendar ‹ ›. Fix once in Components.swift (TextAction `.padding(.vertical, 12).frame(minHeight: 44).contentShape(Rectangle())`; AddCircleButton ≥ 44; StepperButton 44 × 44). Decisions 5 and 6 set how the servings ▾ and "Switch to cooked?" look, not their hit areas: both get 44 pt.
- **Why:** Finger touches carry ~1 mm of noise that care can't remove: 11–14% errors at 4.8 mm, ~3% at 7.2 mm (Bi, Li and Zhai 2013, experimental). 44 pt is Apple's default size (its stated minimum is 28 pt; no study cited) and WCAG's AAA size (2.5.5); the AA floor is 24 × 24 px, about half the research size (brief ch. 2). At 7.3 mm, 44 pt sits at the ~3% error point, so it is Yumo's absolute floor; the research size is T3.
- **Check:** UI test `performAccessibilityAudit(for: .hitRegion)` on Today, Add, Food page, Your day, Progress, Settings, Staples and onboarding at Large and AX5; Accessibility Inspector frames ≥ 44 × 44.
- **Status:** breaks — about 15 control types hit-test at 20–40 pt · Phase 1.

**T2 · MUST · A control's hit frame lives inside its label or ButtonStyle, never as a frame outside the Button.**
- **In Yumo:** Copy AddChipStyle (Components.swift:293-300) and InfoButton (:777): the visual stays 40 × 34 or 24 pt and the label's `.frame(width: 44, height: 44).contentShape(Rectangle())` takes the touches. A `.frame` after `.buttonStyle(...)` adds layout space but no touches: ScanButton (Components.swift:42-43, hit-tests at 36/40) and the Your day amount pill (BalanceSheet.swift:117, 34). This is how the handoff's small visuals (decision 10) keep their look and still meet T1.
- **Why:** People never tap exactly where they aim, so the whole control must take the touch (Hoober 2017, heuristic); it is what makes T1 real.
- **Check:** `rg -nU -P '\.buttonStyle\(.*\)\s*\.frame\((minWidth|minHeight|width|height)' Yumo/` prints nothing (today: Components.swift:42-43, BalanceSheet.swift:117; the multiline search catches a `.frame` on the next line); Accessibility Inspector shows ScanButton and the pill at 44 × 44.
- **Status:** breaks — ScanButton and the amount pill · Phase 1.

**T3 · SHOULD · Hit areas in the body of the screen reach 9–10 mm physical: at least 56 pt, and 58 pt for targets tapped in a row.**
- **In Yumo:** 1 pt = 0.166 mm on 460-ppi iPhones (17 Pro Max 440 × 956 pt, 16e 390 × 844 pt) and 0.156 mm on the 326-ppi phones iOS 17 still supports (iPhone 11/XR, SE). 56 pt = 9.3 mm (8.7 mm at 326 ppi); serial targets (StepperButton, calendar days, week strip, DayDots, onboarding ±) need 58 pt (9.6 mm); 60 pt keeps every supported phone ≥ 9.3 mm. Meets: PrimaryButton .regular and .hero (56–60), ResultRow/FoodRow ≈60, repeat row 60. Short: PrimarySize.compact and SecondaryButton's default, 50 pt (8.3 mm: "Keep X", "Add as a staple", "Open Settings", "Rescan", "Search instead"; propose compact → 56), SettingsRow 48, AddChip, CloseButton and cog 44, tabs ≈47. Visuals may stay smaller if the hit frame grows (T2).
- **Why:** Thumb errors stop improving at ~9.2–9.6 mm (Parhi, Karlson and Bederson 2006, experimental); the brief says design ~20% above platform minimums. Level provisional pending open question 1: the evidence meets the MUST bar; SHOULD only until Sid decides, because hit areas can grow (T2) while decision 10's visuals stay.
- **Check:** Accessibility Inspector frame × 0.166 (× 0.156 on an iPhone 11/SE simulator) ≥ 9.2 mm, 9.6 mm for steppers and day cells; list every hit area under 56 pt on Today, Add, Food page, Your day, Calorie target and onboarding.
- **Status:** breaks — only regular and hero PrimaryButtons and full-height food rows clear 56 pt · Phase 1.

**T4 · SHOULD · Targets in a screen corner or in the top or bottom strip have a hit area of at least 12 mm (72 pt).**
- **In Yumo:** 72 pt = 11.9 mm at 460 ppi (77 pt for 12 mm at 326 ppi). Where the visual can't grow, grow the hit area toward the corner: CloseButton (44, top-left of sheets), ScanButton (Add sheet top-right), "Edit staples" (Your day top-right), PageHeader ‹ (44 × 72 inside the label), onboarding ‹ 36, CogButton (Progress top-right), TodayChip/ReviewChip/streak slot 36. Keep the 34 pt home-indicator strip clear.
- **Why:** Taps need ~7 mm in the centre but ~12 mm in corners (Hoober 2017, proprietary data, not peer-reviewed); right-handed users rated the top-left and bottom-left corners least comfortable, 3.7 of 7 (Parhi et al. 2006, experimental).
- **Check:** Accessibility Inspector on the Add sheet, Your day, Staples, Food page, Progress and onboarding: each corner control's hit frame ≥ 72 pt in its smaller dimension; on a device, 20 one-thumb taps per corner control, no miss.
- **Status:** breaks — every corner control is 36–44 pt (6–7.3 mm) · Phase 1.
- **Exception:** Decision 10 fixes the tab bar at 49 pt plus the 34 pt home area, so tabs top out at 8.1 mm (T5). Accept unless device tests show missed tab taps; then grow the bar.

**T5 · SHOULD · The bottom bar holds at most four tall items, each filling the full bar height and its share of the width.**
- **In Yumo:** TabBar has 2 items ≈220 pt wide, but the glyph-and-label stack hit-tests at ≈47 pt starting 7 pt down (YumoApp.swift:117,130). Give each tab label `.frame(maxWidth: .infinity, maxHeight: .infinity).contentShape(Rectangle())` so it takes the whole 49 pt. A third tab, if ever, follows the same rule.
- **Why:** Top and bottom strips are the least accurate regions, so they hold few, tall items: at most four on an iOS bar, five on the largest phones (Hoober 2017, proprietary data, heuristic).
- **Check:** Accessibility Inspector: each tab frame is half the bar × 49 pt; on a device, 20 one-thumb taps per tab, including at the bar's top edge.
- **Status:** partly — two items is sparse enough; the hit area is ≈47 pt · Phase 1.
- **Exception:** Decision 10 sets the bar at 49 pt (8.1 mm, under T4's 12 mm). Revisit if device tests show missed tab taps.

**T6 · MUST NOT · A control that deletes or removes data never sits beside, directly under, or on the same line as a frequent action.**
- **In Yumo:** Removals sit at least 32 pt (Yumo choice) below the primary button, in their own card or section, labelled with their outcome, never in an HStack with Log or Rename; reversible ones also get Undo (I28). Breaks: Food page "Remove from Breakfast" 4 pt under Save (FoodDetailScreen.swift); Log weight "Delete this entry" directly under Save (LogWeightSheet.swift:46); Saved meals "Delete" on the same line as "Log to …" and "Rename" (FoodPages.swift:27); the 32 pt staple ✕ on every staple row (StaplesScreen.swift:99). All act at once with no Undo. Fine: Today's two-stage swipe delete, Delete account as the last Settings row behind a named alert, My foods delete behind a confirmation.
- **Why:** The finger-noise floor (a hard limit above): about 3% of taps miss even 7.2 mm targets (Bi, Li and Zhai, experimental), and beside Log a miss deletes data. The 32 pt gap is Yumo's choice.
- **Check:** `grep -rn 'danger: true' Yumo/Screens`: no hit within 32 pt of a PrimaryButton or in an HStack with another action; on a device, tap Log/Save 20 times one-handed and no removal fires.
- **Status:** breaks — four removals sit 4–18 pt from frequent actions and act instantly · Phase 1.

**T7 · SHOULD · A row or card that does one thing responds to a tap anywhere on it.**
- **In Yumo:** Meets: FoodRowView, ResultRow, SettingsRow, diary rows, Progress cards, Your day swap rows. Breaks: Your day staple rows (only the 34 pt amount pill opens the editor), Staples Recent rows (only the +), planner-memory rows (only the Unlike/Allow again word), Create food field rows (a ~23 pt field in a 48 pt row), InsetField (only the number area focuses), ListCard's leading 20 pt (Space.cardPad sits outside the rows), My foods rows (do nothing), the repeat row (no tap).
- **Why:** Whole-row targets absorb tap offset (Hoober, heuristic, from data such as Henze et al.'s 120 million touches); a whole-card target is cards' main benefit (NN/g).
- **Check:** Simulator: tap the leftmost 10 pt and the blank middle of every row on Your day, Staples, Create food, My foods and Settings; each responds.
- **Status:** partly — food, search, Settings and diary rows work; the rest don't · Phase 1.
- **Exception:** Decision 10: the repeat row ("Swipe right to add it again") has no tap by design. Acceptable only with an accessibility action (A12); revisit if TestFlight testers tap it and nothing happens.

**T8 · SHOULD · The action people repeat most gets the largest target on its screen.**
- **In Yumo:** Today's most frequent tap is the meal-card + (AddChip: 44 pt hit area, 7.3 mm, at the card's right edge). Make the whole meal header (60 pt × card width) open Add for that meal, with a press tint. In the Add sheet the row + gets a full-height trailing zone ≥ 52 pt. Right already: PrimaryButton Log, Save and "Log N meals" at 56–60 pt, full width.
- **Why:** Speed keeps improving with width up to ~10 mm (Parhi et al. 2006, experimental); NN/g praises over-sizing the tap that matters most (critique).
- **Check:** Accessibility Inspector on Today: the Breakfast header's tappable frame is ≥ 56 pt tall and spans the card; 20 one-thumb taps on each meal + with no miss.
- **Status:** partly — primary buttons are oversized; the meal + and row + are at or under 44 pt · Phase 1.
- **Exception:** Decision 10 (AddChip is a 40 × 34 chip in the header's right slot): the visual stays, only the hit area grows. Revisit the visual if device tests still show misses.

**T9 · MUST · Every screen fits the smallest supported iPhone with nothing clipped, overflowing or overlapping.**
- **In Yumo:** With the iOS 17 target the smallest is 375 × 667 pt (iPhone SE 2nd/3rd gen); common 6.1″ phones are 390–393 × 844–852 pt; also Display Zoom on the 6.9″. Known break: Calorie target's "2,950 kcal" plus two 44 pt steppers needs ~307 pt at Large and ~331 pt at xLarge against 318–321 pt available on a 390 pt phone (CalorieTargetScreen.swift:28-32). Use ViewThatFits to drop −/+ under the number.
- **Why:** The brief asks for layouts tested on 6.1″ and 6.9″ phones; old reach data describe smaller phones (heuristic). MUST via hard rule 8 (full edge cases in v1): fitting every supported device is that coverage.
- **Check:** Part of the screenshot matrix (P10): every screen on iPhone SE (3rd gen) and iPhone 17e at Large, xLarge and xxxLarge; no clipped text or control, no overlap.
- **Status:** breaks — never captured below 440 pt wide; Calorie target overflows at xLarge on 390 pt · Phase 1.

**T10 · SHOULD · Adjacent targets are at least 8 pt apart (12 pt between lifted buttons), and their hit areas never overlap.**
- **In Yumo:** Bare text and glyph targets (TextAction, ✕, ›) get Apple's ~24 pt clear space, or 44 pt hit areas that touch but don't overlap. Fixes: Calorie target −/+ `HStack(spacing: 8)` → 12; ValueStepper 10 → 12; Your day pill ↔ Done 10 → 12; calendar rows (LazyVGrid spacing 4) become cells that fill each row (T11). Spacing only helps once targets are full size (T1).
- **Why:** Google 8 dp, Apple ~12 pt bezelled and ~24 pt bezel-less, NN/g 2 mm: vendor heuristics; no controlled spacing study exists.
- **Check:** A 3× screenshot (px ÷ 3 = pt) of the Food page Servings row, Calorie target, calendar popover and Your day editor: gaps measured; no two hit frames intersect in Debug View Hierarchy.
- **Status:** partly — Calorie target −/+ is 8 pt; calendar rows 4 pt · Phase 1.

**T11 · SHOULD · In a strip or grid of equal targets, each cell's hit area fills its column and row, so a tap anywhere picks the nearest item.**
- **In Yumo:** WeekStrip: 36 pt cells with ~25 pt of dead Spacer between them; give each day `.frame(maxWidth: .infinity, minHeight: 56)` inside the label. CalendarPopover: a 32 pt label in a ~54–57 pt column, 40 pt tall, rows 4 pt apart; make each cell the full column × ≥ 44 pt. Segmented fills the width but is ≈34 pt tall; pad to 44. DayDots already tiles.
- **Why:** Touch positions are systematically offset (Henze, Rukzio and Boll 2011, 120 million touches, field data); design for tolerance (Hoober, heuristic).
- **Check:** Simulator: tap midway between two week-strip days and two calendar days; each tap selects a day. Adjacent frames touch in Accessibility Inspector.
- **Status:** breaks — the week strip and calendar have dead gaps · Phase 1.

**T12 · SHOULD · A target near an edge lets its hit area run out to that edge, while its visual stays at least one gutter in.**
- **In Yumo:** Visuals sit ≥ Space.gutter (16 pt) from the side edges and above the 34 pt home strip. The meal-card AddChip (`.padding(.trailing, -5)`) leaves ~9 pt dead to the card edge; AddCircleButton leaves Space.cardPad (20 pt) dead to its right. Both take the full trailing strip of their row (48–52 pt × row height). Bottom-docked PrimaryButtons keep their 24 pt bottom inset.
- **Why:** Right-column taps land right of centre and bottom-row taps above it (Parhi et al. 2006, experimental); cases and curved edges swallow edge taps (Hoober, heuristic).
- **Check:** Accessibility Inspector: AddChip and AddCircleButton hit frames reach the card's trailing edge; on a device in a case, 20 taps on each right-edge + with no miss.
- **Status:** partly — gutters respected; row + buttons leave 9–20 pt dead · Phase 1.

**T13 · SHOULD · Each screen's most frequent action sits in the middle band (about 17–83% of the height) or in a sparse bar docked at the bottom.**
- **In Yumo:** The brief says the middle half to two-thirds; 17–83% is the two-thirds bound. Meets: Breakfast + at 54% of a 956 pt screen; "Log N meals", onboarding Continue and Log weight Save docked low; row + in the Add list. Breaks: Scan, the main route for packaged food, is a 40 pt icon in the Add sheet's top-right (its label is N2); the Weight log is reached only by "See all ›", so make the weight card header open it.
- **Why:** One-handed task times were highest for top regions (Karlson and Bederson 2008, experimental); the centre was rated most comfortable, 5.7 of 7 (Parhi et al., experimental).
- **Check:** Screenshots at 440 × 956 and 390 × 844 pt: each screen's primary action y ÷ height is between 0.17 and 0.83, or docked at the bottom.
- **Status:** partly — logging is well placed; Scan is top-right only · Phase 2.

**T14 · SHOULD NOT · Nothing used more than once a session lives only in a top corner.**
- **In Yumo:** Fine in corners: CogButton, the sheet CloseButton (swipe-down also closes), Today's title ▾ (the week strip covers the last 7 days). Breaks: PageHeader ‹ back with no edge swipe on 17 pushCover pages (N6); ScanButton, the only camera entry; "Edit staples", the only route to Staples and "I don't eat". Second routes: the edge swipe, a Scan row under the search field, an "Edit staples ›" row at the end of Your day.
- **Why:** The top is slower to reach one-handed (Karlson and Bederson 2008, experimental); Reachability and Android's one-handed mode concede it (vendor).
- **Check:** List each screen's controls in the top 120 pt and within 100 pt of a side: each is once-a-session or has a route below 17% of the height.
- **Status:** breaks — Back, Scan and Edit staples · Phase 2.

**T15 · SHOULD · Each step's follow-up control (confirm, Done, Log, Undo) sits beside or just below the control that triggers it.**
- **In Yumo:** Meets: the Your day amount pill opens an inline editor with Done beside it; a scan logs with Undo at the bottom; the review's Next has Dismiss under it. Breaks: the Keep/Swap/Never sheet opens at .large with its actions in the top 57% (use a fitted detent with Keep lowest, or an inline unfold, N14); Food page Log sits below Nutrients, two cards from the amount field; the servings confirmationDialog is anchored to the root, not the ▾ (N29); Calorie target Save is at the page bottom, far from −/+.
- **Why:** Movement time grows with log(distance ÷ width) (Fitts; MacKenzie 1992, experimental).
- **Check:** For Add → amount → Log, Your day suggestion → Keep and Calorie target ± → Save, measure trigger-to-follow-up distance on a 3× screenshot; fail any step that needs a regrip in the grip test (P15).
- **Status:** partly — inline editors good; the suggestion sheet and Food page are far · Phase 2.

**T16 · SHOULD · While a field has focus, the field and the action that completes the step stay visible above the keyboard.**
- **In Yumo:** Pin Log/Save with `.safeAreaInset(edge: .bottom)` (T22) and a live label ("Log 250 g") on the Food page, Create food (CreateFoodScreen.swift:35), Log weight (LogWeightSheet.swift:45) and Calorie target; Create food and the Account step scroll the focused field into view. "Log N meals" in Your day is already pinned. This is not a Done bar: the pad still closes on a tap outside or a swipe down (I23).
- **Why:** Keep the field visible while the keyboard is open (NN/g mobile input checklist, heuristic). Google's Send-button result is confounded by size and salience (brief ch. 2; Things we don't say), so it isn't cited.
- **Check:** iPhone SE (3rd gen) and 17e simulators at Large and xxxLarge: focus each field; the field and its button show without scrolling.
- **Status:** partly — Your day is pinned; the Food page Log slides under the pad on shorter phones · Phase 1.
- **Exception:** Decision 3 (no Done or accessory bar) stands: this rule doesn't ask for one.

**T17 · SHOULD · Toasts, the tab bar and pinned buttons never cover the next tap, and scrolling content ends clear of them.**
- **In Yumo:** Toasts float in their own window (decision 9); touches pass through outside the pill, but the pill hides whatever is under it: a meal +, "View summary ›", a docked Log. Lift toasts above pinned bars, or don't fire one over the next action; check with the keyboard up too. How the space is taken is T22.
- **Why:** Safari's iOS 15 beta bottom bar covered page buttons such as checkout; Apple moved it below the page (press report).
- **Check:** Simulator: fire a toast (log, scan, swap) on each screen, with and without the keyboard; its frame doesn't intersect the next button. Scroll Today and Progress to the end: the last item clears the tab bar.
- **Status:** unverified, counts as breaks · Phase 1.

**T18 · SHOULD · A drag control inside a scrolling page claims only its own axis: a vertical swipe that starts on it still scrolls the page.**
- **In Yumo:** SwipeStage's pan already fails on vertical movement. Probably broken: the Progress weight chart (DragGesture, ProgressScreen.swift:238), MacroDragTile on Your plan (Components.swift:685, where a vertical drag changes the value, so start it on press-and-hold), the Log weight RulerView. Move them to a horizontal-only pan or a press-and-hold start.
- **Why:** Custom gestures must never conflict with standard ones (Apple HIG, vendor); conflict with content is the documented cost of custom gestures (heuristic).
- **Check:** On a device, start a vertical swipe on the chart, each macro tile and the ruler: the page scrolls and the value doesn't change.
- **Status:** unverified, counts as breaks · Phase 1.

**T19 · SHOULD · Related items share two agreeing cues, spacing and a container, and nothing sits nearer a group it doesn't belong to.**
- **In Yumo:** A group is a ListCard or `.card()`, separated by Space.cardGap 12 (cardGapDense 10), with rows on hairlines at tighter spacing (rowFood 9, rowSettings 12). Breaks: red Remove/Delete links inside the Log/Save group (T6); "Sign out" sharing a card with the static Username row; Delete account belongs in an Account group.
- **Why:** Proximity and common region add up, and region beats proximity (Wagemans et al. 2012, experimental); Kayak's distant Skip read as unrelated (NN/g critique).
- **Check:** Screenshot review: each card holds one group; gaps between cards are larger than gaps between rows; no destructive or unrelated action inside another action's group.
- **Status:** partly — tokens used consistently; destructive links and Sign out break it · Phase 1.

**T20 · SHOULD · An alternative to the main action (Skip, Later, sign in instead, Dismiss) sits right by it, in the same group.**
- **In Yumo:** Meets: "I already have an account" under Get started; "Clear — I don't know mine" under Continue; "Dismiss for now" under Next in the review; "Skip tour" in the tour bubble. Keep this for any future soft wall's "Later" (I2). Size and contrast of these options are E5.
- **Why:** Kayak's Skip, far from sign-in, made users think sign-in was required (NN/g, critique).
- **Check:** Screenshots of onboarding, tour and review: each alternative is within ~16 pt of its primary, in the same container.
- **Status:** meets.

**T21 · SHOULD NOT · A screen's first view doesn't end exactly on a card edge that looks like the bottom of the page.**
- **In Yumo:** Computed for a 390 × 844 pt phone: Today's Lunch card ends at ≈743 pt and the tab bar starts at 761 pt, so only ~6 pt of Dinner shows through the 0.94-opacity bar, a likely false floor. Fine on the 6.9″. Check Progress and Settings the same way.
- **Why:** Full-width blocks created "false floors" that stopped people scrolling (NN/g Common Region, critique).
- **Check:** Screenshots at load on iPhone 17e and SE: at least 24 pt of the next item shows above the tab bar.
- **Status:** unverified (computed, never captured), counts as breaks · Phase 1.

**T22 · SHOULD · Bars, docked buttons and toasts take their space through the system's safe-area and keyboard insets, never fixed clearance numbers, so content and scroll indicators end where a bar begins on every iPhone.**
- **In Yumo:** Attach TabBar with `.safeAreaInset(edge: .bottom)` instead of the ZStack overlay (YumoApp.swift:88-93), and retire Space.bottomClear 105, bottomClearToday 115 and toastBottom 100 (Theme.swift:115) and the 19 literal `.padding(.bottom, 30/40)` in 12 files. Docked PrimaryButtons use the same inset (T16). Toasts sit a fixed gap above the measured top of the bar or docked button. The bar's background keeps `.ignoresSafeArea(edges: .bottom)`. Today the home-indicator inset (34 pt on Face ID phones, 0 on the SE) is ignored and scroll indicators run under the bar.
- **Why:** Handle insets with the platform API (brief ch. 7: safe-area layout guides; both platforms draw edge-to-edge under translucent bars); fixed clearances drift on phones whose insets differ (heuristic).
- **Check:** `grep -rnE 'bottomClear|toastBottom' Yumo` returns nothing; on iPhone SE and 17 Pro Max, scroll Today and Progress to the end: the last card stops 12–24 pt above the bar on both and the scroll indicator stops at the bar.
- **Status:** partly — clears by over-padding with fixed numbers · Phase 2.
- **Exception:** Decision 10 (handoff rev 10 §4.7: lists end 115 / 105 pt above the screen bottom). Keep that look on Face ID phones; derive it from the inset.

---

## Navigation (N)

**N1 · MUST · Top-level destinations live in a persistent bottom tab bar with a one-word label under every icon; nothing primary sits behind a hamburger, drawer, side menu or More tab.**
- **In Yumo:** The custom TabBar in MainTabs (YumoApp.swift:108-134): "Today" and "Progress" in Font.yumo.tabLabel (Nunito 11/800) under 28 pt glyphs, labelled in both states at every text size. Anything that doesn't earn a tab gets an entry where it is used (N3).
- **Why:** Hidden navigation was used in 57% of mobile tasks against 86% for visible-plus-menu (combo) navigation, and tasks took 15% longer (NN/g, 179 people, experimental); removing labels reduced usability (Google, company research).
- **Check:** Screenshot every screen at xSmall, Large and AX5: both labels visible. `grep -rniE 'hamburger|drawer|sidebar' Yumo` returns 0.
- **Status:** meets (whether the bar stays on pushed pages is N4).

**N2 · MUST · Every control that opens a destination or a main task shows a visible word; an icon may sit beside the word, never in its place.**
- **In Yumo:** The ✦ SparkleButton, the only way into Your day, becomes a labelled chip "✦ Your day", ≥ 44 pt, with an AddChipStyle hit frame. Scan gets a word: a full-width "Scan a barcode" row (glyph + label, ≥ 52 pt) under the Add search field, or a "Scan" pill at the field's end. Disclosures name where they go: Food page "Nutrients ›" and Progress nutrient rows already do; "I don't eat" and planner memory sit 1.5 screens down a page reached only by the 20 pt "Edit staples" corner link. Tabs and "View summary ›" comply. Icon-only allowed: the magnifier and the cog; icons that act in place are V32.
- **Why:** Only home, print and the magnifier are near-universal icons, and an obscure icon went unclicked by every participant (NN/g icon usability, experimental); hiding options without a labelled control is a net loss (NN/g, heuristic).
- **Check:** Screenshot Today, Progress and the Add sheet: every entry shows a word and its VoiceOver name matches it (A20). Five first-time testers find Your day, "I don't eat" and Create a food without help.
- **Status:** breaks — the ✦ and Scan are icon-only; the ✦ is hidden for the whole tour · Phase 2 (the ✦ chip could move to Phase 1, open question 15).
- **Exception:** Decision 10 (handoff rev 6 replaced a labelled row with the ✦; rev 9 added the cog). The evidence is strongest against the ✦: revisit now. The cog may stay icon-only; revisit if testers can't find Settings. While the tour stays, it shows the ✦ entry.

**N3 · MUST · Anything in the daily logging loop is reachable from Today or the Add sheet in two taps or fewer, never only from Settings.**
- **In Yumo:** Saved meals: a "Saved meals" group at the top of the Add sheet, that meal's saved meals first; its + logs into the meal and day whose + opened the sheet, with Undo; search matches saved meals by name. Settings › Saved meals keeps rename and delete only (today it logs, FoodPages.swift:25). Edit staples: a labelled row at the end of Your day as well as the header link. The Add sheet stays scoped to the meal whose + opened it (decision 2).
- **Why:** Hidden navigation was used in 57% of tasks against 86% for visible-plus-menu navigation (NN/g, experimental); Redbooth's gains came from people finding features that already existed (company-reported). The two-tap bound is Yumo's choice.
- **Check:** From Today, log a saved meal in ≤ 2 taps without leaving the Add sheet; `grep -n 'Saved meals' Yumo/Screens/Add/AddFoodSheet.swift` ≥ 1.
- **Status:** breaks — saved meals log only via Progress › cog › Settings · Phase 2.

**N4 · MUST · The tab bar is visible on every screen inside a tab, pushed pages included; only modal tasks may cover it.**
- **In Yumo:** Summary, Food page, Weight log, Maintenance, Nutrients, Settings and every Settings page sit in their tab's NavigationStack with the TabBar above it. Only sheets and the onboarding, barcode scanner and weekly review covers may hide the bar.
- **Why:** MUST via decision 14 ("tab bar stays visible"). Keep the tab bar visible so people know where they are (Apple HIG, vendor); Polar's hidden toggle made engagement collapse (practitioner case).
- **Check:** Open each listed page: the TabBar is in every screenshot; `grep -rn 'pushCover' Yumo` returns 0.
- **Status:** breaks — 17 pushCover sites hide the bar · Phase 2.

**N5 · MUST · Every drill-down inside a tab is a native push on that tab's NavigationStack, never a full-screen modal dressed as a push.**
- **In Yumo:** One NavigationStack(path:) per tab, with navigationDestination for Summary, Food page, Weight log, Maintenance, Nutrients, Supplements, Settings and its pages. Retire pushCover and PushPage (Components.swift:745-769) and Motion.push's fade-and-rise (this supersedes that part of decision 10). fullScreenCover only for onboarding, the barcode scanner and the weekly review. The migration carries a parity list (P21): all 17 sites, their onDismiss reloads (session.changed, tick, gen) and every back label.
- **Why:** MUST via decision 14 (23 Oct, owner); the evidence is platform convention: on iOS the app owns the back stack, with a toolbar Back and an interactive edge swipe since iOS 7, and covers lose both and hide the tab bar. No controlled study compares native and custom navigation (brief ch. 7).
- **Check:** `grep -rnE 'pushCover|PushPage' Yumo` returns 0; `grep -rn 'fullScreenCover' Yumo` finds only onboarding, scanner and review; `grep -rc NavigationStack Yumo` totals ≥ 2.
- **Status:** breaks — 17 pushCover sites, 0 NavigationStacks · Phase 2.

**N6 · MUST · Every pushed screen shows a visible Back at the top leading edge and also goes back on the leading-edge swipe.**
- **In Yumo:** Use NavigationStack's system back, not a custom label. The app-wide `.tint(.yumo.accent)` (YumoApp.swift:17) would paint it at 1.77:1 on bg #EBE2D2, so set the navigation tint to accentText or ink (V3). Never hide the system back without keeping interactivePopGestureRecognizer. Until N5 ships, all 17 pushCover pages and the onboarding steps lack the swipe, and PageHeader's ‹ is ≈36 pt tall and reads "‹ Search" when opened from Add.
- **Why:** MUST via decision 14 (edge-swipe back). Back is usually the most-used button on screen, even in a top corner (Hoober, field observation); gestures supplement, never replace, standard controls (Apple HIG, vendor).
- **Check:** XCUITest on each pushed page: a drag from x = 0.01 to 0.8 of the width returns to the parent; the Back frame ≥ 44 pt; its tint ≥ 4.5:1 on bg.
- **Status:** breaks — no page has the edge swipe · Phase 2.

**N7 · MUST NOT · No app gesture starts from, blocks or repurposes a system gesture: the leading-edge back swipe, a sheet's swipe-down, the home-indicator swipe.**
- **In Yumo:** SwipeStage's DirectionalPan (SwipeStage.swift:187-211) starts on any horizontal movement over a row, and rows begin 16 pt from the edge. On pushed pages (Weight log, Supplements, My foods, Staples) it must fail for touches within ~20 pt of the leading edge, or require interactivePopGestureRecognizer to fail first. The same goes for the Progress chart scrub, RulerView and the review pager. KeyboardDismiss's swipe-down keeps recognising alongside (Components.swift:384), so sheets still close.
- **Why:** MUST NOT via decision 14: the edge swipe it chose has to work everywhere. Don't repurpose familiar gestures (Apple HIG); Sephora's left-edge menu collided with iOS back and went unfound (NN/g critique); conflicting edge swipes reduced trust in Back (Google, company research).
- **Check:** After N5, on Weight log and Supplements, start a rightward drag at x = 2 pt over a row: the page pops and the row stays shut. With the keyboard up in a sheet, swipe-down still dismisses.
- **Status:** unverified, counts as breaks — the conflict appears once N5 lands · Phase 2.

**N8 · MUST NOT · Gestures keep their iOS meaning: a leftward (trailing) swipe is destructive, a rightward (leading) swipe isn't, swipe-down dismisses, the edge swipe goes back.**
- **In Yumo:** Meets: food, weight and supplement rows swipe left to delete; the repeat row swipes right to add again; sheets close on swipe-down; KeyboardDismiss uses swipe-down. Any new gesture follows this map and has a visible control (N21).
- **Why:** Don't repurpose a familiar gesture (Apple HIG, platform); Snap's remapped swipe layout preceded a DAU decline (SEC 10-Q).
- **Check:** `grep -rn 'edge: .leading' Yumo`: every leading SwipeActionRow commits a non-destructive action; on a device, check each sheet's swipe-down.
- **Status:** meets in code; each sheet's swipe-down not yet checked on a device (P14) · Phase 4.

**N9 · SHOULD · The tab bar holds three to five destinations; fewer only while one task clearly dominates and every other destination has a labelled entry where it's used; never more than five.**
- **In Yumo:** Two tabs (Session.Tab .today and .progress, YumoApp.swift:45). That holds only while logging dominates and Saved meals, Staples, Summary and Settings have labelled entries (N2, N3). A sixth destination never becomes a tab.
- **Why:** Material allows three to five, Apple says avoid a More tab, and a lean bar is defensible when one task dominates (Lyft, press report): platform guidance plus a case.
- **Check:** First-click test with 5 new TestFlight testers: each finds Saved meals, Staples, Summary and Settings within 10 s.
- **Status:** partly — two tabs, but saved meals log only from Settings · Phase 2.
- **Exception:** Decision 10 (two tabs, Settings behind a cog); the audit said keep it. Revisit if 2 of 5 testers can't find one of the four within 10 s, or if a third daily destination appears (e.g. Your day opened most days).

**N10 · SHOULD · Tabs only switch destinations; no tab logs, scans, opens a sheet or starts a task.**
- **In Yumo:** TabBar.tab(_:) only sets Session.tab; a re-tap returns Today to today or scrolls to the top (YumoApp.swift:123-126), and pops to root once N5's stacks exist (N23). Never a centre +, Scan or Log tab: logging starts from the meal card's AddChip.
- **Why:** A tab bar is for navigation, not actions (Apple HIG, vendor).
- **Check:** Read TabBar.tab(_:): no .sheet and no log call reachable from a tab tap.
- **Status:** meets.

**N11 · SHOULD · The selected tab shows a filled glyph as well as its colour, and reports itself as selected.**
- **In Yumo:** Selected: CalendarTileGlyph as a filled tile with the day number knocked out in onAccent; ProgressBarsGlyph solid. Unselected: outlines. Add `.accessibilityAddTraits(.isSelected)` to the active tab. The active label (2.21:1 today) and the unselected one (inkMuted, 3.54:1) move to passing colours (V2, V3).
- **Why:** Tab bars mark selection with filled symbols, and meaning is never carried by colour alone (Apple HIG; WCAG 1.4.1, standard).
- **Check:** With the Greyscale colour filter on, the selected tab is still obvious; VoiceOver reads "Today, tab, selected".
- **Status:** breaks — colour only, no selected trait · Phase 1.
- **Exception:** Decision 10 (the handoff drew outline glyphs with selection by colour). Filling the selected glyph keeps both drawings; revisit now, it's one view change. The brief and Apple's SF Symbols guidance fill every tab; Yumo keeps unselected outlines so the fill also marks selection without colour. Revisit with open question 17 (a system TabView would fill every tab).

**N12 · SHOULD · A new user can predict what each tab holds from its label alone.**
- **In Yumo:** "Today" holds the day's log and everything that changes it (Add, Your day, Summary, saved meals); "Progress" holds weight, maintenance, calories and nutrients over time. Settings behind the cog is the only non-progress content allowed under Progress; Staples and Saved meals also get Today-side entries (N3).
- **Why:** Distinct top-level labels mattered most, because a wrong first choice forced backtracking (Larson and Czerwinski, Microsoft Research, experimental).
- **Check:** Before first use, ask 3–5 testers what each tab holds and where they'd log a saved meal: at least 4 of 5 right first time.
- **Status:** partly — Progress also holds Settings, Staples, Saved meals and My foods · Phase 2.

**N13 · SHOULD · No screen sits more than two levels below its tab root.**
- **In Yumo:** Deepest allowed: Today › Summary › Food page or Nutrients; Progress › Settings › any Settings page; Progress › Nutrients › Supplements. Fixes: About you moves out of Calorie target (L3 now) to a row in Settings › Goals; drop the Supplements push from Summary › Nutrients (L3 now) or make it the Add supplement sheet; swap cooked and raw in place on the Food page instead of pushing a sibling. Deeper content comes by search, notifications or deep links (N25).
- **Why:** Performance fell and errors rose with depth (Human Factors International); Larson and Czerwinski found depth hurt, but a moderate breadth–depth mix beat the flattest structure (experimental). Two levels on mobile is NN/g's heuristic.
- **Check:** Walk every path from each tab root (pushes plus pages pushed inside a modal; a task sheet doesn't add a level) and record each depth in the IA map (N26): maximum 2.
- **Status:** breaks — About you and Summary › Nutrients › Supplements are at L3 · Phase 2.

**N14 · SHOULD NOT · Never present a modal on top of another modal: at most one sheet or cover above a tab.**
- **In Yumo:** Today: Your day → Edit staples (cover) → scanner (cover) → Create food (sheet) is four layers; Your day stacks Keep/Swap/Never on itself; Add → Food page → sibling page. Fixes: Keep/Swap/Never as an inline unfold in the row (BalanceSheet.swift:44); the scanner as a mode of the Add sheet, or opening as the sheet closes (AddFoodSheet.swift:52); Create food replaces the Add sheet's content (:53); the weekly review shows maintenance inline (WeeklyReviewScreen.swift:57). Removing stacked sheets is in the Phase 2 scope Sid approved (decision 18).
- **Why:** Never stack modals (Apple HIG, vendor); the costs of modals are argued, not measured (brief ch. 3); more than two disclosure levels usually lose users (NN/g, heuristic).
- **Check:** Grep for .sheet, .fullScreenCover and pushCover inside AddFoodSheet, BalanceSheet, StaplesScreen, WeeklyReviewScreen and CreateFoodScreen: 0 hits. On a device, never two grabbers or covers at once.
- **Status:** breaks — up to four modal layers · Phase 2.

**N15 · SHOULD NOT · A sheet or cover never holds its own navigation hierarchy: no destination with sub-pages inside it, no sibling pushes.**
- **In Yumo:** Your day never opens the full Staples page (with its scanner and Create food) inside itself. The Food page never pushes a cooked or raw sibling labelled "‹ Search" (FoodDetailScreen.swift:98); it swaps in place. Decision 8 (Your day is one screen) is the model. Whether the Add sheet may hold one Food-page level is open question 13.
- **Why:** Never build an app inside a modal (Apple HIG, vendor; argued, not measured, brief ch. 3).
- **Check:** For each sheet and cover, list what is reachable inside it: no screen with sub-pages, at most one detail level.
- **Status:** breaks — Add › Food page › sibling; Your day › Staples › scanner · Phase 2.

**N16 · SHOULD · Browsing within a section is a push; a sheet holds a short task that starts, ends and hands its result back; full-screen covers are for immersive flows only.**
- **In Yumo:** Sheets: Add to <meal>, Your day, Log weight, Add supplement, Create food, Reminder time, How it's worked out, Share. Pushes: Summary, Food page, Weight log, Maintenance, Nutrients, Settings and its pages. Covers: onboarding, scanner, weekly review. Choose a sheet for the task's shape, not for reach.
- **Why:** Present a modal only for a clear benefit and keep it short (Apple HIG Modality, platform); "sheets improve reach" is a myth (NN/g).
- **Check:** Every .sheet, .fullScreenCover and navigationDestination call matches this list.
- **Status:** partly — the Food page opens as a cover over Add; Staples as a cover over Your day · Phase 2.

**N17 · SHOULD · A sheet whose task refers to the screen behind it opens at the medium detent; a large-only sheet restates what it hides.**
- **In Yumo:** [.medium, .large] for Log weight, Add supplement, How it's worked out, Reminder time, and the suggestion sheet if it survives N14. .large only for Add and Your day, and both restate what they cover (Add's header: "Breakfast · 1,240 kcal left", N19). Replace the fixed .height(380) (SettingsScreen.swift:97) and .height(260) (Components.swift:433) detents with .medium or fitted content.
- **Why:** The medium detent keeps the parent visible (Apple HIG, platform).
- **Check:** `grep -rn presentationDetents Yumo`: [.large] only on Add and Your day; screenshots of the other sheets at medium show the parent.
- **Status:** partly — every sheet is .large or a fixed height; none offers .medium · Phase 2.

**N18 · MUST · Every sheet, cover and overlay has a visible, labelled way out; sheets also close on swipe-down; nothing forces a decision.**
- **In Yumo:** SheetHeader's 44 pt CloseButton, labelled "Close" (today VoiceOver reads "multiplication x", A4). Add one to the suggestion sheet (BalanceSheet.swift:135-167), the SourceLine explainer (Components.swift:426-434) and every weekly review page; closing leaves the review pending and the ReviewChip stays. Review page 5 with a proposal offers only Apply or Keep (WeeklyReviewScreen.swift:79-83): add "Decide later", as the stall page already has (line 76). The calendar popover needs more than a backdrop tap (A13).
- **Why:** Always offer an obvious dismissal (Apple HIG, platform); forced action is a named deceptive strategy (Gray et al., taxonomy), and the DSA bans interfaces that "deceive or manipulate" (regulator).
- **Check:** Open every sheet and cover: the ✕ is visible, ≥ 44 pt and read as "Close"; swipe-down closes sheets; with a pending proposal, every review page gets back to Today without changing the target.
- **Status:** breaks — the suggestion sheet, SourceLine and the review have no ✕; page 5 forces a choice · Phase 2.
- **Exception:** Decision 10 (handoff rev 10 gave the review no ✕). Revisit now: a ✕ and "Decide later" leave pages 1–4 looking the same.

**N19 · MUST · Never make people carry more than three items across a screen change; restate the totals, numbers and choices a step depends on.**
- **In Yumo:** Add sheet subtitle "Breakfast · 1,240 kcal left · P 62 g" (the sheet covers the hero); Food page "Day after this: 2,180 / 2,950"; Your day pins the day's totals and shows "120 → 80 g" after a re-solve (PlanRow exists), with swap options sized to the planned amount; review page 5 restates page 4's maintenance figure; a future account ask restates what is saved ("Save your 2,400 kcal plan"). Right already: Pace shows kcal a day, Your plan shows its working, Recent rows show grams, onboarding Back keeps answers.
- **Why:** Working memory holds about four chunks, two to six by person (Cowan 2001, experimental); the limit bites when information crosses screens.
- **Check:** For each sheet or push, list the numbers its decision needs; each is visible on that screen. Review Add, Food page, Your day and review pages 4–5.
- **Status:** partly — Add, the Food page and Your day hide numbers the decision needs · Phase 2.

**N20 · SHOULD · Each destination has one name, used in its entry label, VoiceOver label, screen title, back labels, tour copy and CHANGELOG.**
- **In Yumo:** "Your day" everywhere: SparkleButton's accessibilityLabel still says "I prepped…" (Components.swift:723) and the review says "I prepped… rebalances your staples" (Review.swift:176). With native pushes the back button shows the parent's title, so titles match the entry that opens them ("Calorie target", not "Target"). A rename changes every label in the same build.
- **Why:** People pick by how well a label matches their goal (Larson and Czerwinski, experimental); a VoiceOver user who hears "I prepped…" lands on "Your day".
- **Check:** `grep -rn 'I prepped' Yumo --include='*.swift'` finds no user-facing string; every back label equals its parent's title.
- **Status:** breaks — "I prepped…" vs "Your day"; About you's back says "Target" · Phase 1.

**N21 · MUST · Every gesture that does something important also has a visible control, except where the gesture is the product.**
- **In Yumo:** Repeat a meal (SwipeToAddRow): a row tap or "+ Add again". Remove a supplement: Remove in its edit sheet. Delete one of My foods: a visible Delete on the Food page, not long-press only. Weight ruler and macro tiles: −/+ or tap to type (I25). Weekly review: ‹ Back beside Next. Accessibility actions (A12) are the floor, not the whole fix.
- **Why:** A custom gesture is never the only way to do something important (Apple HIG); a gesture-only action is hidden navigation's cost again (NN/g, experimental, N1); only 3–7% of users ever swiped to open a drawer (Google 2019, company data).
- **Check:** `grep -rnE 'DragGesture|onLongPressGesture|SwipeActionRow|SwipeToAddRow' Yumo`: each hit has a paired Button.
- **Status:** breaks — the repeat row, supplements, My foods, ruler, macro tiles and review pager are gesture-only · Phase 2.
- **Exception:** Decision 10 (the swipe-to-repeat row, ruler and pager) and decision 3 (the keypad closes on a tap outside or a swipe down). Where the look must stay, A12's accessibility action is the minimum; revisit a visible tap on the repeat row if TestFlight shows little repeat use.

**N22 · SHOULD · Back, the edge swipe and swipe-down never silently throw away the user's changes.**
- **In Yumo:** Calorie target and Macros hold edits until Save, so ‹ Settings discards them (CalorieTargetScreen.swift:72, MacrosScreen.swift:41). Prefer applying changes live with an Undo toast, which keeps the native back and swipe. Your day and About you already save as you go.
- **Why:** State must survive accidental loss (Google core app quality, platform); the edge swipe makes going back cheap.
- **Check:** Change the calorie target, swipe back: the change is kept (with Undo) or a Discard prompt appears. Same for Macros.
- **Status:** partly — Calorie target and Macros lose edits · Phase 2.

**N23 · SHOULD · Switching tabs keeps each tab's path, scroll position and view state; re-tapping the active tab pops to root, then scrolls to the top.**
- **In Yumo:** Keep both tab roots alive (a ZStack using opacity, allowsHitTesting and accessibilityHidden, or a system TabView) instead of `switch session.tab` (YumoApp.swift:90). Remove the .id(tick) rebuilds (SettingsScreen.swift:83, Nutrients, Supplements).
- **Why:** A tab bar keeps each section's place (Apple HIG Tab bars, platform).
- **Check:** On Progress, scroll, set 3M and push Maintenance; switch to Today and back: same page, range and scroll. Re-tap Progress: it pops.
- **Status:** breaks — switching rebuilds the other tab; .id(tick) resets Settings · Phase 2.

**N24 · SHOULD NOT · No navigation component reaches across levels: tabs are never nested or paired with swipeable pages, no tab switch or content swipe changes a back stack, switches tab or moves the tab bar, and segmented controls only switch views of one dataset.**
- **In Yumo:** The segmented controls (1W/1M/3M/All, kg/lb, ml/fl oz, Appearance) stay views of one dataset; no top tabs or swipeable pages inside Today or Progress. "Show me around" and "Preview weekly review" may leave Settings because their labels say so.
- **Why:** Tabs are never nested or paired with swipeable content, and swipes on content don't move the bottom bar (Material, vendor); never let a tab switch or a swipe alter the back stack (brief ch. 3).
- **Check:** Push into Settings › Staples, switch to Today and back: still on Staples. Swipe a meal row, the weekly review pager and the Progress chart, on a pushed page and at a tab root: the path, the tab and the bar don't change. No segmented control changes the destination.
- **Status:** meets — re-check once N5 adds pushed pages · Phase 2.

**N25 · SHOULD · Every notification, widget, App Intent or link opens the screen it names, with the back stack rebuilt as if the user had walked there.**
- **In Yumo:** Add a UNUserNotificationCenterDelegate: "weight" opens Progress with today's Log weight sheet; "dinner" opens Today on today with Add to Dinner open. With NavigationStack(path:) per tab, a route sets Session.tab and that tab's path (e.g. [.settings, .staples]) so Back walks the normal stack.
- **Why:** Deep links rebuild the back stack a user would have built by hand, which makes a flat top level workable (Android navigation principles; Apple universal links, platform).
- **Check:** On a device, fire each reminder (or `xcrun simctl push`) and tap it on the Lock Screen: one tap reaches the task's input; Back or ✕ returns to the tab root.
- **Status:** breaks — no notification routing, no onOpenURL, no App Intents · Phase 2.

**N26 · MUST · Every screen has one home in a written IA map (parent, push/sheet/cover, depth), and a new screen enters the map before it is built.**
- **In Yumo:** The map lives in the repo (P4). A home is one canonical parent and depth; every other entry is a link (→), drawn in the map but not a second home, and its depth where it lands still counts for N13. Target after decision 14 — TODAY root: title ▾ (calendar overlay), week strip, hero (✦ Your day), meal cards (+ opens Add; a row opens the Food page), View summary ›. Pushes: Food page (home, L1; → from Summary's diary, L2), Summary (L1). Sheets: Add to <meal> (search, saved meals, scanner, Create food), Your day. PROGRESS root: weight card, Maintenance, Calories, Nutrients, cog. Pushes, L1: Weight log, Maintenance, Nutrients (home; → from Summary, L2, and from Settings), Settings. L2: Supplements (home Nutrients; → from Settings); from Settings: Calorie target, Macros, Staples, Saved meals, My foods, Change password, About you. Sheets: Log weight, How it's worked out, Add supplement, Reminder time, Share. APP LEVEL: onboarding, Sign in, weekly review cover, scanner, tour overlay, toast window.
- **Why:** Breadth, depth and distinct labels decide findability (Larson and Czerwinski, experimental); a dated map turns a regression into a diff (brief checklist).
- **Check:** At each upload, grep every navigationDestination, .sheet, .fullScreenCover and pushCover site and diff it against the map: nothing unmapped, every screen with exactly one home, no depth over 2.
- **Status:** breaks — no written map; 17 covers and stacked sheets don't match the target · Phase 2.

**N27 · SHOULD · Food search has one location and one component, and starting a search never needs a reach to the top.**
- **In Yumo:** Search lives in the Add sheet, focused when it opens, so the meal's + works as the search button. One SearchField (magnifier, "Search foods", a clear ✕, optional Scan) for Add, Staples and My foods, all on FoodIndex; Staples' "Type here…" becomes "Search foods". No second global search box. At accessibility text sizes, don't auto-focus: with the keyboard up only 6 of 15 Recent rows show (about 1.5 at AX5).
- **Why:** Keep one search location, at the bottom on iPhone when it's primary (Apple HIG; iOS 26 Mail and Notes, platform).
- **Check:** Every search TextField is SearchField; the Add sheet opens focused below accessibility sizes.
- **Status:** partly — four search styles, no clear button; Add's auto-focus is right · Phase 1.

**N28 · SHOULD · Long lists are sorted and grouped under labels, end visibly, and keep the way out (create, refine, branded) reachable without scrolling past every item.**
- **In Yumo:** Meets: Add groups Recent / Your foods / Generic / Chains / Scanned products with counts, FoodIndex ranks, a 400-hit ceiling, "Still not here? Create a food" at the end; the weight log groups by month; no infinite scroll, autoplay or loadMore. Breaks: "Show branded" and "Create a food" come after every result (174 for "chicken"); put one quiet line under the field, or after the first 8 results. My foods (~3,200 rows in a non-lazy stack) needs search or sections.
- **Why:** Scanning a list is linear, so order and labels let people narrow it (Liu et al. 2020, CHI review); infinite scroll is wrong for goal-directed finding (NN/g).
- **Check:** Search "chicken" in Add: the branded and create routes show on the first screen with the keyboard up; `grep -rniE 'loadMore|autoplay|AVPlayer' Yumo` returns 0.
- **Status:** partly — grouped and finite; the way out is buried · Phase 2.

**N29 · SHOULD · Use the platform's presentation components: system alerts for critical interruptions, menus and action sheets anchored to the control that raised them, the system share sheet.**
- **In Yumo:** Keep .alert for Delete account and Sign out. Anchor the servings confirmationDialog to the ▾ (it's on the root, FoodDetailScreen.swift:94), or use a Menu that ticks the current unit. Replace the ShareSheet wrapped in a .sheet (SettingsScreen.swift:99) with ShareLink. No floating action button.
- **Why:** Share the decisions, render natively; from iOS 26 action sheets rise from their control (platform).
- **Check:** `grep -rn 'ShareSheet' Yumo` returns 0; on iOS 26 the servings dialog rises from the ▾.
- **Status:** partly — share sheet wrapped; servings dialog anchored to the root · Phase 2.
- **Exception:** Decision 9: one-action toasts in their own window, although iOS has no toast primitive. F27–F30 and A11 set how they behave.

**N30 · SHOULD NOT · Settings never holds a daily task; while it holds only configuration and management, it MAY be reached only through one cog on a tab root.**
- **In Yumo:** CogButton on the Progress root (ProgressScreen.swift:45), 44 pt, accessibilityLabel "Settings". Settings holds goals, units, reminders, data, account, about, and management (rename or delete saved meals, edit staples, My foods). Logging a saved meal moves to Add (N3).
- **Why:** A lean bar with demoted settings is defensible when one task dominates (Lyft and Redbooth cases); Material ruled out a settings tab; a daily task in Settings is hidden navigation (N1).
- **Check:** No Settings row logs food or changes today's diary; the cog is ≥ 44 pt and read as "Settings".
- **Status:** breaks — Settings › Saved meals still logs ("Log to …", FoodPages.swift:25) · Phase 2.

**N31 · MUST · If an Android app is ever built, it honours system Back and predictive back everywhere, keeps a back stack per tab and never draws its own back button.**
- **Why:** Google's core app quality criteria (platform requirement).
- **Status:** n/a — iOS only; P28 lists every Android item.

---

## Input, forms & permissions (I)

**I1 · SHOULD · A new user reaches first value, a plan and a first food on Today, without making an account.**
- **In Yumo:** Today a Cut user goes Welcome → Goal → About you → Weight → Body fat → Activity → Pace → Your plan → Staples → Supplements → Account → Done (12 screens), with a required username, password and confirm password (19+ typed characters) that protect nothing yet: data stays on the phone after sign-out. When decision 15 is revisited: no account field between launch and the first food; flag the step off (e.g. Features.accountInOnboarding = false, code kept), and while it's off hide Sign out, Change password and "I already have an account".
- **Why:** Duolingo's delayed sign-up gave about +20% DAU (company-reported); delay sign-in as long as possible (Apple HIG); login walls annoyed users most (NN/g).
- **Check:** Fresh install, launch to the first food on Today, counting screens and typed characters: no account field on the path.
- **Status:** exception (decision 15) — a required Account step with no skip; revisit when the backend is built.
- **Exception:** Decisions 12 and 15 (Sid: keep the step; raise it again when the backend work starts, not before). Outside the brief, to verify: App Review guideline 5.1.1(v) asks apps without account-based features to work without a login, which could force this at submission (open question 24).

**I2 · SHOULD · When Yumo asks for an account, it is a soft wall: a quiet "Later" right under sign-up that loses nothing; the ask becomes hard only after repeated use, if ever.**
- **In Yumo:** The future "Save your data" card (after the backend): Sign in with Apple / passkey as the PrimaryButton, "Later" as a TextAction within ~16 pt, ≥ 44 pt, in ink, never red or "Discard". Shown after real use (timing is open question 25). "Later" keeps every log on the phone and the card stays away for the rest of the day.
- **Why:** Duolingo replaced a red "Discard my progress" with a quiet "Later"; tuning its walls added 8.2% DAU (company-reported).
- **Check:** Screenshot the card at Large and AX5; tap Later: Today opens with all data intact.
- **Status:** n/a — no backend yet (decisions 12, 15).

**I3 · MUST · A real account offers passkeys and Sign in with Apple, and nudges passkey enrolment at creation and straight after a password sign-in, never only in Settings.**
- **In Yumo:** When the REST backend lands: SignInWithAppleButton plus "Create a passkey" (ASAuthorizationPlatformPublicKeyCredentialProvider, Face ID) at creation; after any password or code sign-in, one card, "Sign in with Face ID next time?"; email codes use one `.oneTimeCode` field. Outside the brief, to verify: App Review 4.8 ties Sign in with Apple to offering other third-party logins.
- **Why:** Passkeys had 63.8% sign-in success against 13.8% for passwords (Google, ~100M users, company-reported); the FIDO Passkey Index gives 93% against 63% across nine operators; about 99% of enrolments came from nudges, under 1% from settings (Microsoft, company-reported). The brief rates login friction high-confidence because these agree.
- **Check:** On a device: create an account, sign out, sign back in with Face ID only.
- **Status:** n/a until the backend — today a local username and salted hash.
- **Exception:** Decisions 12 and 15: the local login is a placeholder; this rule applies in full once the backend is built.

**I4 · MUST · While passwords exist, password fields use the system content types so iOS can save, suggest and fill them, and they are never prefilled.**
- **In Yumo:** Sign in and Current password `.password`; Create account and New password `.newPassword`; Username `.username` (FieldStyle already turns off autocorrect and capitals). Never seed a SecureField. When the backend has a domain, add the webcredentials associated domain; until then iOS can't save the password.
- **Why:** Never prefill a password; get information from the system (Apple HIG); typing a hidden password is slow and error-prone (Palin et al., experimental).
- **Check:** `grep -rn -e 'SecureField(' -e 'textContentType' Yumo`: each SecureField has .password or .newPassword and starts empty.
- **Status:** partly — content types right, nothing prefilled; no associated domain · with the backend.

**I5 · MUST · Onboarding never saves an answer the user didn't give: personal facts start at "—" or come from the system with the user's say-so.**
- **In Yumo:** Phase 0 fixed Goal and Sex (unselected, Continue disabled) and Body fat ("—", "Continue without it"). Still pre-answered (OnboardingFlow.swift:15,18,20): Age 28, Height 180 cm, Weight 80.00 kg and Activity Moderate are saved if Continue is tapped untouched. Show "—" and enable Continue once each is set (typed, stepped or filled from Apple Health, I10); leave Activity unselected. Pace may keep its pre-selected −0.5 / +0.25 kg because each option shows its kcal.
- **Why:** The data bar: unknown shows "—" (an untouched 15% body fat moved targets by up to ≈350 kcal a day). Pre-selection works through default bias (deceptive-pattern taxonomies, brief ch. 9).
- **Check:** Fresh install, tapping only the big button: it stays disabled until each fact is set; no starting value (age = 28, height = 180, kg = 80.0, .moderate) reaches createAccount() untouched.
- **Status:** partly — goal, sex and body fat fixed; age, height, weight and activity still saved untouched · Phase 3.

**I6 · SHOULD NOT · No tutorial carousel or step-by-step guided tour before first use.**
- **In Yumo:** The 9-stop Tour (Tour.stops) starts automatically when onboarding's "Open Today" sets session.startTour (YumoApp.swift:98-100). It explains empty Progress cards and has people close the Add sheet they just opened. When decision 15 is revisited: flag it off (e.g. Features.guidedTour = false, code kept), keep "Show me around" in Settings as an opt-in replay, and teach with first-encounter tips (I8).
- **Why:** Tutorial readers had 91% task success against 94% for skippers (not significant) and rated the tasks harder, 4.92 against 5.49 (NN/g, n = 70, experimental); Vevo removed its tutorial and completed logins rose almost 10% (160,000 people, company-reported).
- **Check:** Fresh install → onboarding → Open Today: no overlay appears; at most 3 overlays before the first log.
- **Status:** exception (decision 15) — the tour starts by itself; revisit when the backend is built.
- **Exception:** Decisions 10 and 15 (Sid: keep the tour; raise it again when the backend work starts, not before). It is interactive, not a carousel, so the NN/g numbers only partly apply. Claude's proposals for that revisit are in open question 26.

**I7 · SHOULD · While any walkthrough ships, it can be skipped at every step and replayed, never blocks input, and never asks people to undo what it just had them do.**
- **In Yumo:** The nine stops stay. Skip tour (TourOverlay.swift:64) gets a ≥ 44 × 44 hit frame and the Got it button's height (E5); its 70% white already passes on panel (8.85 light / 6.73 dark). The finale's 3.4 s touch block (Tour.swift:117) ends on any tap (F17). Stop 4's line "Nothing is logged until you tap Log" is false (the row's + logs at once, Tour.swift:25): correct the line, keep the stop. Keep "Show me around". VoiceOver behaviour is A13.
- **Why:** Onboarding should be "fast, fun, and optional" (Apple HIG); walkthroughs are "dramatically overused" (NN/g, heuristic).
- **Check:** Accessibility Inspector: Skip ≥ 44 pt; tap during the finale: Today responds at once; every stop's copy matches what the app does.
- **Status:** partly — Skip ~30 pt tall; the finale blocks touches for 3.4 s; stop 4's line is false · Phase 3.
- **Exception:** Decision 15 keeps the tour and its nine stops, including stop 4, which has people close the Add sheet they just opened; this rule sets how the tour behaves while it stays.

**I8 · SHOULD · Teach with at most three tips, each shown once, in place, the first time the user meets its feature, one at a time.**
- **In Yumo:** Today: the repeat-row swipe nudge (UserProfile.swipeHintSeen), the Nutrients supplement nudge (suppNudgeAnswered) and the Type it hint (flag off). If the tour is ever replaced, the three are Breakfast +, the ✦ Your day entry, and Maintenance the first time it reads "Estimate", each with its own `…Seen` flag.
- **Why:** A set of context-specific tips beats one onboarding flow (Apple HIG, platform guidance).
- **Check:** `grep -n -e 'HintSeen' -e 'nudge' Yumo/Domain/Models.swift`: ≤ 3 tips; fresh install, use each feature twice: each tip shows once, never two together.
- **Status:** meets for tips; check that several supplement nudges can't show at once.
- **Exception:** Decision 15 keeps the tour, whose nine stops exceed three overlays (I6); the tip budget applies to everything else.

**I9 · SHOULD · Before first value, ask only what that value needs; questions about features the user hasn't met move to when they meet them.**
- **In Yumo:** Your plan needs goal, sex, age, height, weight, activity and pace (body fat optional). The Staples and Supplements steps (OnboardingFlow .staples, .supplements) ask about features not seen yet, and the staples entered don't even show in the first Add sheet. Move staples to Your day's first open and supplements to the existing Nutrients nudge, behind flags.
- **Why:** Median retention is 26% on day 1, 13% on day 7 and 7% on day 30, with most loss between day 0 and day 1 (Adjust benchmark).
- **Check:** Fresh install: each onboarding question feeds a number on Your plan.
- **Status:** breaks — Staples and Supplements steps come before Today · Phase 3.
- **Exception:** Decision 10 (onboarding order from the handoff). Revisit when onboarding reopens for the backend work.

**I10 · SHOULD · Fill in from the system what the user allows instead of asking them to type, and seed the first session with what Apple Health already knows.**
- **In Yumo:** About you and Weight: a quiet "Fill from Apple Health" (date of birth, sex, height, latest body mass) with its own permission ask at that tap; the user confirms the values, marked "from Apple Health". Import weight history so Progress shows a trend on day 1. HealthSync.readLatestWeight exists (Services.swift:84) but nothing calls it.
- **Why:** Get information from the system (Apple HIG); Threads' one-tap import removed the empty first session, 100M sign-ups in five days (company-reported; sign-ups, not retention).
- **Check:** Simulator with Health sample data: onboarding offers the fill; `grep -rn 'readLatestWeight(' Yumo` finds a call site.
- **Status:** breaks — nothing filled; the Health read is requested but unused · Phase 3.

**I11 · MUST · Each permission is asked for only when the user starts the feature that needs it: never at launch, never in onboarding unless that feature is used there.**
- **In Yumo:** Camera on the first ScanButton tap (Add, Staples); notifications when a reminder is switched on (better still, offered once after the first weigh-in: "Remind me at 7:30?"); Apple Health from its Settings row or a "Fill from Apple Health" tap; PhotosPicker needs none. Reminders.reschedule() at launch calls requestAuthorization only when a reminder is already on; reading getNotificationSettings there would make that explicit.
- **Why:** MUST on platform mechanics: iOS shows each system prompt once, so an ask before intent spends it for good. Ask only when clearly needed, never at launch (Apple HIG). The timing numbers (AppsFlyer, opt-in 45% after engagement against 36% before; Cluster) are field and company data the brief rates moderate.
- **Check:** `grep -rn -e 'requestAccess' -e 'requestAuthorization' Yumo`: each call is reachable only from a user tap; fresh install with privacy reset: no system alert before the first scan, reminder or Health tap.
- **Status:** meets.

**I12 · SHOULD · Before a permission's first system prompt, a one-card explanation says what it is for.**
- **In Yumo:** One shared PermissionPrimer: a title, one sentence and a PrimaryButton "Continue"; the screen's ✕ still backs out. Shown only when authorizationStatus is .notDetermined: in the scanner before AVCaptureDevice.requestAccess (today in ScannerVC.viewDidLoad, BarcodeScanner.swift:17), before the first reminder switch-on, before the Health sheet.
- **Why:** In one app (Cluster, 2014) push acceptance rose from under 40% to 66% after an explanation screen (company-reported); Apple allows a one-button pre-alert screen (HIG).
- **Check:** `xcrun simctl privacy booted reset all <bundle id>`, then scan, switch a reminder on, open Health: the primer comes first, then the system alert.
- **Status:** breaks — system prompts appear directly · Phase 3.

**I13 · SHOULD · A pre-permission screen has exactly one button, labelled Continue or Next, and never imitates, annotates or rewards the system alert.**
- **In Yumo:** PermissionPrimer is a sand card in Yumo's own look with "Continue": no "Allow", no "Not now", no incentive copy.
- **Why:** Apple HIG Privacy: one button that opens the system alert, labelled Continue or Next, never Allow (vendor). App Review rejects incentivised, imitated or annotated tracking (ATT) prompts (platform requirement; Yumo has none).
- **Check:** Screenshot each primer: one button, "Continue"; grep its strings for "Allow".
- **Status:** n/a — no primers until I12 builds them · Phase 3.

**I14 · MUST · After a denial, never ask again or nag: when the feature is tried again, say plainly it's off, offer another way and link to Settings, and keep switches honest.**
- **In Yumo:** Phase 0: CameraDeniedCard ("Yumo can't use the camera" + Open Settings + "Search instead") in Add and Staples; a refused reminder switch flips back off with a Settings toast and the note "Notifications are off for Yumo, so reminders can't arrive."; the Health toast says what Yumo can really write. Status is re-read when the app becomes active.
- **Why:** iOS shows each system prompt once, so a "no" is nearly permanent (platform mechanics). The Settings link is iOS practice, outside the brief; Android's guidance is not to link to settings to reverse a decision, so Yumo shows the link only when the user retries the feature, never as a prompt.
- **Check:** Deny camera, notifications and Health, then reopen each feature: an explanation, another way and a Settings link; the switch is off; no new alert. Grant in Settings and return: it works without a relaunch. The camera card on a device.
- **Status:** meets in code; the camera-denied card not yet seen on a device (P14) · Phase 4.

**I15 · MUST · Ask only for data Yumo uses, and make each purpose string describe exactly that use.**
- **In Yumo:** project.yml:36-39 and Info.plist: NSCameraUsageDescription → "Yumo uses the camera to scan food barcodes." (progress photos come from PhotosPicker); remove NSPhotoLibraryUsageDescription; HealthSync.types() asks to read bodyMass but nothing reads it, so drop the read type and NSHealthShareUsageDescription, or ship the import (I10).
- **Why:** The purpose string is the only text Yumo controls on the system alert (Apple HIG Privacy); consent got by misdescription isn't consent (FTC, DSA, regulator).
- **Check:** Every usage key and Health type has a live call site (`grep -rn -e 'AVCaptureDevice' -e 'PhotosPicker' -e 'HKQuantityType' Yumo`), and each string describes only that use.
- **Status:** breaks — the camera string over-claims; unused photo key; Health read never used · Phase 3.

**I16 · MUST NOT · A field never relies on its placeholder as its only label: every field has a visible label that stays while typing, above free-text fields.**
- **In Yumo:** Account, Sign in and Change password: a 15 pt ink label above each FieldStyle field, with hints such as "8 or more characters" under it. The Nutrients target alert hides "Target" and "Upper limit" behind prefilled fields: replace it with a small sheet of labelled InsetFields. Staples "Type here…" gets a label and a magnifier (N27). Allowed: a single search field with the magnifier ("Search foods"); numeric list rows (Create food, Food page Amount) keep the iOS label-left layout because the label stays (open question 30).
- **Why:** Placeholders vanish when typing and filled-looking fields get skipped (NN/g); visible labels are WCAG 2.2 AA 3.3.2 (standard).
- **Check:** `grep -rn -e 'TextField(' -e 'SecureField(' Yumo`: each has a visible label above it or in its row; VoiceOver names every field.
- **Status:** breaks — account, sign-in, change-password, Nutrients alert and Staples fields · Phase 1.

**I17 · SHOULD · Forms mark both the required and the optional fields.**
- **In Yumo:** Create food: Name, Serving size, kcal, Protein, Carbs and Fat under "Needed to save"; Brand, Barcode, Fibre, Sugar, Salt and Saturated fat under "Optional" (today Brand and Barcode sit unmarked beside Name). Optional onboarding steps keep "Optional" in the subtitle and a button that names the skip.
- **Why:** 32% of people missed a required field when only the optional ones were marked (Baymard, large benchmark).
- **Check:** Screenshot Create food: every input sits under "Needed" or "Optional"; filling only the required ones enables Save.
- **Status:** partly — only the micronutrients are marked · Phase 3.

**I18 · SHOULD · Ask for the fewest fields that do the job; rarely used fields sit behind one labelled disclosure.**
- **In Yumo:** Create food has 13 inputs: keep the 7 required visible (name and barcode come prefilled from the search or scan); Brand and Barcode can sit under "More details ›"; the optional micronutrients stay visible but marked (the data bar wants micronutrients on everything; open question 32). Any name field is one full-name field.
- **Why:** The average checkout has 11.3 fields where about eight would do, and 17% abandoned for length (Baymard).
- **Check:** Count each form's inputs; each maps to a stored property some screen reads.
- **Status:** partly — Create food shows all 13 · Phase 3.

**I19 · SHOULD · Every field sets the keyboard and content type that match what it takes.**
- **In Yumo:** Amounts and nutrients `.decimalPad` (NumberField, InsetField, Create food); barcodes and years `.numberPad`; username `.username`; passwords `.password` / `.newPassword`; search `.submitLabel(.search)` with autocorrect off; food names with autocorrect off.
- **Why:** 61% of mobile sites use the wrong keyboard somewhere (Baymard, prevalence); use the keyboard that matches the content (Apple HIG, vendor).
- **Check:** `grep -rn -e 'TextField(' -e 'NumberField(' Yumo`: each has a keyboardType or textContentType; focus every field in the simulator.
- **Status:** meets.

**I20 · MUST · Every number goes through one locale-aware parser that accepts "," and "."; an empty, zero or unreadable value blocks the action with a reason and never falls back to an older value.**
- **In Yumo:** One shared parser (e.g. Num.parse) for FoodDetailScreen's gramsText (today `Double(gramsText)`), CreateFoodScreen (`Double(kcal)` etc.), the Nutrients alert, BalanceSheet, Staples and Supplements (the last three already swap ","). Food page: Log disabled with "Type an amount" when the field is empty or 0; today it logs the previous amount, and "12,5" silently logs the old one.
- **Why:** The data bar and hard rule 2: never a wrong number, fix the root cause; a silent failure gives the user nothing to fix (NN/g).
- **Check:** Region set to Germany: "12,5" is accepted in Food page Amount, Create food kcal and a Nutrients target; an empty Amount disables Log with a reason; `grep -rn -e 'Double(gramsText)' -e 'Double(kcal)' -e 'Double(rdaText)' Yumo` finds nothing outside the parser.
- **Status:** breaks — commas ignored on three screens; an empty amount logs the old one · Phase 1.

**I21 · SHOULD · Validate when the user leaves a field or submits, not while they type; the message sits under that field, stays until fixed, and uses colour, an icon and text.**
- **In Yumo:** One FieldMessage: SF Symbol exclamationmark.circle.fill plus text in the danger text colour (V5). Account: nothing before typing, per-field messages after leaving the field; the new-password length rule may show live (a hard field). Sign in: "Wrong username or password." with the icon, under the password field. Create food stops failing silently. A field that errors three times for one tester gets redesigned.
- **Why:** Inline validation gave 22% more success and 42% faster completion, and validating after the field beat validating while typing (Etre, 22 people, indicative).
- **Check:** Enter a bad value and move on: a message with an icon appears under that field and is still there after scrolling.
- **Status:** breaks — one muted hint before typing; the sign-in error has no icon and is 4.05:1 · Phase 1.

**I22 · SHOULD · A disabled primary button says, right next to it, what's missing.**
- **In Yumo:** Create food: "Add kcal, protein, carbs and fat to save". Change password: "Current password doesn't match" / "New passwords don't match". Your plan when macros aren't 100%: "Macros add up to 103% of 2,950 — lower one to continue" (or let carbs fill the rest, as Settings › Macros does). Goal and About you: "Choose one to continue". Your day's "Nothing to log" already does it.
- **Why:** Enable the button only once the required data is present (Apple HIG); never leave an error unstated (NN/g).
- **Check:** Screenshot each disabled state: a line within ~16 pt of the button names what's missing.
- **Status:** breaks — Create food, Change password and Your plan go pale with no reason · Phase 1.

**I23 · MUST · Every keyboard, number and decimal pads included, can be put away without a Return key, and VoiceOver, Switch Control and Voice Control users have a way that needs no gesture.**
- **In Yumo:** KeyboardDismiss (Components.swift:351): a tap outside or a swipe down dismisses any field, app-wide since Phase 0, and tapping Log with the pad up still logs. Add accessibilityPerformEscape (two-finger scrub) to NumberField's text field and `.accessibilityAction(.escape)` to SwiftUI fields; check KeyboardDismiss's window tap still fires when VoiceOver double-taps another control. Scroll views keep `.scrollDismissesKeyboard(.interactively)`.
- **Why:** The number pad has no Return key, so it needs a toolbar Done or tap-outside dismissal (Apple HIG; brief ch. 7); gesture-only paths exclude switch users (brief ch. 8). MUST via hard rule 8 (accessibility and failure UX in v1).
- **Check:** Focus each numeric field and tap blank space: the pad hides; with the pad up, one tap on Log logs. On a device with VoiceOver, the scrub hides the pad; with Switch Control, Log is reachable.
- **Status:** partly — tap and swipe work; no escape for assistive tech · Phase 1.
- **Exception:** Decision 3 (no Done bar). The brief's body accepts a toolbar Done or a tap outside (ch. 7); its What to do asks for a Done accessory, so decision 3 departs from that recommendation, not from a requirement. The rule is met once the escape works. Revisit only if a VoiceOver or Switch Control pass can't dismiss the pad; then show a Done bar only while they run (open question 62).

**I24 · SHOULD · Replace typing with choices wherever possible: recent items, remembered amounts, scanning, steppers, pickers, system autofill.**
- **In Yumo:** Keep: Add opens on Recent; the row's + logs the last amount (quickAmount); a recognised barcode logs itself with Undo; the amount field selects all on focus; servings step in halves; Create food comes prefilled from the search or scan; Log weight starts at the last weight; fuzzy search absorbs typos.
- **Why:** Phone typing averages 36 WPM with 2.3% uncorrected errors (Palin et al., n = 37,370, experimental), so every ten characters costs ~3 s.
- **Check:** On a device, time five common logs (a Recent food, yesterday's breakfast, a packet scan, a saved meal, a staple): zero characters typed.
- **Status:** meets in code; the five timed logs not yet run on a device (P14) · Phase 4.
- **Exception:** Decision 5 (grams first): the Food page leads with typed grams. It fits because the remembered amount is preset and selected on focus. Revisit if TestFlight shows most logs are typed rather than added with +.

**I25 · SHOULD · Big jumps are typed on the right keypad; small adjustments use steppers or the ruler; steppers repeat while held.**
- **In Yumo:** Onboarding Age, Height and Weight and the Log weight ruler: tap the big value to type it (number or decimal pad; a tap outside dismisses). ValueStepper repeats while held. Add kg/lb to the onboarding weight page. The ruler stays for daily ±0.1 kg changes.
- **Why:** At ~36 WPM, typing two digits beats 37 stepper taps (Palin et al., experimental).
- **Check:** Fresh install: set age 45, height 160 cm and weight 62 kg by typing; count taps before and after the change.
- **Status:** breaks — ±1 steppers from 28 and 180 (37 taps for 45 years); weight is ruler-only from 80 kg · Phase 3.

**I26 · SHOULD · Dates within about a year use a calendar; birthdays are typed; no day/month/year drop-downs, no date wheels.**
- **In Yumo:** Today's CalendarPopover pages 12 months back (Phase 0). Log weight: the date label opens the same calendar, keeping ‹ › for ±1 day (today two weeks back takes 14 taps). Birth year is typed (I27). Reminder times may keep the system wheel.
- **Why:** A calendar for dates within about a year, typing for birthdays, no split day/month/year drop-downs (NN/g, heuristic). One 277-person study found a drop-down fastest (6.31 s) and a wheel slowest (13.25 s, least comfortable), though its authors say their wheel may have been poorly built (Romikaitytė et al. 2022).
- **Check:** Log weight reaches three weeks back in ≤ 3 taps; `grep -rn 'datePickerStyle(.wheel)' Yumo` finds only time pickers.
- **Status:** partly — Log weight steps a day at a time; age is a stepper · Phase 3.

**I27 · MUST · Store the birth year, never the age.**
- **In Yumo:** UserProfile stores birthYear and works out age for BMR and the DRI targets; onboarding asks "Year you were born" (4 digits, .numberPad); Settings › About you edits the same field; existing profiles migrate with birthYear = current year − age.
- **Why:** The data bar: a stored age never goes up, so the Mifflin-St Jeor BMR drifts 5 kcal a day per year.
- **Check:** `grep -n 'var age' Yumo/Domain/Models.swift` is replaced by birthYear; move the simulator clock a year on: age goes up by 1 and the target changes.
- **Status:** breaks — age stored as a number that never changes · Phase 3.

**I28 · SHOULD · A reversible action happens at once and offers Undo; it never asks "Are you sure?".**
- **In Yumo:** Through `Toaster.show(…, action: "Undo")`, keeping a snapshot or soft delete until the toast ends: Today's swipe-delete, "Remove from Breakfast", "Delete this entry" (weight, photo included), saved-meal Delete, the staple ✕, the supplement swipe, Nutrients "Reset to defaults", + logs from search, Food page Log, "Log N meals", repeat meal, logging a saved meal, Keep and Never in Your day. My foods delete keeps its confirmation for now (open question 5). Sign out is reversible: drop its destructive styling. Toast timing is F28; its accessibility A11.
- **Why:** Frequent warnings train people to ignore them (NN/g); Gmail's Undo Send holds 5 s (company).
- **Check:** `grep -rn 'toaster.show(' Yumo`: every removal or log passes action "Undo"; each Undo restores exactly (entry, amount, meal, order, photo).
- **Status:** partly — only the scan auto-log and swap carry an action · Phase 1.

**I29 · SHOULD · Confirm only serious, irreversible actions: the title names the item, the message says what happens, the buttons name outcomes, never Yes, No or OK.**
- **In Yumo:** The model is Delete account, the one irreversible action: "Delete account and data?", a message that says what goes and what stays, and "Delete account and data" / "Keep account" (today "Delete" / "Cancel"; and "All your data is deleted", SettingsScreen.swift:100, over-claims while samples Yumo wrote to Apple Health stay, open question 34). My foods' confirmation ("Delete Chicken pie?" / "Days you logged it keep their numbers." / "Delete food" / "Keep it") already has this form.
- **Why:** Keep confirmations for irreversible consequences and name the item and result (NN/g, heuristic).
- **Check:** `grep -rn -e '.alert(' -e 'confirmationDialog(' Yumo`: each destructive dialog names the item and has verb-plus-object buttons.
- **Status:** partly — Delete account uses Delete / Cancel and over-claims · Phase 3.

**I30 · MUST · Every button and consent message states its real outcome: what happens, where it goes and for how long.**
- **In Yumo:** Keep: "Save 120.70 kg", "Log 4 meals", "Apply 2,150" / "Keep 2,300", "Keep X" with "It becomes a staple…". Fix: Food page "Log" → "Log to Breakfast" (plus the day if not today); Create food's "Save food" also logs when opened from Add → "Save and log to Breakfast"; the supplement nudge's "Not now" means never (NutrientsScreens.swift:88, Models.swift:71) → "Don't ask again", or really ask later; tour stop 4's "Nothing is logged until you tap Log" is false (Tour.swift:25, I7).
- **Why:** A trick question raised acceptance from 19.2% to 33.4% (Luguri and Strahilevitz, experimental); label buttons with outcomes (NN/g).
- **Check:** For each Button and .alert, compare the label and message with the code path; a tester predicts the result before tapping.
- **Status:** partly — Log doesn't name the meal; "Not now" means never; tour copy false · Phase 1.

**I31 · SHOULD · An empty area offers the next step as a button.**
- **In Yumo:** An empty day's Summary shows five "Nothing logged" blocks with nothing to tap → one card with "Add breakfast". Saved meals, My foods and the Weight log get a button in their empty states. Loading and lookup states are F8.
- **Why:** Say whether it's loading, failed or empty, and offer a direct next action (NN/g Empty States, heuristic).
- **Check:** Summary on an empty day: one card with a button; each empty list has a button.
- **Status:** breaks — the empty Summary and lists are text only · Phase 1.

---

## Visual design (V)

**V1 · MUST · Text reaches 4.5:1 against the surface it sits on, or 3:1 at WCAG's large size (24 pt, or 18.7 pt at Bold and heavier), in light and dark; light mode is checked first.**
- **In Yumo:** Every text token on every surface in both appearances: bg #EBE2D2 / #1A1917, surface #FFFBF3 / #2B2926, control #E2D8C5 / #3A3733, track #EFE7D8, accentTint #E9F5DF / #2E4A24, dangerTint #FBE9EA / #4A2326, panel #1F1C17 / #3A3733, and the green fill. Passing: ink everywhere (8.49–16.45), white on panel (16.98 / 11.84), white on dangerFill (5.20). The failing roles are V2–V5. Large text counts too: the 64 pt Calorie target hero in green on sand is 1.77:1. Apple HIG's looser split (4.5:1 up to 17 pt, 3:1 above), which the brief repeats, would let displayMuted (20 pt SemiBold) pass at 3:1; WCAG doesn't (V2). Light is the weaker theme today, and no pair may pass in dark while failing in light.
- **Why:** WCAG 2.2 AA 1.4.3 (standard), which hard rules 6 and 8 adopt; light mode won on legibility for normally sighted readers (NN/g review).
- **Check:** The contrast test (P12) passes; Accessibility Inspector's contrast audit on Today, Food page, Your day, Progress and Settings in both appearances.
- **Status:** breaks — in light, almost everything but ink fails · Phase 1.

**V2 · MUST · The muted text role (inkMuted) passes 4.5:1 on every surface it is used on.**
- **In Yumo:** Light #8C8578 is 2.85 on bg, 3.54 on surface, 2.59 on control, 2.98 on track, 3.24 on accentTint → ≈ #655E52 (4.99 / 6.21 / 4.54 / 5.22 / 5.67). Dark #A39D92 is 4.39 on control and 3.67 on accentTint → #C2BCB1 (6.27 / 5.24), or #CCC7BD for 7:1 (V6). Hierarchy then comes from size and weight. Used in ~180 text runs: Overline, unselected Segmented, SettingsRow sub-lines, ChevronValue, StreakPill, InsetField units and placeholders, the unselected tab label, and displayMuted (20/600, under WCAG's large size) at 9 sites, e.g. the hero's "/ 2,950" (TodayScreen.swift:196) and units beside big numbers (ProgressScreen.swift:155, OnboardingFlow.swift:128).
- **Why:** Low-contrast grey is the commonest self-inflicted failure: it strains reading, looks disabled and washes out in glare (NN/g critique); WCAG 1.4.3 (standard).
- **Check:** P12: inkMuted ≥ 4.5 on bg, surface, control, track and accentTint in both appearances; retake Today with four meals logged and Settings, light and dark.
- **Status:** breaks — light 2.59–3.54; dark 3.67–4.39 on control and tint · Phase 1.
- **Exception:** Decision 10: the handoff's ink-muted #8C8578, which ds3 README:27 says to keep exact and raise as a decision. Not yet decided: open question 35. Until Sid picks a value, P12 lists these pairs as failing with this note (P2).

**V3 · MUST · The bright green #4CC417 is a fill; green text and thin green glyphs use a separate accentText token that passes.**
- **In Yumo:** As text, #4CC417 is 1.77 on bg, 2.21 on surface and 2.02 on accentTint in light. accentText light ≈ #2A6C0D: 5.03 / 6.26 / 5.72, and 4.57 on control. In dark #4CC417 passes on bg (7.71) and surface (6.36) but not on accentTint (4.34, used by Tag) → ≥ #55C723, or #8FDA6E for 7:1. It covers TextAction, the back button tint (N6), Tag, AskFooter, PlanRow's new amount, "All N ›", the calendar's "Today", the active tab label, the 64 pt Calorie target hero, the hero's hit-target colour, and glyphs on tint (barcode, AddCircle +, ✦). Fills stay #4CC417: PrimaryButton, AddChip, bars, rings, week-strip circles.
- **Why:** WCAG 1.4.3 (standard); the handoff's own README (ds3 README:27) flagged green text at 2.0:1 as a decision to raise.
- **Check:** `grep -rnE 'foregroundStyle\((Color)?\.yumo\.accent\)' Yumo`: every remaining hit is a fill or a glyph at ≥ 3:1; P12 covers the accentText pairs.
- **Status:** breaks — green text at 1.77–2.21:1 · Phase 1.
- **Exception:** Decision 10 keeps #4CC417 and the sand palette; this rule keeps both, as fills. Button labels are settled (V4); whether links use accentText or ink plus › is open question 36.

**V4 · MUST · Labels and glyphs on the green fill are ink #1F1C17 in both appearances.**
- **In Yumo:** Decision 13 (23 Oct). onAccent = #1F1C17 in light and dark: 7.45:1 on #4CC417, where white is 2.28. Never bind it to `ink`, which is #F2EDE3 in dark (1.95:1). Route every hard-coded .white on green through onAccent: the tour's Got it / Next label (TourOverlay.swift:67, 14/900, a button label under decision 13), the Scan barcode tile (AddFoodSheet.swift:66, Type it mode), CalendarPopover's selected day (Components.swift:624), WeekStrip's TickGlyph (:545), CheckCircle (:265), the onboarding ✓ tile (OnboardingFlow.swift:240) and LogWeightSheet's checkmark.circle.fill (:37). The "y" marks (OnboardingFlow.swift:88, TourOverlay.swift:99; YumoMark at Components.swift:583 already uses onAccent) are a logo, exempt from contrast under WCAG 1.4.3; ink there is Claude's proposal. The disabled PrimaryButton needs its own label colour: ink on accentSoft is 13.18:1 in light (it would look stronger than the enabled button) and 2.31:1 in dark (open question 39).
- **Why:** White on the green is 2.28:1, under 4.5:1 for text and 3:1 for glyphs (WCAG 1.4.3, 1.4.11, standard), and Lc −49 (APCA); ink is 7.45:1 and Lc 57, so both metrics prefer ink.
- **Check:** Theme.swift onAccent = Color(light: 0x1F1C17, dark: 0x1F1C17); `grep -rnF '.white' Yumo` finds none on a green fill except the logo marks; dark screenshot of the Food page Log and the week strip.
- **Status:** breaks — decided, not built: onAccent is still #FFFFFF (Theme.swift:29) · Phase 1.

**V5 · MUST · Destructive, error and over-limit text passes 4.5:1 on every surface it sits on.**
- **In Yumo:** Light danger #C8353F is 4.05 on bg, 5.04 on surface, 4.45 on dangerTint → ≈ #B43039 (4.77 / 5.94 / 5.24). Dark #E05A62 is 4.01 on surface and 3.72 on dangerTint → ≈ #E88389 (6.73 on bg, 5.55, 5.15, and 4.53 on control). dangerFill with white (5.20) stays for swipe-delete. Danger text: Delete account, "Never suggest", the over-goal hero number and bar, over-limit nutrient names, MacroDragTile below its floor, FieldMessage (I21).
- **Why:** WCAG 1.4.3 (standard); ratios computed from the Theme.swift hex values.
- **Check:** P12: danger ≥ 4.5 on bg, surface and dangerTint in both appearances.
- **Status:** breaks — 4.05 on sand in light; 4.01 and 3.72 in dark · Phase 1.

**V6 · SHOULD · In dark mode, custom-coloured text at 17 pt and below aims for 7:1.**
- **In Yumo:** Dark ink (8.49–15.06) meets it. Misses: inkMuted 3.67–6.52, green text 4.34–7.71 (only bg passes), danger 3.72–4.86, the toast's Undo (green on panel, 5.19). Targets: inkMuted #CCC7BD (10.43 / 8.61, 7.03 on control); accentText #8FDA6E (8.58 on surface, 7.00 on control and panel, 5.86 on tint), which also fixes Undo. Danger can't reach 7:1 and stay red: keep it ≥ 4.5 and always pair it with a word (V9).
- **Why:** Apple asks 7:1 for custom colours in Dark Mode, especially small text (platform); small text suffered most on dark backgrounds (NN/g review).
- **Check:** P12 asserts ≥ 7.0 for inkMuted and accentText on bg, surface and control in dark; retake Today, Progress and Settings in dark.
- **Status:** breaks — inkMuted, green and danger text under 7:1 on raised dark surfaces · Phase 1.

**V7 · SHOULD · WCAG 2 is the gate and APCA is checked alongside it; a pair that passes WCAG but falls under APCA's level gets a second look.**
- **In Yumo:** P12 records Lc for each pair against APCA's Bronze levels (outside the brief): Lc 75 body text, 60 other content text, 45 large or bold headings and detailed icons, 30 minimum for any text, 15 non-text. Today dark inkMuted passes WCAG on bg and surface (6.52 / 5.38) but is only Lc −48 / −46, too weak for 12–13 pt captions; dark danger is Lc −34 to −38; on the green, ink is Lc 57 and white Lc −49. The proposed light inkMuted #655E52 sits at Lc 60–80.
- **Why:** APCA says WCAG 2 overstates contrast for dark colours, but it is a public beta and not in the WCAG 3 draft (W3C); passing WCAG and checking APCA is the hedge (heuristic).
- **Check:** The test warns when a pair is under the Bronze level for that style's size and weight.
- **Status:** partly — computed once for this book, not yet repeatable · Phase 1.

**V8 · SHOULD · Marks that carry meaning or show a control's edge reach 3:1 against what's next to them, or carry a second cue.**
- **In Yumo:** Today: the week strip's empty ring (surfaceEdge on bg) 1.26 light / 1.10 dark; ExpandChevron and MacroDragTile ▲▼ (grabber on surface) 1.77; StatusDot warning on surface 2.58; green glyphs on accentTint 2.02; the active tab glyph 2.21; the dark selected segment against its track 1.23; Ring and Bar tracks against the card ≈1.19; the Your day amount pill 1.19 against its card. Targets: rings and chevrons in the new inkMuted (6.21 on surface) or at least #857E6F light / #78746C dark; warning in light ≈ #A37B26 (3.75 on surface); glyphs on tint in accentText.
- **Why:** Grey-on-grey icons vanish when people scan (NN/g); weak borders are a disclosed defect even at Starling (company statement); WCAG 1.4.11 asks 3:1 for non-text (standard).
- **Check:** P12 covers grabber, surfaceEdge, warning and accent against bg, surface and accentTint at ≥ 3.0; Greyscale and Increase Contrast screenshots of Today and Summary.
- **Status:** breaks — rings 1.10–1.26, chevrons 1.77, the warning dot 2.58 · Phase 1.

**V9 · MUST NOT · No information is carried by colour alone: every colour-coded state also has a word, symbol, shape or position.**
- **In Yumo:** Fails: the Summary nutrients card (dot and bar colour explained by an "Amber = …" footnote, SummaryScreen.swift:74–102); StatusDot with no label; review page 2 marking hit and miss days by shade; the hero turning red over goal with no word, and the hit state as a green number only (TodayScreen.swift:195–199) → "over by 120"; tab selection (N11); Delete account marked only by red. Fixes: "low", "over" or "on target" after values; a tick on hit days; a shape under `accessibilityDifferentiateWithoutColor`. Right already: the week strip's fill plus tick, PlanRow's strikethrough plus →, Progress nutrient words.
- **Why:** About 1 in 12 men have red-green colour deficiency (MedlinePlus); WCAG 1.4.1 (standard).
- **Check:** Greyscale colour filter, then Differentiate Without Colour: every state on Today, Summary, Progress and the weekly review stays readable.
- **Status:** partly — six colour-only states · Phase 1.

**V10 · SHOULD NOT · Two states are never told apart only by a red–green or blue–orange pair, and each colour means one thing on every screen.**
- **In Yumo:** Summary amber #C9962A against green #4CC417 is ≈1.05:1 for deuteranopes. Weight change is green when down and red when up, whatever the goal: colour it by direction toward the goal, never in danger red (open question 45). Protein is green in onboarding but near-black on Summary: one macro colour map in Theme (StackedBar already uses accent / ink / inkMuted). Roles: warning only for the low-status mark, danger for destructive or over-limit, accent for adding and positive fills.
- **Why:** Red-green deficiency affects about 8% of Northern European men (MedlinePlus); avoid red–green and blue–orange pairs (Apple HIG).
- **Check:** Color Filters set to Deuteranopia and Protanopia: Summary and Progress states stay distinct; one macro mapping across screens.
- **Status:** breaks — amber against green; weight in red and green; macro colours vary · Phase 1.
- **Exception:** Decision 10: the handoff colours weight deltas accent when down and danger when up (ds3 README:24). Not yet decided: open question 45; until then a Bulk user's gain shows in danger red.

**V11 · SHOULD · Colours come from named roles defined once (light, dark, Increase Contrast); screens never use raw hex, .white, .black or opacity-made greys for text or meaning.**
- **In Yumo:** Color.yumo is the role set (ink, inkMuted, accentText, onAccent, danger, warning, panel, bg, surface, control…); Theme.swift's "never a system colour" (decision 10) fits, because Yumo's own tokens are the semantic layer. Raw .white on green moves to onAccent (V4); text on the dark panel (tour bubble, chart tooltip) gets an onPanel role; overlays on the live camera (StaplesScreen.swift:157,161; AddFoodSheet.swift:94,98,103; CornerBrackets :414; TorchIcon :446) get an onCamera role.
- **Why:** Role-based colour survives Dark Mode and Increase Contrast (Apple HIG Color; case studies); hard rule 6: tokens only.
- **Check:** `grep -rnE '\.white\b|Color\.black|Color\(hex|Color\(red|\.gray' Yumo` outside Theme.swift returns only named exceptions.
- **Status:** partly — 21 raw .white lines outside Theme.swift: 7 on green fills, 2 logo marks, 7 camera overlays, 5 on the dark panel · Phase 1.

**V12 · SHOULD · Every colour role has an Increase Contrast variant, on top of defaults that already pass.**
- **In Yumo:** Extend Color(light:dark:) (Theme.swift:46) to Color(light:dark:lightHC:darkHC:), resolved when accessibilityContrast is .high; give variants to at least inkMuted, accentText, danger, hairline, surfaceEdge, track, control, grabber and insetEdge, aiming for ≥ 7:1 on text and ≥ 4.5:1 on marks. Read `colorSchemeContrast` to thicken the InsetField edge, WeekStrip rings and OptionTile ring. Never park the passing values here while the defaults fail.
- **Why:** Every iOS system colour has one (yellow darkens from 255,204,0 to 161,106,0), and Apple asks the same of custom colours (platform).
- **Check:** `grep -rnE 'accessibilityContrast|colorSchemeContrast' Yumo` ≥ 1; with Increase Contrast on, Today and Settings visibly change.
- **Status:** breaks — light and dark only · Phase 1.

**V13 · SHOULD NOT · Don't dim text to make a busy screen look calm, and don't draw enabled, tappable text in muted grey: remove content instead.**
- **In Yumo:** SourceLine (13 pt inkMuted, Components.swift:425) can be tapped but looks disabled → ink or accentText plus the (i). Unpinned pins in inkMuted are fine because the glyph changes too. Where a card feels busy (the type line on Your day rows, descriptors on the Food page), cut the line rather than greying it.
- **Why:** Dimming signals "disabled" and hurts discoverability (NN/g Low-Contrast Text, critique).
- **Check:** No Button label is inkMuted unless it's a secondary value inside a whole-row button or an exception below.
- **Status:** partly — SourceLine; the servings unit is an exception (decision 5) · Phase 1.
- **Exception:** Decision 5: the Food page's servings unit stays muted text plus a ▾ (FoodDetailScreen.swift:73), because a boxed chip read like a field you could type into; the ▾ is the signifier (V14) and the text must still pass V2. Revisit if testers miss the unit picker (proposed).

**V14 · MUST · Every tappable element shows a signifier beyond colour: a fill, border, lift or chevron.**
- **In Yumo:** Meets: PrimaryButton, SecondaryButton, AddChip, ScanButton, CogButton and the chips (lifted fills), SettingsRow with ›, AskFooter's ›. Breaks: TextAction is bare green text (Components.swift:31-34; 23 uses including "Save as meal", "Edit staples", "Switch to cooked?"; its size is T1, its colour V3) → a trailing › when it navigates, an accentTint capsule (Radius.chip) when it acts in place. The Maintenance card and reminder rows open things with no ›. SourceLine gets the (i). Sign out looks like the static Username row → a SecondaryButton in a final section with Delete account. The Your day amount pill (fill at 1.19:1) gets the InsetField edge and a ▾.
- **Why:** Weak-signifier pages took ~22% longer on findability tasks across nine web pages and drew ~25% more fixations (NN/g, 71 people, eye-tracking, experimental; the brief rates signifiers high-confidence); colour alone can't mark a control (WCAG 1.4.1, standard).
- **Check:** Greyscale screenshot of each screen: point at everything tappable; each has a shape cue. Repeat with Button Shapes on (A25).
- **Status:** partly — TextAction, SourceLine, Maintenance card, reminder rows, Sign out, amount pill · Phase 1.
- **Exception:** Decision 10 (TextAction as bare green text came from the handoff): the look changes only by a › or a capsule. Decisions 5 and 6 stand: the servings picker stays muted text plus a ▾, drawn in accentText at ≥ 3:1; "Switch to cooked?" stays a sentence link, and Claude proposes accentText with an underline (the Button Shapes form), since a capsule would make it the chip decision 6 rejected and a › means it navigates (N15 swaps in place). Needs Sid's yes.

**V15 · SHOULD · The press edge (Yumo's solid bottom lift) appears only on things that can be pressed.**
- **In Yumo:** LiftButtonStyle drops the edge on press, but `.card()` and `.listCard()` lift every static card (68 call sites), and StreakPill is lifted beside the pressable TodayChip and ReviewChip (Components.swift:559-564), so they all read as buttons. Option: static cards get a 1 pt surfaceEdge stroke and StreakPill goes flat.
- **Why:** Shadow and lift fail as signifiers when used as decoration (NN/g flat-design guidance, heuristic).
- **Check:** `grep -rnE '\.card\(|listCard\(|lifted\(' Yumo`: every lifted element is a Button; testers don't tap static cards.
- **Status:** breaks — static cards and the streak pill are lifted · Phase 1.
- **Exception:** Decision 10 (lifted cards from handoff rev 2–11). Revisit if testers tap static cards or the pill, or when the card style next changes (open question 41).

**V16 · MUST · Nothing is smaller than 11 pt at the default size, and no style drops below 11 pt at the smallest standard size.**
- **In Yumo:** The smallest tokens are axis and tabLabel (11/800). Breaks: CalendarTileGlyph's day number at 10.5 pt (Components.swift:236) and MacroDragTile's ▲▼ at 9 pt (:683; use −/+ or hide it). All tokens scale on Body's curve, so 11–12 pt styles fall to ~9 pt at xSmall; mapping axis and tabLabel to .caption2, which holds 11 pt, fixes it (A1). Nunito's x-height is 4.7% under SF Pro's, so use 12 pt for anything longer than a one-word label.
- **Why:** Apple's minimum is 11 pt (Caption 2); reading slows below a critical print size (Legge and Bigelow review, vision science).
- **Check:** `grep -rnF '.nunito(10' Yumo`, `grep -rnF '.nunito(9' Yumo` and `grep -rnE 'size: *(7|8|9|10)[,)]' Yumo` return nothing; screenshot Today, Progress and the tab bar at xSmall.
- **Status:** partly — 10.5 and 9 pt glyphs; ~9 pt text at xSmall · Phase 1.

**V17 · SHOULD · Running text and row titles are 16–17 pt with iOS line spacing.**
- **In Yumo:** Font.yumo.body (Nunito 17 SemiBold), bodyStrong (17 Bold) and title (17 ExtraBold); Nunito's metrics give 1.364 em (17 pt on 23.2). No Material-style 1.5 leading: .lineSpacing stays ≤ 5 pt, on short paragraphs only.
- **Why:** Apple's Body is 17 on 22 and Material's 16 on 24; both platforms converge on 16–17 (vendor).
- **Check:** `grep -n 'static let body' Yumo/Theme/Theme.swift` shows nunito(17, .semibold); `grep -rn 'lineSpacing(' Yumo` shows nothing over 5.
- **Status:** meets.

**V18 · SHOULD · Text people must read to act (instructions, explanations, errors, hints) is at least 15 pt in ink; 11–13 pt muted text is for metadata only.**
- **In Yumo:** Move to subtitle (15/700) or body in ink, or cut: "Tap an amount to set what you're having…" (BalanceSheet.swift:61, a muted footnote), the Maintenance formula explainers (ProgressScreen.swift:90, MaintenanceScreen.swift:19,42), Summary's "Amber = under 70 %…" (SummaryScreen.swift:102), the weekly review's detail paragraphs. SourceLine text, units and "from setup" stay as captions.
- **Why:** Small, low-contrast text strains reading and looks disabled (NN/g Low-Contrast Text, critique). 15 pt is Yumo's choice (not in the brief), given Nunito's x-height is ~5% under SF Pro's.
- **Check:** `grep -rnE 'yumo\.(caption|footnote|detail)' Yumo | grep inkMuted`; review each hit: is it a sentence telling the user what to do?
- **Status:** breaks — ~180 text runs at ≤ 13 pt, instructions among them · Phase 1.

**V19 · SHOULD NOT · Never use Ultralight, Thin or Light weights; small text in dark mode stays SemiBold or heavier.**
- **In Yumo:** YumoWeight allows Medium (500) to Black (900); captions are 13/700 and 13/600. Nunito-Variable.ttf's default instance is ExtraLight (wght 200), so always go through Font.nunito(_:_:), never `.custom("Nunito", …)` by family name, which renders at 200.
- **Why:** Avoid Ultralight, Thin and Light with custom fonts; thin strokes vanish on dark (Apple HIG; Material, vendor).
- **Check:** `grep -rnE 'ultraLight|\.thin|weight: *\.light|Nunito-(Extra)?Light' Yumo` and `grep -rnF 'custom("Nunito"' Yumo` return nothing.
- **Status:** meets.

**V20 · SHOULD · A custom typeface is used only if its x-height is within about 5% of SF Pro's; measure any new face first.**
- **In Yumo:** Nunito passes: OS/2 xHeight 0.484 em against SF Pro's 0.508 em (−4.7%), same cap height (0.705 em), so Nunito at 17 pt reads like SF Pro at ~16.2 pt. A second face (e.g. hero numerals) must ship Medium or heavier and pass the same check.
- **Why:** x-height, not point size, decides legibility; it ranges from 0.28 to 0.58 of body size across 1,049 faces (Legge and Bigelow 2011). The brief asks for a "comparable" x-height; 5% is Yumo's choice.
- **Check:** fontTools: sxHeight ÷ unitsPerEm for Nunito-Variable.ttf ≥ 0.48.
- **Status:** meets.

**V21 · SHOULD · Negative letter spacing only at display sizes (about 20 pt up); 13 pt and below get zero or positive tracking.**
- **In Yumo:** Nunito has no optical sizing, so Yumo does by hand what SF Pro does itself. Right: hero −2.5 at 72 pt, plan −2 at 64, display −0.4 at 34, overline +0.7 at 12. Breaks: CalendarTileGlyph −0.3 at 10.5 pt (Components.swift:236) and YumoMark's "y" −0.5 at 15 pt (:583).
- **Why:** SF Pro loosens small text and tightens display text automatically (Apple HIG Typography).
- **Check:** `grep -rnF 'kerning(-' Yumo`: every hit's font is ≥ 20 pt.
- **Status:** partly — two small glyphs · Phase 1.

**V22 · SHOULD · The type hierarchy lives in a small set of named text roles defined once; screens never set raw sizes or weights.**
- **In Yumo:** Fold the 128 lines (148 calls, 38 size–weight pairs) of inline `.nunito(` outside Theme.swift, Components.swift included, into 10–12 Font.yumo roles in Theme.swift, each with its text style (A1). A CI grep fails on `.nunito(` or `.system(size:` (7 today) outside Theme.swift.
- **Why:** Systems that define hierarchy once (Apple Mail, Airbnb, Spotify Encore) survive Dynamic Type, Dark Mode and Increase Contrast (case studies, heuristic).
- **Check:** `grep -rnF '.nunito(' Yumo | grep -v 'Yumo/Theme/Theme.swift' | wc -l` is 0, and the same for `.system(size:`.
- **Status:** breaks — 128 lines of inline fonts · Phase 1.

**V23 · SHOULD · Icons share one size, weight and perspective, matched to the text beside them; standard actions use SF Symbols.**
- **In Yumo:** Today ✕ and + are Text glyphs, › is Text("›"), barcode, torch, magnifier, tick and arrow are drawn paths, and the SF Symbols in use come in four weights (gearshape .semibold, arrow.counterclockwise and checkmark .heavy, pin .bold, the onboarding checkmark .black). Move standard actions to SF Symbols at .heavy, the closest match to Nunito ExtraBold: xmark, plus, chevron.right, checkmark, barcode.viewfinder, flashlight.off.fill / on.fill, info.circle, gearshape, pin / pin.fill. Keep the brand glyphs (CalendarTileGlyph, ProgressBarsGlyph, SparkleGlyph) drawn and scaled (A7).
- **Why:** Consistent icon size, weight and perspective, matched to the text (Apple HIG); SF Symbols fix consistency, not meaning (V32).
- **Check:** `grep -rnF 'Image(systemName' Yumo` shows one weight; no Text("✕"), Text("+") or Text("›") used as an action in Components.swift.
- **Status:** partly — drawn, text and four-weight SF glyphs mixed · Phase 1.
- **Exception:** Decision 10 (drawn glyphs from the handoff, whose README allows SF Symbols where the stroke matches). Decide glyph by glyph (open question 42).

**V24 · SHOULD · The first two or three words of every row, heading, option and button carry its meaning.**
- **In Yumo:** Food names lead every food row. Fixes: the repeat row leads with "Swipe right to add it again" (Components.swift:656) → "Yesterday's breakfast" with the gesture hint after; onboarding's "Cut" and "Bulk" → "Lose fat", "Maintain", "Build muscle", with Cut and Bulk in the subtitles; the hero number has no unit → "/ 2,950 kcal"; on food rows the macros come before descriptors such as "raw".
- **Why:** People read the top and left edge of unformatted text (NN/g F-pattern, eye-tracking); the brief infers this narrows to an "I" on phones, the first words of each row carrying the meaning (inference, not measured).
- **Check:** Read each screen's rows by their first three words only: every row is still identifiable.
- **Status:** partly — the repeat row, goal names, the hero's unit · Phase 1.

**V25 · SHOULD · Trailing values people need (kcal, grams, nutrient amounts) are bold and in ink.**
- **In Yumo:** Food-row kcal 15–16/800 in ink, Summary values 14/800 in ink, hero stats 20/800. A muted target ("/ 41") only after an ink value. New row components (AskOption, PlanRow, SwipeHintRow, search rows) follow suit.
- **Why:** Trailing values are skipped unless weighted or coloured (the brief's inference from the F-pattern).
- **Check:** Review the row components: the trailing value is .extrabold or heavier, in ink.
- **Status:** meets.

**V26 · SHOULD · Explanations of numbers lead with the answer, stay short, and agree with the data beside them.**
- **In Yumo:** SourceLine explainers, InfoButton sheets, the Maintenance formula, the weekly review pages and Your plan: the first sentence states the number and what it means, then at most one short paragraph; formula names (Katch-McArdle, Mifflin) go behind the (i). "Maintenance · measured" beside a "Formula" chip contradicts itself (audit fix 30).
- **Why:** Hard content slowed reading by ~30 ms a word (NN/g replication, 276 people).
- **Check:** Each explainer's first sentence contains its number; each caption matches the state it describes.
- **Status:** partly — the Maintenance label contradicts its chip · Phase 1.

**V27 · SHOULD · Lists for uniform items, cards only for mixed content.**
- **In Yumo:** ListCard holds foods, settings, the diary and search results; cards hold the hero and the Progress dashboard. A new list of foods, staples, supplements or meals is a ListCard of rows, never a grid of tiles.
- **Why:** Cards scan worse and are poor for comparison; Google's playlist move from a list to album art lowered usability (NN/g; company-reported).
- **Check:** Any ForEach over one model type renders rows in one ListCard.
- **Status:** meets.

**V28 · SHOULD · Follow the system appearance, with no app-level dark-mode toggle.**
- **In Yumo:** The default is System (@AppStorage "yumo.appearance" = "system"), and since Phase 0 the choice applies to every window, toast and tour included (YumoApp.swift:25–29). Settings › About › Appearance still offers System, Light and Dark (SettingsScreen.swift:71).
- **Why:** People think of dark mode at the OS level (NN/g, 115-user survey); Apple and Material say mirror the OS (vendor; no measured harm).
- **Check:** With Yumo on System, switch the system appearance: main, toast and tour windows follow within a second.
- **Status:** partly — follows the OS by default; the toggle exists · Phase 1.
- **Exception:** Decision 10 (Appearance arrived with handoff rev 9, 18 Oct), not re-decided since the audit (verdict: revisit, open question 44). If it stays: default System, every window obeys, it lives in Settings › About and is never prompted.

**V29 · SHOULD · Dark surfaces are dark grey, never black, and every raised or selected layer is lighter than the one under it.**
- **In Yumo:** Right: bg #1A1917 < surface #2B2926 < control and panel #3A3733, plus the 1 pt liftHighlight. Breaks: Segmented's selected thumb is surface #2B2926 on a #3A3733 track, darker than its track, so it reads as pressed in → ≈ #57524A (1.53:1 against the track; ink on it 6.64:1). Food photos don't apply (decision 4).
- **Why:** Shadows vanish on dark, so elevation comes from lighter surfaces (Apple HIG Dark Mode; Material, vendor).
- **Check:** P12: in dark, luminance of bg < surface < control, and the selected segment is lighter than its track; a dark screenshot of Progress with its range control.
- **Status:** partly — the dark selected segment · Phase 1.

**V30 · SHOULD NOT · Glass and blur materials stay in the navigation layer (tab bar, title and navigation bars, at most the one primary action), never in content and never glass on glass.**
- **In Yumo:** `.ultraThinMaterial` sits only behind TabBar (YumoApp.swift:119) and Today's collapsed title bar (TodayScreen.swift:89); sheets are opaque bg; there is no glassEffect anywhere; cards, toasts, the tour bubble and the calendar popover are opaque. If the Clear variant ever sits over bright content, add the 35% dimming layer.
- **Why:** Don't use Liquid Glass in the content layer, never glass on glass (Apple HIG Materials, WWDC25, vendor); beta legibility complaints led to a Tinted option.
- **Check:** `grep -rnE 'Material|glassEffect' Yumo` returns only TabBar and the Today title bar.
- **Status:** meets.

**V31 · SHOULD · System bars draw their own material; never paint custom backgrounds under them.**
- **In Yumo:** With decision 14, iOS 26 navigation bars draw as glass beside the custom sand TabBar: no `.toolbarBackground` repaint to match the sand; sand and Nunito stay in the content. The custom TabBar (surface at 0.94 over .ultraThinMaterial) goes opaque under Reduce Transparency (A23). Try a system TabView with Yumo's glyphs before Xcode 27 makes glass mandatory.
- **Why:** Liquid Glass adapts to Reduce Transparency and Increase Contrast only in system components (WWDC25; Apple, Adopting Liquid Glass).
- **Check:** Reduce Transparency and Increase Contrast on: tab bar and navigation bars opaque and legible; `grep -rn toolbarBackground Yumo`.
- **Status:** unverified, counts as breaks — NavigationStack not built · Phase 2.
- **Exception:** Decision 10 (the custom two-tab bar). Revisit when the NavigationStack migration lands or Xcode 27 ships (open question 17).

**V32 · SHOULD · Every icon shows a visible word, unless it is on this rule's approved list; a new icon-only control needs Sid's sign-off onto the list (P5).**
- **In Yumo:** N2 covers entries and main tasks; this rule covers icons that act in place. Approved: the magnifier in a search field and the cog (N2, N30). Proposed, waiting for Sid (open question 42): the sheet ✕ and system Back (Apple HIG asks for the standard Back and Close without text), the AddChip + beside a meal name, −/+ on steppers. Need a word or a decision: the scanner torch ("Torch"), the Nutrients pin ("Pin"), the InfoButton (i), AddCircleButton + on result rows, the calendar and day ‹ › arrows, the staple and InputRow ✕ ("Remove"). Every icon, approved or not, also has its spoken label (A4).
- **Why:** Only home, print and the magnifying glass are close to universal; everything else needs a visible label (NN/g Icon Usability, brief ch. 5); removing labels reduced usability (Google, company research); SF Symbols fix consistency, not meaning (V23).
- **Check:** Screenshot Today, Add, Food page, Your day, Staples, Nutrients, Progress, Log weight and the scanner; list every glyph with no word inside its hit frame; each is on the approved list.
- **Status:** breaks — torch, pin, (i), row +, ‹ › and the staple ✕ are icon-only with no decision · Phase 1.

---

## Feedback & motion (F)

**F1 · SHOULD · Every tap shows a pressed state on touch-down within 100 ms and acts on touch-up inside; sliding off cancels.**
- **In Yumo:** The allowed press styles are LiftButtonStyle (Motion.press 120 ms), AddChipStyle, RowPressStyle (color.pressed, Motion.pressIn 100 / pressOut 200 ms) and FadePressStyle (opacity 0.6). PlainPressStyle (Theme.swift:188, "no visual change", 60 uses: CloseButton, TextAction, ArrowButton, PageHeader back, TabBar, Segmented, WeekStrip, calendar days, InfoButton, toast Undo) becomes Fade for text and glyphs and RowPress for rows. The 16 bare `.onTapGesture` rows (ResultRow, Settings "Fill with test data"…) become Buttons. RowPressStyle's tint is only 1.12:1 against surface in light, so confirm on a device that it shows. DragGesture(minimumDistance: 0) only for chart scrubbing.
- **Why:** Delays under 100 ms are rarely noticed and a few hundred ms feel unresponsive (Apple, Understanding hangs); highlight on touch-down, act on touch-up (Apple WWDC18 803, platform).
- **Check:** `grep -c 'PlainPressStyle()'` across Yumo is 0; film ✕, a TextAction, a tab and a row at 240 fps: the first visible change comes within 24 frames of contact.
- **Status:** partly — lifted buttons and food rows react; 60 buttons and 16 tap rows show nothing · Phase 1.

**F2 · SHOULD · A cold launch shows the first real frame within 400 ms on the oldest supported iPhone, and nothing that grows with the user's data runs before it.**
- **In Yumo:** With the iOS 17 target, measure on an iPhone XS or XR (A12 chip) or an SE 2. Target: RootView.task (YumoApp.swift:61-79) does only constant-time work before ready = true, and the launch screen stays the LaunchBackground sand. Today: SeedFoods.seed (OpenFoodFacts.swift:127) calls store.foods().isEmpty before ready, fetching ~7,330 rows (68–76 ms on an M5 Mac, probably 3–4× that on an A12-chip phone) → fetchCount with fetchLimit 1; store.backfillLastAmounts() runs right after in the same main-actor task with no await → after a yield or off the main thread.
- **Why:** Apple's goal is a first frame within 400 ms, and the watchdog kills slow launches (platform), as in Yumo's 21 Oct black screen.
- **Check:** Instruments App Launch on the oldest supported iPhone: median of 5 cold launches ≤ 400 ms (P16).
- **Status:** unverified, counts as breaks — a whole-table fetch and the backfill run before first content · Phase 3.

**F3 · SHOULD NOT · No main-thread work blocks for 250 ms or more on the oldest supported iPhone; anything that scales with the catalogue or the diary runs off the main actor.**
- **In Yumo:** Off main, keep it so: Catalogue.sync and the FoodIndex snapshot (Task.detached, YumoApp.swift:73-78), search scoring. Still on main: store.foods() (Store.swift:145, ~7,330 rows) at OpenFoodFacts.swift:127, Balance.swift:43,232,237, BalanceSheet.swift:137 (the swap sheet), the SettingsScreen.swift:40 body (My foods count) and FoodPages.swift:76; Today's ~70 fetches per reload; Nutrients' ~13,000 fetches per render (NutrientsScreens.swift:15,58-59). Fixes: fetchCount and fetchLimit, ranged predicates, a @ModelActor for the planner, rows computed once in .task rather than in body.
- **Why:** Apple's hang reporter fires at 250 ms of main-thread blockage (platform diagnostic, not an enforced limit; same grade as F2's 400 ms).
- **Check:** Instruments Hangs on the oldest device while launching, opening Your day, a swap, Settings and Progress › Nutrients, and logging: no hang ≥ 250 ms. `grep -rn '\.foods()' Yumo` finds no main-actor call site. Watch Xcode Organizer › Hangs for TestFlight builds.
- **Status:** partly — sync and search off main; the rest on main and never measured on a device · Phase 4.

**F4 · SHOULD · Scrolling and animation hitch less than 10 ms per second: view bodies never fetch data, and continuous motion follows the display, not a timer.**
- **In Yumo:** No SwiftData fetch or Store call inside a body or a GeometryReader closure; long lists are LazyVStack or List (the Add groups already are). Per-frame motion uses SwiftUI animations, TimelineView(.animation) (as TourFinish does) or CADisplayLink (as the tour spotlight does), never Timer.scheduledTimer(withTimeInterval: 1/60), which drives the Log weight ruler's coast (LogWeightSheet.swift:111) and caps ProMotion at 60 Hz.
- **Why:** At 120 Hz a frame has 8.3 ms, and "even a couple of milliseconds can be noticeable" (Apple, Understanding hitches).
- **Check:** Instruments Animation Hitches on a ProMotion iPhone and the oldest device: scroll Today with four full meals, the Add results for "chicken" and Progress, and change day five times; hitch ratio < 10 ms/s.
- **Status:** partly — a 60 Hz timer on the ruler; Nutrients fetches every render; never profiled · Phase 4.

**F5 · SHOULD NOT · A wait that ends within about a second shows no spinner, skeleton or bar: keep the previous content or a static state line.**
- **In Yumo:** Every ProgressView goes through one DelayedSpinner that appears after ~1 s. Spinners at 0 s today: branded search (AddFoodSheet.swift:171,196), the barcode card's LOOKING IT UP (:290), the Staples scan card (StaplesScreen.swift:175), Type it (TypeItView.swift:21, flag off). The words "Looking it up" may show at once; only the moving indicator waits. Local search (~90 ms) and Your day show none, which is right.
- **Why:** Show nothing under ~1 s; an indicator for a sub-second load is jarring (NN/g, heuristic).
- **Check:** `grep -rn 'ProgressView(' Yumo` finds only DelayedSpinner; on a fast connection, search "heinz beans" and scan a known barcode: no spinner flashes.
- **Status:** partly — network spinners appear at 0 s · Phase 1.

**F6 · SHOULD · A wait over about 1 s (up to ~10 s) shows the system's spinner next to words naming what it waits for.**
- **In Yumo:** The system ProgressView only, labelled with its source: "Checking Open Food Facts…" (FoundCardView), "Looking up…" (Staples), or under the "Branded · Open Food Facts" overline. Its tint needs ≥ 3:1: inkMuted on bg is 2.85, so spinners on bg use ink or the new inkMuted (V2).
- **Why:** With no visible change, many people assume the action failed and try again (NN/g, heuristic). In Nah's study, a moving progress bar made people willing to wait about three times longer (experimental). The 1 s and 10 s bands are perceptual, not measured breakpoints.
- **Check:** Network Link Conditioner on "3G" or "Very Bad Network": scan an unknown barcode, search a brand, use the Staples scan; every wait over 1 s shows a labelled spinner at ≥ 3:1.
- **Status:** partly — labelled, but 2.85:1 on bg · Phase 1.

**F7 · SHOULD · Foreground waits stay under about 10 s; anything longer shows determinate progress with a time estimate, starting slow and accelerating, never stalling near the end, and offers a way out.**
- **In Yumo:** Open Food Facts and USDA requests use timeoutInterval 12 s (OpenFoodFacts.swift:31) → about 8 s. After ~4 s the label becomes "Still asking Open Food Facts…" with "Scan instead" or "Try again". Catalogue sync stays silent in the background. Future long tasks (restore, export, first sync) use ProgressView(value:) on real progress, with a time estimate.
- **Why:** Progress bars that speed up feel faster and late pauses feel slower (Harrison 2007, replicated 2022, experimental).
- **Check:** Link Conditioner at 100% loss: scan an unknown barcode; within ~8 s the card leaves "Looking it up" and offers an action.
- **Status:** partly — 12 s timeout and an unchanging spinner · Phase 1.

**F8 · MUST · Every wait ends in one named state (found, couldn't check, or genuinely empty); "not found" never shows before the answer, and unknown values show "—".**
- **In Yumo:** FoundCardView: LOOKING IT UP › COULDN'T CHECK (offline, timeout, server error) › NOT FOUND with Create this food. The Staples scan card: "Looking up…" › "Couldn't check" › "Not found". Branded search's brandedEmptyLine says "didn't answer" or "No packaged product…" only after a reply; the local "No generic match" only when searchedFor == query. A late answer after Rescan or ✕ is saved as a food, never logged. New network features copy this shape.
- **Why:** A premature "No records" while loading erodes trust (NN/g Empty States); the data bar: unknown shows "—" (decision 11).
- **Check:** On a device with Link Conditioner off, at 100% loss and at 3G: scan known, unknown and offline barcodes and search "heinz" offline; each lands in the right state, and no spinner outlives its request.
- **Status:** meets in code since Phase 0; the scanner states not yet seen on a device (P14) · Phase 4.

**F9 · SHOULD NOT · No skeleton screens, except for a full page with a predictable layout that loads in 1–10 s in a part of the app the user has already seen with real data.**
- **In Yumo:** Local data renders well under 1 s: no `.redacted(reason: .placeholder)`, no shimmer. A backend-loaded page (e.g. history after an account restore) that takes 1–10 s may use a skeleton of its real rows.
- **Why:** The evidence is thin and mixed: Viget found skeletons worst on every measure, Mejtoft found no difference, Chung a small edge (experimental); NN/g limits them to full-page loads of predictable layout in an app the user already knows.
- **Check:** `grep -rnE 'redacted|shimmer|skeleton' Yumo` returns nothing or an approved case.
- **Status:** meets.

**F10 · MAY · During an unavoidable 1–10 s wait, the screen may say what work is being done, never faked or padded.**
- **In Yumo:** "Checking Open Food Facts…" then "Checking USDA…" on the barcode card; "Sizing your day around your chicken…" if the planner ever takes over a second. No Task.sleep to look busy.
- **Why:** People can prefer a longer wait that shows its work (Buell and Norton 2011, experimental).
- **Check:** No Task.sleep lengthens a loading state.
- **Status:** meets.

**F11 · SHOULD · Small feedback (press, toggle, selection) animates in about 100 ms and never over 200 ms.**
- **In Yumo:** Keep Motion.pressIn 100, Motion.press 120 and Motion.pressOut 200 ms. Add Motion.select at ~150–200 ms for Segmented (Components.swift:94), OptionTile (:527), DayDots (:829), WeekStrip (:548) and the CornerBrackets lock (:415), which use Motion.snap 350, Motion.expand 360 or 300 ms today.
- **Why:** Simple feedback takes ~100 ms (NN/g); Material's component fades run 75–150 ms (vendor). The 200 ms ceiling is Yumo's choice. Thin evidence.
- **Check:** Those components use Motion.select; every small-feedback token is ≤ 0.2 s.
- **Status:** partly — selections settle over 350–360 ms · Phase 1.

**F12 · SHOULD · Screen, sheet and panel transitions take 250–400 ms.**
- **In Yumo:** In range: Motion.push 360, dayChange 320, expand 360, swipeOpen 320, swipeCommit 260, toastIn 250, review pages 300 (WeeklyReviewScreen.swift:26). Out: Motion.sheet 420 (AddFoodSheet.swift:77) and Motion.bar 450 → ≤ 400. System sheets and NavigationStack pushes keep the system's timing.
- **Why:** Modal transitions 200–300 ms, with 400 ms "very slow" and kept for large movements (NN/g); Material's container transform is 300 ms. Thin evidence.
- **Check:** Every transition token in Theme.swift is 0.25–0.40 s.
- **Status:** partly — sheet 420 ms, bar 450 ms · Phase 1.

**F13 · SHOULD NOT · No single animation takes longer than 500 ms from start to settle, delays and staggers included.**
- **In Yumo:** Over today: CountUpText 500 ms plus 40 ms a digit, ≈620 ms on every log (Components.swift:793-819); the weight chart draw 700 ms (ProgressScreen.swift:239); Maintenance bars 500 ms plus a 50 ms stagger (MaintenanceScreen.swift:79); ProgressBarsGlyph 540 ms (Components.swift:245); tabPop ≈600 ms (YumoApp.swift:128); the hero hit fade 600 ms (TodayScreen.swift:189); the tour spotlight glide 600 ms (Tour.swift:140); the SparkleButton twinkle 1.6 s (Components.swift:726); the SwipeHintRow nudge 1.4 s after a 600 ms wait (:664); TourFinish 3.4 s. Trim the count-up and chart entrances to ≤ 400 ms.
- **Why:** NN/g puts UI animation at 100–500 ms and calls 400 ms "very slow", for large movements only (heuristic). Material allows up to 1,000 ms for long distances, so 500 ms is NN/g's and the brief's ceiling, not a cross-vendor consensus. Thin evidence.
- **Check:** `grep -rn 'duration:' Yumo`, add each animation's delay and stagger: every total ≤ 0.5 s.
- **Status:** breaks — about ten animations run 540 ms to 3.4 s · Phase 1.
- **Exception:** Decision 10 (the handoff's motion: count-up, twinkle, nudge, tour finish). The audit said keep the language, trim the count-up and chart to ≤ 400 ms; revisit the twinkle when the ✦ gets a label (N2) and the tour finish with decision 15.

**F14 · SHOULD · Exits are faster than entrances: ease-out coming in, a quicker ease-in going out.**
- **In Yumo:** The toast already does it (in 250 ms easeOut, out 200 ms easeIn, Components.swift:132,136). Add Motion.exit at ~0.6× the entrance (~220 ms) for the Expandable collapse (:709-710, 360 ms both ways), the dayTransition removal (TodayScreen.swift:117), the CalendarPopover close, and the PushPage dismiss (:757) until N5 replaces it.
- **Why:** A departing element is no longer the focus, so lingering reads as delay (NN/g; Material fades in over 150 ms and out over 75). The 0.6× ratio is Yumo's choice. Thin evidence.
- **Check:** Every transition with both an insertion and a removal has the shorter removal.
- **Status:** partly — only toasts · Phase 1.
- **Exception:** Decision 10 (the handoff's "back is the exact reverse"). The audit said keep the look, exits at ~220 ms; native pushes keep the system's timing (N5).

**F15 · SHOULD · Motion uses springs set by duration and bounce: 0 by default and at most 0.3.**
- **In Yumo:** New motion uses `.spring(duration:bounce:)`, `.snappy` or `.smooth`. Today's bézier overshoot: Motion.swipeOpen and swipeGlyph 2.3%, Motion.bar 3.0%, Motion.tabPop and swipeGlyphScale 8.0% (≈ bounce 0.38; bounce 0.3 overshoots ~4.6%, 0.4 ~9.5%). Bring the 8% curve to ≤ 0.3, or keep it for one-off pops only.
- **Why:** Bounce 0–0.3 (brief ch. 6); Apple's default is 0, and it flags anything above 0.4 "use with caution" (WWDC23 10158, platform).
- **Check:** Compute the peak of every timingCurve with a y above 1 and read every .spring bounce: none above bounce 0.3 (~4.6% overshoot) outside the exception.
- **Status:** partly — one 8% curve · Phase 1.
- **Exception:** Decision 10 (tabPop and the swipe glyph's overshoot are handoff tokens). Revisit if the move to springs goes ahead (open question 51).

**F16 · SHOULD · When a gesture ends, the element settles on a spring seeded with the finger's velocity, and a fling into a limit rubber-bands.**
- **In Yumo:** SwipeStage's open, close and commit (SwipeStage.swift:91-104) settle on Motion béziers and ignore velocity → pass UIPanGestureRecognizer.velocity(in:) into `.interpolatingSpring(…, initialVelocity:)`; the 0.25× rubber-band past full width is right. The ruler's coast stops dead at its min and max → a short rubber-band. The weekly review pager follows the finger (a paging ScrollView).
- **Why:** A gesture with momentum and no overshoot "can often feel broken" (Apple WWDC18 803, WWDC23 10158).
- **Check:** On a device: a fast and a slow flick on a meal row settle at different speeds; fling the ruler past its limit; drag a review page.
- **Status:** partly — rows ignore velocity; the ruler stops hard; the pager doesn't track · Phase 1.

**F17 · SHOULD · The state changes at once and the animation only shows it: a touch mid-animation is accepted, and no overlay swallows touches for more than a moment.**
- **In Yumo:** TourFinish takes every touch for 3.4 s (Tour.swift:117; TourOverlay.swift:108) → a tap dismisses it. PushPage waits 360 ms on Task.sleep before dismissing (Components.swift:757); it goes with N5. SwipeStage waits 260 ms before onCommit (SwipeStage.swift:104) → commit the data at once and let the slide play.
- **Why:** Springs stay continuous when interrupted (WWDC23 10158); motion must not slow frequent interactions (Apple HIG).
- **Check:** On a device: tap during the tour finish (it closes), tap back twice quickly, swipe-delete then tap the next row; every touch registers.
- **Status:** partly — the 3.4 s tour block; timer-gated dismiss and commit · Phase 1.
- **Exception:** Decision 15 keeps the tour; the 3.4 s blocking finish isn't part of that decision and can become tap-to-dismiss now.

**F18 · SHOULD · Spatial transitions move the way the user is going: forward in from the trailing edge, back from the leading edge.**
- **In Yumo:** Onboarding (OnboardingFlow.swift:64) always inserts from the trailing edge, so Back looks like Next → an asymmetric .move driven by a forward flag (a fade under Reduce Motion). dayTransition already slides ±14 pt by dayForward; calendar months and review pages follow the same rule.
- **Why:** Animation helps people follow what changed (Chang and Ungar 1993; NN/g, heuristic).
- **Check:** Next then Back in onboarding: the content moves opposite ways.
- **Status:** partly — onboarding Back slides as if forward · Phase 3.

**F19 · SHOULD · Actions repeated many times a session get the least motion, and entrances play once per data change, not on every visit.**
- **In Yumo:** Logging happens 5–15 times a day: the count-up ≤ 400 ms (F13), and the sheet closing, count-up, Bar fill and week tick read as one change, not four. Tab switches: tabPop (≈600 ms) and the ProgressBarsGlyph regrowth at ≤ 300 ms or dropped. Progress: the weight chart and Maintenance bars redraw only when the data changed (today the tab is rebuilt on every visit, N23).
- **Why:** Avoid motion on frequent interactions (Apple HIG); simultaneous animations compete for attention (NN/g).
- **Check:** Switch Today ↔ Progress five times: the charts don't redraw. Log a food: all motion after the sheet closes is done within 400 ms.
- **Status:** partly — charts redraw every visit; ≈620 ms count-up on every log · Phase 1.
- **Exception:** Decision 10 (motion.countUp "numbers never snap", tabPop, chartIn): keep the motifs, shorter and once.

**F20 · SHOULD · Motion meant to catch the eye plays at most once per feature, never loops, and is skipped under Reduce Motion.**
- **In Yumo:** The SwipeHintRow nudge plays once (swipeHintSeen): keep it. The SparkleButton twinkle (1.6 s) replays daily via yumo.twinkleDay → once ever, and gone once the ✦ has a label (N2). No repeatForever; no autoplaying video or audio; anything that loops needs a pause control.
- **Why:** Add motion on purpose and avoid autoplay without controls (Apple HIG Motion and Accessibility); a gesture hint is a fair use (NN/g).
- **Check:** `grep -rn 'repeatForever' Yumo` returns 0; over three simulated days, the twinkle and the nudge each play once.
- **Status:** partly — the twinkle replays daily; neither respects Reduce Motion · Phase 1.
- **Exception:** Decision 10 (motion.twinkle once a day; the ✦ is the only way into Your day). The audit said label the ✦ and drop the twinkle.

**F21 · SHOULD · Every duration and curve comes from a named Motion token in Theme.swift.**
- **In Yumo:** No `.timingCurve(…)`, `.easeIn/Out/InOut(duration:)`, `.spring(…)` or delay literals in screens. 19 inline curves today: TodayScreen.swift:188-189; ProgressScreen.swift:140,239,268; SummaryScreen.swift:149-150; WeeklyReviewScreen.swift:26,245; MaintenanceScreen.swift:79; Components.swift:136,245,415,664,726; Tour.swift:108,115,140,142. Add tokens named for their job (Motion.select, exit, toastOut, chartIn, glide, nudge, twinkle), each with a Reduce Motion form (A21).
- **Why:** Tokens let the duration rules and Reduce Motion apply in one place (Material publishes motion as tokens; Yumo already does it for colour).
- **Check:** `grep -rnE '\.timingCurve\(|\.ease(In|Out|InOut)\(|\.spring\(' Yumo | grep -v Theme/Theme.swift` returns nothing.
- **Status:** breaks — 19 inline curves in 7 files · Phase 1.

**F22 · SHOULD · Haptics use only the system feedback patterns, each for its documented meaning; no custom patterns.**
- **In Yumo:** Allowed: UINotificationFeedbackGenerator (.success, .warning, .error), UIImpactFeedbackGenerator, UISelectionFeedbackGenerator, or `.sensoryFeedback`. Never CHHapticEngine or AudioServices vibration. These obey Settings › Sounds & Haptics › System Haptics, so haptics are optional without an in-app switch (open question 53).
- **Why:** Use system patterns for their documented meanings and keep haptics optional (Apple HIG and Android agree, vendor); haptics evidence is thin (brief ch. 0).
- **Check:** `grep -rnE 'CHHaptic|CoreHaptics|AudioServices' Yumo` returns nothing; with System Haptics off nothing vibrates.
- **Status:** meets in code; System Haptics off not yet checked on a device (P14) · Phase 4.

**F23 · SHOULD · A significant completion plays exactly one system haptic as it completes, the same whichever path got there.**
- **In Yumo:** A food logged by any path (+, Food page Log, scan, "Log N meals", saved meal, repeat swipe): one .success. A saved weight: one .success. A committed removal: one .medium impact; for a swipe, at the arm threshold only (SwipeStage.swift:89 and :102 both fire today). A failed scan may play .error. Today scan and Your day play .success (AddFoodSheet.swift:134, BalanceSheet.swift:205) and Today's reload adds another on the day's first log (TodayScreen.swift:147), while +, Food page Log, saved meals and weights play none. Move the reload haptic into the action.
- **Why:** A short pulse gives back the touch confirmation a screen lacks (Brewster and Hoggan, experimental); keep haptics causal and sparse (Apple, Google).
- **Check:** `grep -rnE 'notificationOccurred|impactOccurred' Yumo`: one site per action; on a device, each of the six log paths and both delete paths gives exactly one pulse.
- **Status:** partly — some logs buzz twice, most never · Phase 1.
- **Exception:** Decision 10 (the first-of-day haptic is the handoff's motion.tickStamp): keep the week-circle animation, move the haptic to the action.

**F24 · SHOULD NOT · No haptics for typing, scrolling, chart scrubbing or animation frames; continuous controls tick only at real detents, never so fast the ticks blur.**
- **In Yumo:** Fields, search, scrolling and the chart drag are silent. RulerView (LogWeightSheet.swift:127) and MacroDragTile (Components.swift:688) tick per detent, which is right, but the ruler's 60 Hz coast ticks at every 0.1 kg it passes, dozens a second → at least 40 ms between ticks (Yumo choice), plus the single .rigid when it comes to rest.
- **Why:** Never per scroll or keystroke; buzzy haptics are worse than none (Apple, Android, platform).
- **Check:** On a device, fling the ruler hard: the ticks stay distinct, at most ~25 a second.
- **Status:** partly — the ruler's coast · Phase 1.

**F25 · SHOULD · Each haptic plays at the same moment as the visible change it confirms; generators are prepared in advance.**
- **In Yumo:** .success with the sheet closing and the row and hero updating; the swipe-arm impact as the glyph rides to the row edge (already). Every call site builds a fresh generator and never calls prepare() → prepare() when the press or gesture begins, or `.sensoryFeedback(.success, trigger:)`.
- **Why:** Effects out of sync with the visuals make people think the actuator is broken (Android Haptics principles, vendor); keep a clear, causal link (Apple HIG). Separately, a haptic's strength should match the control's visual weight: perceived button quality tracked visual–tactile congruence (Hoggan et al., ICMI 2008, experimental).
- **Check:** Every haptic site calls prepare() or uses .sensoryFeedback; film a scan log and a swipe arm at 240 fps: pulse and visual land within ~2 frames.
- **Status:** partly — generators never prepared · Phase 1.

**F26 · SHOULD NOT · No haptic plays on appear, on a timer, for a background result or on a screen Yumo opened by itself.**
- **In Yumo:** WeeklyReviewScreen.swift:108 plays .success onAppear, even when the review opens by itself on Monday → move it to Apply or Keep. Today's reload haptic (TodayScreen.swift:147) → the log action (F23). PendingLookups results and toasts stay silent.
- **Why:** Each haptic needs "a clear, causal relationship" with the action that causes it (Apple HIG, vendor; haptics evidence is thin).
- **Check:** No haptic call in an onAppear or a reload function; let the review open by itself on a Monday: no pulse until Apply or Keep.
- **Status:** breaks — the review buzzes when it appears · Phase 1.

**F27 · SHOULD · Confirm a change where it happened; a toast only reports a result that happened out of sight, or carries one action such as Undo.**
- **In Yumo:** Keep: "Protein Bar · 60 g → Snacks · Undo", "Removed X · Undo", "Tuna swapped out · Never suggest", "Logged · day at 2,150", "1 scanned food found" (out of sight; F30). Drop or make inline: "Pinned X" / "Unpinned X" (the pin glyph toggles, NutrientsScreens.swift:101-102), "Up to 3 pins" (SettingsScreen.swift:192, an inline note), "Targets reset", and "Saved X" when the edited row is in view. There are 35 toaster.show calls today.
- **Why:** iOS has no toast primitive; prefer quiet status in place (Apple HIG Feedback).
- **Check:** `grep -rn 'toaster.show' Yumo`: each call has an action or reports something not visible where the user lands.
- **Status:** partly — several info toasts repeat what the screen shows · Phase 1.
- **Exception:** Decision 9 keeps one-action toasts in their own window; this rule agrees. Info-only toasts are a handoff habit (decision 10); the audit said revisit them (open question 48).

**F28 · SHOULD · Undo stays up about 5 seconds and pauses while a finger is on the toast; an information toast stays long enough to read the whole line.**
- **In Yumo:** Replace the hard-coded 4 s (Components.swift:133) with holdAction = 5 s (the audit suggested ~6 s), paused by a DragGesture(minimumDistance: 0) on ToastView. Raise Motion.toastHold from 1.8 s (Theme.swift:136) to a hold based on length with a 2.5 s floor (Yumo choice; formula open). The brief conflicts with itself here (a ~5 s Undo window against "no auto-dismissing timers", ch. 4 and 11); Yumo resolves it by keeping each toast's fact visible in place and by holding the toast while VoiceOver or Switch Control runs (A11), so for touch users the timed toast is a shortcut, not the only path.
- **Why:** Gmail's Undo Send holds 5 s (company); undo beats confirmation (NN/g); 1.8 s is too short for a ten-word line (audit).
- **Check:** Read Toaster: action toasts ≥ 5 s and pause on touch; info toasts ≥ 2.5 s; time both on a device.
- **Status:** breaks — 4 s Undo with no pause; 1.8 s info toasts · Phase 1.
- **Exception:** Decision 9 set the scan Undo at 4 s. The brief says ~5 s and it's one constant: revisit now (open question 48).

**F29 · MUST · One toast at a time at the bottom, at most one action with a full-size target, passing text contrast in both themes, above sheets, never truncated.**
- **In Yumo:** This writes down decision 9. Already: Toaster cancels the previous toast; ToastView has at most one action; Undo's frame is ≥ 44 × 44; on panel, white is 16.98 / 11.84 and green 7.45 (light) / 5.19 (dark; dark Undo moves to accentText, V6); the ToastLayer window sits at .alert + 1. Fix: `Text(…).lineLimit(2)` (Components.swift:116) cuts the message at large sizes, so remove it; position is T17 and T22.
- **Why:** 4.5:1 text and 44 pt targets (WCAG, standard; Apple); one snackbar at a time with one optional action (Material).
- **Check:** Contrast from the tokens; Accessibility Inspector shows Undo ≥ 44 × 44; on a device, a two-line toast at AX5 and one with the decimal pad up.
- **Status:** partly — lineLimit(2) truncates at large text; keyboard overlap unchecked · Phase 1.

**F30 · SHOULD · A toast names what changed and where, and the change can still be found after the toast fades.**
- **In Yumo:** "1 scanned food found" (YumoApp.swift:80) names nothing and leads nowhere → store the meal and day with the pending scan: "Heinz Beans found · Log to Lunch". "Logged · day at 2,150" and "X → Breakfast" are fine because the diary shows them. "Deleted Mon 12 Oct" (a weight) also offers Undo.
- **Why:** Timed views fail people who need longer (Apple HIG Accessibility); a deferred result must say what it was (practitioner).
- **Check:** Each toaster.show string names the item and where it went; the change is visible somewhere 10 s later.
- **Status:** partly — deferred scan results are anonymous · Phase 1.

**F31 · SHOULD · Show an action's result before the server confirms it only for simple yes/no actions that succeed at least 97% of the time and confirm within about 2 s.**
- **In Yumo:** Not relevant yet: there is no server and SwiftData writes are synchronous. With the REST backend (decision 12): logging or removing an entry, Keep and Never, pins and staple changes may show at once; account and password changes, target changes and anything that rewrites past days wait for the server, with a spinner per F5–F7.
- **Why:** Optimistic UI moves actions into the 0.1 s band, but only for binary actions with 97–99% success and replies under 2 s (practitioner, heuristic; no controlled study).
- **Check:** When sync ships, list every optimistic write with its measured success rate and 95th-percentile latency from TestFlight.
- **Status:** n/a — no server yet.

**F32 · MUST · A failed or late result is visible, named and rolled back; it never silently changes what the user logged or is looking at.**
- **In Yumo:** Already: a barcode answer that arrives after Rescan or ✕ is saved as a food and never logged (Phase 0). Still to do: deferred lookups are announced by name with an explicit action (F30). With a backend: a failed log reverts its row with a marker on that row, not only a toast, and a failed sync never changes a past day's totals without saying so.
- **Why:** Report failure within the confirmation window with a rollback the user can see (practitioner); the data bar: never a wrong number.
- **Check:** With Link Conditioner, scan then Rescan before the answer arrives: nothing logs. Scan in airplane mode, then reconnect: the toast names the food and offers Log.
- **Status:** partly — late answers never log; the deferred-find toast is anonymous · Phase 1.

**F33 · SHOULD NOT · No pull-to-refresh on screens whose content is already current.**
- **In Yumo:** Today, Progress, Settings and Add are local and always current; there's no .refreshable anywhere. With a backend: sync automatically when the app comes forward, with a quiet "Synced 2 min ago" line; .refreshable only where content can really be stale.
- **Why:** Pull-to-refresh was built in an afternoon without user testing; its critics cite accidental refreshes and a slot-machine feel, and its defence is that a manual pull assures content is current (history, heuristic). The brief makes no rule; this is Yumo's call for local data.
- **Check:** `grep -rn '\.refreshable' Yumo` finds no local-data screen.
- **Status:** meets.

**F34 · SHOULD NOT · No information is carried by sound alone, and any sound respects the silent switch.**
- **In Yumo:** Yumo plays no sounds. A future scan beep uses AVAudioSession .ambient and always has a visual and a haptic twin.
- **Why:** Respect the silent switch and never rely on sound alone (Apple HIG Playing audio, vendor).
- **Check:** `grep -rnE 'AVAudio|AudioServices|SystemSoundID' Yumo` finds nothing, or only .ambient uses with a visual counterpart.
- **Status:** meets.

---

## Accessibility (A)

**A1 · MUST · All text scales with Dynamic Type to at least 200%, up to AX5 (Body 53 pt), each style on the curve of its matching iOS text style.**
- **In Yumo:** Font.nunito(size, weight) gains a `relativeTo:` text style per token: hero, plan, verdict, rulerValue, statBig, wordmark, display, pageTitle → .largeTitle; headline → .title; stat, displayMuted, buttonHero, button → .title3; title, inlineTitle, body, bodyStrong, tile → .body or .headline; action, subtitle, buttonCompact → .subheadline; detail, caption, captionLight, segment → .footnote; overline, footnote, tag → .caption; axis, tabLabel → .caption2. The fallback `.system(size:…, design: .rounded)` (Theme.swift:60) becomes a scaled text-style font. NumberField builds its UIFont with `UIFontMetrics(forTextStyle: .body).scaledFont(for:)` and sets adjustsFontForContentSizeCategory (Components.swift:325). Big numerals (hero 72, ruler 72, plan 64) may cap at .accessibility2 if they never truncate and VoiceOver reads the value (open question 43).
- **Why:** 27–31% of iOS users run a non-default text size: 8.8% smaller, 3.1% at accessibility sizes (app telemetry). WCAG 1.4.4, resize to 200% (standard), which hard rule 8 adopts.
- **Check:** Every font in Components.swift and the screens comes from a Font.yumo token (V22's grep is 0) and every token has relativeTo:; `grep -rn UIFontMetrics Yumo` ≥ 1; at AX5 the 34 pt display style grows on the largeTitle curve, not to ~106 pt; at xSmall the 11 pt tokens stay at 11.
- **Status:** breaks — no relativeTo: anywhere; all 30 tokens follow Body's ×3.1 curve; the fallback and NumberField don't scale · Phase 1.

**A2 · MUST NOT · From xSmall to AX5, text that carries data or names an action never truncates, shrinks below the chosen size, clips or overlaps; containers grow with their text.**
- **In Yumo:** Food names `lineLimit(2)`, nil at accessibility sizes. Remove the minimumScaleFactor uses (StaplesScreen.swift:220, BalanceSheet.swift:85, SummaryScreen.swift:97). PrimaryButton, SecondaryButton, SwipeHintRow (60 pt) and InsetField (40 pt) take a minHeight, not a fixed height, with lineLimit(2). Summary's nutrient value column gets `.fixedSize()` and the bar flexes. The SourceLine (.height(260)) and Reminder time (380) sheets get detents or a ScrollView. Onboarding steps scroll, with the CTA in safeAreaInset. Each of the 34 `lineLimit(1)` keeps a comment saying why (decorative or repeated text only). A truncated "1,280…" of sodium breaks the data bar as surely as a wrong number.
- **Why:** Truncation at large text is one of three defects even accessibility-literate companies disclose (Starling 2026, Monzo; brief ch. 8), and Apple's own audit found it (WWDC25 224); WCAG 1.4.4 requires no loss of content at 200% (standard).
- **Check:** `grep -rnE 'lineLimit\(1\)|minimumScaleFactor' Yumo`: every hit is justified; at AX5, Today, Add, the Food page, Summary and Settings show no "…" and no "Protei/n" or "Bre/akfa/st"; at Large, Add's results for "chicken" and Summary on a logged day show no "…".
- **Status:** breaks — text truncates even at Large ("Chicken breast, boneless, skinl…", "Swipe ri…") · Phase 1.

**A3 · SHOULD · At accessibility sizes, rows that pair a label with a value stack vertically, and a title never sits on top of a button.**
- **In Yumo:** One AdaptiveStack in Components.swift (an HStack below .accessibility1 and a VStack from it, or ViewThatFits) in SettingsRow, the hero's P/C/F stats, PlanRow, AskOption, Your day's summary and meal headers, the Food page macro and Servings rows, search result rows, Summary nutrient rows and the Calorie target number row. SheetHeader and PageHeader titles get `.allowsHitTesting(false)` now and move to their own line under the ✕ / back row at accessibility sizes.
- **Why:** Apple's fix for rows that break at large sizes is a stacked layout, not truncation (HIG Typography; Mail reflows this way).
- **Check:** `grep -rnE 'ViewThatFits|AnyLayout|isAccessibilitySize' Yumo` hits each listed component; at AX5 "Add to Breakfast" no longer covers ✕ and Scan, "Your day" no longer covers Edit staples, "Settings" no longer covers ‹ Progress, and each button can be tapped.
- **Status:** breaks — nothing stacks; AX5 shows "S/e/r/vi/n/g/s" and titles over ✕, Scan and Back · Phase 1.

**A4 · MUST · Every icon-only button and custom control has an accessibility label naming its purpose in a word or two.**
- **In Yumo:** Set inside the components: CloseButton "Close" (it reads "multiplication x"); AddCircleButton "Add {food}"; ValueStepper as one adjustable element ("Servings, 2.5"); ArrowButton "Previous day" / "Next day"; the torch "Torch" with an on/off value; InputRow and staple ✕ "Remove {food}"; PageHeader back as the parent's title with ‹ hidden; SparkleButton "Your day" (N20); InfoButton "How {thing} is worked out"; NumberField a label ("Amount, grams"); the five `Toggle("")` become e.g. `Toggle("Log weight reminder", isOn:).labelsHidden()` (SettingsScreen.swift:43,44,180; CalorieTargetScreen.swift:46; MacrosScreen.swift:34); RulerView "Weight"; MacroDragTile "{Protein}, grams"; pager dots "Page 2 of 5". Right already: ScanButton, CogButton, TodayChip, ReviewChip, calendar days. Visible words are V32.
- **Why:** Missing labels were the main failure across 9,999 apps: 52.5% of image buttons had none (Ross et al. 2020, empirical); Apple requires a label on every icon.
- **Check:** `grep -c 'Toggle(""'` across Yumo is 0; Accessibility Inspector's "no description" count is 0 on every main screen; `performAccessibilityAudit(for: .sufficientElementDescription)`; a VoiceOver pass never reads a glyph's name.
- **Status:** breaks — ✕, +, −/+, ‹ ›, the torch and staple ✕ are unnamed; switches say only "switch, off" · Phase 1.

**A5 · MUST · No two controls on one screen share an accessibility label; repeated controls name what they act on.**
- **In Yumo:** AddChip "Add to Breakfast", "Add to Lunch"… (today "Add food" ×4); result and Recent row + "Log Apples, 150 g"; SwipeActionRow "Delete Chicken breast" / "Add Breakfast again" (today "Delete" / "Add", SwipeStage.swift:70); Staples "Edit {food}"; Nutrients "Pin Fibre to Today" (today "Edit" and "Pin" ×30); WeekStrip "Thursday 22 October, logged, today" (today "T" and "S" appear twice); DayDots "Monday, on".
- **Why:** Apple HIG asks for unique list labels; Domino's was litigated over redundant links; Monzo discloses hard-to-skip labelling (litigation, company statements).
- **Check:** VoiceOver rotor › Buttons on Today, Add, Staples and Nutrients shows no duplicates; a UI test asserts unique labels per screen.
- **Status:** breaks — "Add food" ×4, "Edit" and "Pin" ×30, duplicate day letters · Phase 1.

**A6 · MUST · Every control reports its role (button, header, adjustable, tab, toggle), its state (selected, expanded, disabled) and its value.**
- **In Yumo:** .isSelected on the selected Segmented option, WeekStrip day and tab (the calendar already does it); OptionTile, AskOption and DayDots .isSelected or .isToggle; the tap-gesture rows (SettingsScreen.swift:43-77, CalorieTargetScreen.swift:119, FoodPages.swift:64, WeightLogScreen.swift:55, AddFoodSheet.swift:272) become Buttons; Expandable reports expanded or collapsed; ValueStepper, RulerView, MacroDragTile and the review pager become single adjustable elements (`.accessibilityElement(children: .ignore)` plus a value and `.accessibilityAdjustableAction`); a disabled ArrowButton uses .disabled, not 0.3 opacity.
- **Why:** Name, role and value are WCAG AA 4.1.2 (standard); Apple and Android both require correct traits.
- **Check:** Every onTapGesture in Yumo/Screens is a Button or carries .isButton; VoiceOver says "selected", "adjustable" and "expanded" where due.
- **Status:** breaks — only the "I don't eat" chips and calendar days set .isSelected · Phase 1.

**A7 · SHOULD · Icons, glyphs and the controls that hold them grow with the user's text size, capped at about 1.6×.**
- **In Yumo:** `@ScaledMetric(relativeTo:)` for AddChip 40 × 34, AddCircleButton 36, StepperButton, ScanButton, SparkleButton 40, the CloseButton glyph, CogButton's 20 pt symbol, InfoButton's 24 pt ring, CheckCircle 24, WeekStrip 32, DayDots 28 and the TabBar glyphs 28. SF Symbols (V23) scale with the font; brand glyphs stay drawn but scaled.
- **Why:** Icons should grow with text (Apple HIG Accessibility; WWDC24 10074). The 1.6× cap is Yumo's choice.
- **Check:** `grep -c 'ScaledMetric' Yumo/Theme/Components.swift` ≥ 10; at AX5 the ✕ sits inside its circle and the Today tab's day number inside its tile (Food page amount editor, AX5).
- **Status:** breaks — fixed frames everywhere · Phase 1.
- **Exception:** Decision 10 (drawn glyphs) is fine if they scale; swap to an SF Symbol any glyph that can't.

**A8 · SHOULD · Controls in bars that can't grow cap their text and show the Large Content Viewer on a long press.**
- **In Yumo:** TabBar keeps its 49 pt: labels get `.dynamicTypeSize(...DynamicTypeSize.xxxLarge)` and each tab `.accessibilityShowsLargeContentViewer { glyph; Text(label) }` (YumoApp.swift:107-133). The same for TodayChip, ReviewChip and StreakPill if they stay capped at 36 pt.
- **Why:** This is Apple's mechanism for bars that can't grow (WWDC24 10074).
- **Check:** `grep -c accessibilityShowsLargeContentViewer Yumo/YumoApp.swift` ≥ 2; at AX3, long-press Progress: the viewer shows the glyph and "Progress".
- **Status:** breaks — labels grow to ≈31 pt inside a fixed bar; no viewer · Phase 1.

**A9 · SHOULD · System controls first; each custom control carries the label, value, traits and actions the system one would, built into the shared component.**
- **In Yumo:** Keep the system Toggle, alerts, confirmationDialog, DatePicker, share sheet, .sheet and (decision 14) NavigationStack. Every custom control in Components.swift and SwipeStage.swift sets its semantics inside the component, never at call sites: Segmented, ValueStepper, WeekStrip, DayDots, TabBar, AddChip, AddCircleButton, CloseButton, SparkleButton, InfoButton, OptionTile, AskOption, Expandable, SwipeActionRow, RulerView, MacroDragTile, the pager dots. No new component merges without them.
- **Why:** Audit failures cluster in custom controls and spread from unlabelled defaults (Ross et al., 9,999 apps, empirical).
- **Check:** Settings › Design system (debug) in Accessibility Inspector: every component has a name and a trait.
- **Status:** partly — about 16 accessibility modifiers in 7,628 lines · Phase 1.
- **Exception:** Decision 10 keeps the custom visuals; only their semantics have to match the system's.

**A10 · MUST · Anything that appears without a screen change is announced to VoiceOver: toasts, errors, status lines, lookup states, new result sets.**
- **In Yumo:** Toaster.show posts `AccessibilityNotification.Announcement(text)` plus ", Undo available" when there's an action; one line covers ~35 toasts. Also: the sign-in error (OnboardingFlow.swift:272-276), FieldMessage (I21), Create food's missing-field line, Your day's status ("Protein short by 6 g"), FoundCardView's states, the search result count after the debounce, CameraDeniedCard. Each tour step posts ScreenChanged; after a log, LayoutChanged with focus on the new row.
- **Why:** Unannounced new content and errors are one of three defects even accessibility-literate companies disclose (Starling 2026, Monzo; brief ch. 8); status messages are WCAG AA 4.1.3 (standard).
- **Check:** `grep -rnE 'AccessibilityNotification|UIAccessibility.post' Yumo` hits Toaster and each site; with VoiceOver, a scan says "Protein Bar, 60 grams, logged to Snacks. Undo available" and a wrong password reads the error.
- **Status:** breaks — the app announces nothing · Phase 1.

**A11 · MUST · A timed toast is never the only place its information or action lives: its fact stays visible in place, and while VoiceOver or Switch Control runs it stays until dismissed; nothing else auto-dismisses or auto-advances.**
- **In Yumo:** Toaster.show (Components.swift:130-135) schedules no auto-hide when `UIAccessibility.isVoiceOverRunning` or `isSwitchControlRunning`. Undo is also `.accessibilityAction(named: "Undo")` on the toast and on the newly logged row; VoiceOver must be able to reach the ToastLayer window (its hitTest mustn't hide it), and `accessibilityPerformEscape` dismisses the toast. Every toast's fact is also visible in place (F27, F30). Nothing auto-advances (the tour finish is F17). F28 records how this settles the brief's own conflict.
- **Why:** Snackbars stay put while a screen reader is on (Material); keep auto-dismissing views to a minimum (Apple HIG); timing is WCAG 2.2.1 (standard). Pausing under a finger is not an extension in WCAG's sense, which is why the fact and the action also live outside the toast.
- **Check:** VoiceOver on a device: scan, wait 30 s; Undo is still reachable and works. Repeat with Switch Control.
- **Status:** breaks — toasts vanish at 1.8 s or 4 s whatever is running · Phase 1.
- **Exception:** Decision 9 (timed one-action toasts) stands for touch users. If the toast window can't take VoiceOver focus, put Undo on the logged row instead.

**A12 · MUST · Every swipe, drag and long-press has an accessibility action, and a value set by dragging can also be adjusted without dragging.**
- **In Yumo:** SwipeActionRow (SwipeStage.swift:37-71): `.accessibilityAction(named:)` "Add {meal} again" / "Delete {food}" calling commit(), with the zero-width revealed button hidden while closed; the repeat row the same; supplements a remove action; RulerView `.accessibilityAdjustableAction` at ±0.1 kg; MacroDragTile adjustable at ±5 g; the review pager as an adjustable page control; the CalendarPopover backdrop `.accessibilityAction(.escape)`; the Progress chart scrub per A19. Visible controls, typing and −/+ are N21 and I25.
- **Why:** Head-pointer, eye-gaze and switch users can't drag (WCAG 2.2 SC 2.5.7, standard; Apple WWDC26 220).
- **Check:** `grep -rnE 'accessibilityAction|accessibilityAdjustableAction' Yumo` ≥ 6 hits; the VoiceOver Actions rotor on a meal row offers "Delete Chicken breast"; swiping up on the ruler adds 0.1 kg; Switch Control logs a weight other than the prefilled one.
- **Status:** breaks — no accessibilityAction anywhere · Phase 1.
- **Exception:** Decision 10 (the swipe-only repeat row, ruler and pager): custom actions add nothing visible, so the decision is untouched.

**A13 · SHOULD · Popovers, the tour and custom overlays keep VoiceOver focus inside, announce themselves and close with the escape gesture.**
- **In Yumo:** CalendarPopover: `.accessibilityAddTraits(.isModal)` and an escape action (today it closes only through a transparent backdrop tap, TodayScreen.swift:93). The tour bubble's window (TourOverlay.swift, Tour.swift): .isModal and ScreenChanged on each step; under VoiceOver, stops that need a tap in the cut-out become explain-and-Next stops. pushCover pages get escape → back until N5.
- **Why:** The bar is finishing the main tasks with VoiceOver, Voice Control and Switch Control on a device (brief); always offer an obvious dismissal (Apple HIG).
- **Check:** With VoiceOver, open the calendar: focus stays inside and a two-finger Z closes it. Settings › Show me around: only the bubble is reachable and every stop advances.
- **Status:** breaks — no isModal or escape anywhere; never tried on a device · Phase 1.
- **Exception:** Decision 15 keeps the tour; it just has to work with VoiceOver and Switch Control.

**A14 · SHOULD · Section and card titles are headings.**
- **In Yumo:** `.accessibilityAddTraits(.isHeader)` inside Overline and the SheetHeader / PageHeader titles; on Today's and Progress's large titles, the meal card titles, the Progress card titles and the Food page's section titles. The calendar month already is one.
- **Why:** Monzo admits screen-reader users struggle to skip sections because of how text is labelled (company statement).
- **Check:** Rotor › Headings on Today lists Today, Breakfast, Lunch, Dinner, Snacks; `grep -rc 'isHeader' Yumo` totals ≥ 6.
- **Status:** breaks — the calendar month is the only heading · Phase 1.

**A15 · SHOULD · Decorative glyphs, separators and repeated chevrons are hidden from VoiceOver.**
- **In Yumo:** `.accessibilityHidden(true)` on the › in ChevronValue, ExpandChevron, AskFooter and ReviewChip; the ▾ unit caret; MacroDragTile's ▲▼; sheet grabbers; the SwipeHintRow arrow tile; YumoMark inside ReviewChip; the day number in the Today tab glyph; TickGlyph where a label already says "logged".
- **Why:** Hide decorative images (Apple HIG; Android, platform).
- **Check:** VoiceOver over a Settings row, the review chip and the Today tab never reads "single right-pointing angle quotation mark" or a stray number.
- **Status:** breaks — chevrons, carets and the tab's day number are read aloud · Phase 1.

**A16 · SHOULD · An item built from several texts is one accessibility element with one combined label and its actions.**
- **In Yumo:** Food rows: "Apples, 150 grams, 78 calories". SettingsRow `.accessibilityElement(children: .combine)`. HeroCard as one element ("1,657 of 2,950 calories. Protein 80 of 243 grams…"). CountUpText with one label and its digit columns hidden (Components.swift:794-821). StreakPill "3 day streak". PlanRow "Rice, 160 grams, suggested". The Maintenance card's InfoButton a sibling, not nested; Food page nutrient rows outside the Button label.
- **Why:** Group image–caption pairs so they aren't read in fragments (Apple HIG).
- **Check:** VoiceOver: one swipe per food row, one stop for the hero, "1,657" read once, not "1, 6, 5, 7".
- **Status:** breaks — the hero reads in fragments; CountUpText exposes its digits · Phase 1.

**A17 · SHOULD · Spoken labels say what the screen means: units in words, fractions as "of", and "—" as "unknown".**
- **In Yumo:** "—" → "unknown", never "em dash" or "0"; "P 8 · C 17 · F 1" → "protein 8 grams, carbs 17, fat 1"; "1,657 / 2,950" → "1,657 of 2,950 calories"; "−0.5 kg / wk" → "minus 0.5 kilograms a week"; "kcal" → "calories". Build spoken forms into the Fmt formatters so every screen gets them.
- **Why:** Labels describe purpose, not glyphs (Apple HIG VoiceOver); decision 11's "—" means nothing spoken as "em dash".
- **Check:** VoiceOver on Food page Nutrients (Fibre "—"), Summary and the hero says "unknown", "of" and "grams".
- **Status:** breaks — no spoken forms · Phase 1.

**A18 · MUST · Every chart, ring, bar and sparkline has a one- or two-sentence text summary of its numbers and trend; axis ticks are hidden.**
- **In Yumo:** LineChart (ProgressScreen.swift:196): "Weight, last month: 121.4 to 120.7 kg, trend down 0.5 kg a week". MacroDonut (SummaryScreen.swift:136): "Protein 35%, carbs 34%, fat 31% of 1,657 calories". Also BarRow (ProgressScreen.swift:258), ProjectionChart (WeeklyReviewScreen.swift:261), and Ring, StackedBar, Bar and Sparkline in Components.swift.
- **Why:** Text alternatives for non-text content are WCAG AA 1.1.1 (standard); Domino's was litigated over missing alt text.
- **Check:** VoiceOver on Progress: each chart is one stop with a sentence; each chart struct has an accessibilityLabel.
- **Status:** breaks — charts expose stray axis numbers · Phase 1.

**A19 · SHOULD · Charts people act on let VoiceOver and switch users explore single points.**
- **In Yumo:** `.accessibilityChartDescriptor` (date × kg, weights and trend as series) on the weight LineChart and the review's ProjectionChart, or move them to Swift Charts restyled in sand, which brings audio graphs (open question 56). The drag scrub (ProgressScreen.swift:240) gets an adjustable alternative that reads each point.
- **Why:** A drag-only scrub shuts out switch and VoiceOver users (WCAG 2.5.7, standard); going beyond a summary is a heuristic.
- **Check:** Rotor › Audio Graph › Play works, or swiping reads "Mon 19 Oct, 121.2 kg".
- **Status:** breaks — custom Path drawings, no descriptor · Phase 1.

**A20 · SHOULD · A control's spoken name starts with its visible text, and icon-only controls get short input names people would say.**
- **In Yumo:** Text buttons keep their visible words ("Log", "View summary", "Edit staples"); back links say "Progress", not "‹ Progress". `.accessibilityInputLabels`: ScanButton "Scan", "Barcode"; CogButton "Settings", "Gear"; SparkleButton "Your day", "Plan", "Sparkle"; CloseButton "Close"; AddChip "Add", "Add to Breakfast".
- **Why:** Voice Control reads the same metadata as VoiceOver, so one label serves both (Apple HIG).
- **Check:** Voice Control "Show names" on Today, Add and the Food page: every control has a sayable name; "Tap Scan" opens the scanner and "Tap Your day" opens the sheet.
- **Status:** partly — ✕ and + have no name; the ✦ is called "I prepped…" · Phase 1.

**A21 · MUST · With Reduce Motion on, slides, rises, scales, flips, rolling digits and parallax become short fades or instant changes, springs lose their bounce, decorative motion is skipped, and every animated change ends in a still state that carries the meaning.**
- **In Yumo:** Read `accessibilityReduceMotion` once in the Motion layer (e.g. Motion.reduced → `.easeInOut(duration: 0.2)` and .opacity). Under it: the onboarding .move, dayTransition's ±14 pt, PushPage's 12 pt rise, Expandable's 8 pt and the StreakPill's FlipIn (TodayScreen.swift:54,290) become fades; CountUpText uses `.contentTransition(.numericText())` or snaps; tabPop, the ProgressBarsGlyph regrowth, the twinkle, the nudge, the hero pulse and TourFinish are skipped; the tour glide fades; charts appear already drawn; overshooting curves don't overshoot. Still states already carry the meaning (the ticked circle, the filled bar, the red hero, the nudge's text): keep it so.
- **Why:** MUST via hard rule 8 (accessibility in v1); WCAG 2.3.3 is AAA, so the level doesn't come from WCAG. iOS 7's zooms and parallax caused reported dizziness and nausea until Apple swapped in fades (press reports); 3.5% of one large app's users run Reduce Motion (telemetry).
- **Check:** `grep -rc accessibilityReduceMotion Yumo` totals ≥ 1, in the Motion layer; with Reduce Motion on, go through onboarding, change day, open a food, log, switch tabs and finish the tour: nothing but fades.
- **Status:** breaks — the setting is never read · Phase 1.

**A22 · MUST NOT · Nothing flashes more than three times a second.**
- **In Yumo:** The twinkle, the hero hit pulse, the torch toggle, the review tick and the scanner brackets turning green are single events. No blinking loading, scanning or error states, no repeatForever opacity loops.
- **Why:** WCAG 2.3.1's three-flash limit (standard).
- **Check:** `grep -rnE 'repeatForever|Timer.publish' Yumo`, each hit reviewed; screen-record the scanner lock and the tour finish on a device.
- **Status:** meets in code; the scanner lock not yet recorded on a device (P14) · Phase 4.

**A23 · SHOULD · Reduce Transparency makes every custom translucent surface opaque.**
- **In Yumo:** TabBar (surface at 0.94 over .ultraThinMaterial) and the inline title bar switch to solid surface when `accessibilityReduceTransparency` is true; the scrims (backdrop, tourScrim) may stay.
- **Why:** 2.6% of one large app's users run it (telemetry); custom materials don't adapt by themselves (WWDC25 219).
- **Check:** `grep -rn accessibilityReduceTransparency Yumo` ≥ 1; with the setting on, the tab bar is opaque over a scrolled list.
- **Status:** partly — the bars are 94% opaque; the setting is never read · Phase 1.

**A24 · SHOULD · Bold Text steps every custom font up one weight.**
- **In Yumo:** Apply tokens through a `.yumoFont(_:)` modifier that reads `legibilityWeight`; under .bold, Nunito steps medium → semibold → bold → extrabold → black. NumberField checks `UIAccessibility.isBoldTextEnabled`.
- **Why:** Bold Text is an iOS setting a design must survive, and custom fonts ignore it (Apple Support, platform).
- **Check:** `grep -rnE 'legibilityWeight|isBoldTextEnabled' Yumo` ≥ 1; with Bold Text on, Today and the Food page are visibly heavier.
- **Status:** breaks — Nunito ignores Bold Text · Phase 1.

**A25 · SHOULD · Button Shapes gives every text-only button an underline or a tinted capsule.**
- **In Yumo:** Read `accessibilityShowButtonShapes` in TextAction, the back link, AskFooter, SourceLine, "Switch to cooked?", the calendar's "Today", the toast's Undo, "Dismiss for now", "See all ›" and "Edit staples".
- **Why:** A listed iOS setting (Apple Support); weak signifiers cost ~22% longer on findability tasks across nine web pages (NN/g, 71 people; V14).
- **Check:** `grep -rn accessibilityShowButtonShapes Yumo` ≥ 1; with Button Shapes on, every text action on the Food page, Your day and Settings has a shape.
- **Status:** breaks — never read; TextAction is colour only · Phase 1.

**A26 · SHOULD · Smart Invert leaves photos, the camera preview and the brand mark alone.**
- **In Yumo:** `.accessibilityIgnoresInvertColors()` on progress photos (WeightLogScreen.swift:53,69; LogWeightSheet.swift:37), the BarcodeScanner preview and YumoMark.
- **Why:** One of the iOS settings a design must survive (Apple Support).
- **Check:** `grep -rc accessibilityIgnoresInvertColors Yumo` totals ≥ 3; with Smart Invert on, a progress photo and the scanner look normal.
- **Status:** breaks — nothing excluded; not tried on a device · Phase 1.

**A27 · MUST NOT · No custom multi-finger gestures; every path gesture (swipe, drag) has a single-tap alternative (A12, N21).**
- **In Yumo:** One-finger taps and pans plus the system's two-finger escape only: no pinch-zoom charts without +/−, no two-finger swipes. Swipe rows, the ruler, macro tiles and the chart scrub stay single-finger, each with its alternative.
- **Why:** Switch, eye-gaze and head-pointer users can't perform them (brief checklist; WCAG 2.5.7, standard; WCAG 2.5.1 Pointer Gestures, outside the brief).
- **Check:** `grep -rnE 'MagnificationGesture|RotationGesture|numberOfTouchesRequired|minimumNumberOfTouches' Yumo` returns 0; every swipe and drag has an alternative (A12's check).
- **Status:** partly — no multi-finger gestures; swipe and drag alternatives are missing (A12) · Phase 1.

**A28 · MUST NOT · Declare an App Store Accessibility Nutrition Label only for a feature whose every common task passes on a device, and withdraw it when a regression ships.**
- **In Yumo:** Nothing is declared today, which is right. Likely order: Dark Interface (after a system-Dark pass of every screen including toasts, tour and tooltip), Sufficient Contrast (after V1–V5), Reduced Motion (A21), Larger Text (A1–A3 at AX5), then VoiceOver and Voice Control (P13). Declare from the latest dated checklist (P19), never from intent.
- **Why:** A label counts only if all common tasks can be done with the feature, and App Review can challenge claims (App Store Connect, platform requirement).
- **Check:** Each declared feature has every task at "meets" with a device and date in the latest check file.
- **Status:** meets.

**A29 · SHOULD · A dated accessibility statement in the app lists what works, known issues with fix dates, a target and a contact.**
- **In Yumo:** A Settings › About › "Accessibility" row (SettingsScreen.swift:53-68 has none): "Last checked {date}, build N"; the target (e.g. WCAG 2.2 AA plus every main task with VoiceOver and at AX5 by a date); known issues taken from rules marked breaks or partly ("Charts can't be read with VoiceOver yet"); a contact. Regenerated from the latest checklist.
- **Why:** UK public-sector rules require one, and Starling and Monzo publish dated ones (regulator, company practice); it makes regressions a diff.
- **Check:** The row exists and its date matches the newest docs/checks file.
- **Status:** breaks — no statement · Phase 4.

**A30 · MAY · Logging may also work through a route that doesn't need finding small targets, typed or spoken.**
- **In Yumo:** Type it (one-line logging) behind Features.typeIt; an App Intent or Siri Shortcut ("Log 2 eggs to breakfast") would add a voice path.
- **Why:** Apple Design Award inclusivity winners pair Dynamic Type and VoiceOver with a second way into the core task (Apple Newsroom).
- **Check:** If enabled, a VoiceOver user logs a meal this way in fewer steps than through search.
- **Status:** n/a — decision 1 keeps Type it off; a MAY needs no phase.
- **Exception:** Decision 1 (Type it off because it confused new users; flags are flipped, never deleted). Revisit after TestFlight as an opt-in, or on while VoiceOver runs (open question 61).

---

## Ethics & habits (E)

**E1 · MUST · Deleting the account happens in the app, takes no more steps than signing up, and removes everything it says, with no retention screen on the way.**
- **In Yumo:** Settings › Delete account → one system alert → done: 4 taps from Today against ~12 onboarding screens. Store.deleteEverything() empties all 12 @Model types (keeping the bundled generic and chain rows, with their use history reset) and clears PendingLookups and every pending and delivered notification (Store.swift:232-257). It doesn't remove the samples Yumo wrote to Apple Health, while the alert says "All your data is deleted" (SettingsScreen.swift:100): delete them or say they stay (I29, open question 34). Never a survey, offer or second page before the alert.
- **Why:** Exit at least as easy as entry is the brief's converging rule (FTC v Amazon under ROSCA; DSA Article 25 on cancellation, regulator). For account deletion the binding rule is App Review 5.1.1(v) (outside the brief, to verify). The message must be true (I30).
- **Check:** Fresh install: taps from Today to a deleted account ≤ onboarding screens; unit test: after deleteEverything, every @Model fetch except generic and chain Food is empty and pendingNotificationRequests() is empty; after delete, HealthSync finds no samples from this source, or the alert says they stay.
- **Status:** partly — complete inside the app since Phase 0; Apple Health samples survive an alert that promises all data · Phase 3.

**E2 · MUST · If Yumo sells a subscription, cancelling it is reachable in the app in no more steps than buying it, with no retention screen.**
- **In Yumo:** A future Plus tier (isPlus = true for everyone today, Models.swift:64) ships with Settings › Account › "Manage subscription" opening StoreKit's manageSubscriptionsSheet directly, with no offer, survey or "are you sure" first.
- **Why:** The Amazon Prime settlement ($2.5bn, under ROSCA) targets exits harder than sign-up (regulator); the UK DMCC subscription regime, expected in January 2027, requires online exit for online sign-up, with fines up to 10% of global turnover.
- **Check:** On a device, count taps from Today to a purchase and from Today to Apple's cancel sheet: cancel ≤ buy.
- **Status:** n/a — nothing is sold yet.

**E3 · MUST · Every purchase button names what is bought, the price and the period; auto-renewal and total cost show before any charge; no single accidental tap can charge.**
- **In Yumo:** A future paywall button reads like "Start 7-day free trial, then £X.XX a year", with the price, period, first renewal date and "Renews until you cancel in Settings" right above it, without scrolling at Large and AX5. Always StoreKit's system confirmation. No plan pre-selected unless its total shows on it. No purchase requires a Yumo account first: StoreKit's Apple ID purchase is the guest path, and any account ask after it follows I2's soft wall (brief ch. 4: guest checkout as the prominent path).
- **Why:** Epic paid $245m over one-press charges (FTC); hidden information roughly doubled acceptance, to 30.1% (Luguri and Strahilevitz 2021, experimental).
- **Check:** Paywall screenshots at Large and AX5; a tester reads the button and correctly predicts the charge; buy Plus on a fresh install without making an account.
- **Status:** n/a — no paywall.

**E4 · MUST NOT · No countdowns, "offer ends", "only N left" or social-proof pressure unless the deadline or limit is real and provable.**
- **In Yumo:** Nothing in Yumo is scarce. The weekly review's real Tuesday 06:00 expiry may be stated plainly ("Open until Tuesday"), never as a ticking countdown. No "N people logged this today".
- **Why:** A countdown timer had no effect (p = 0.78; Luguri and Strahilevitz, experimental); the CMA won over £4m in Wowcher refunds over urgency claims (regulator).
- **Check:** `grep -rniE "countdown|hurry|only [0-9]+ left|ends in|last chance|limited time" Yumo --include='*.swift'` returns no user-facing hits.
- **Status:** meets.

**E5 · MUST · When the user chooses between accept and decline, now and later, or keep and stop, every option is visible, at least 44 pt, at least 4.5:1, and no smaller than its sibling.**
- **In Yumo:** The decline, exit or later option is a SecondaryButton the height of the PrimaryButton beside it, or at least a 44 pt TextAction in ink, never inkMuted on bg (2.85:1) or a ~20 pt red link. Breaks: the review's "Dismiss for now" (inkMuted, 2.85:1, WeeklyReviewScreen.swift:68); "Skip tour" (13 pt and ~30 pt tall beside a filled Got it, TourOverlay.swift:64); the supplement nudge's bare muted "Not now" (3.54:1) beside a filled Add (NutrientsScreens.swift:88); "Never suggest" as a ~20 pt danger link at 4.05:1 (BalanceSheet.swift:164). The model: Apply and Keep, both 56 pt, both naming their numbers.
- **Why:** Mild interface interference raised acceptance from 11.3% to 25.8% and lowered people's sense they could refuse (Luguri and Strahilevitz 2021, experimental); DSA Article 25 names prominence tricks (regulator).
- **Check:** On every decision screen, both options' hit frames are ≥ 44 pt and equal in height (Accessibility Inspector), and their text is ≥ 4.5:1 in both themes.
- **Status:** partly — Apply/Keep and Decide later are fair; four declines aren't · Phase 3.

**E6 · MUST NOT · Nothing that benefits Yumo is pre-selected; a default that serves the user is marked "Recommended" with its reason.**
- **In Yumo:** Reminders are off by default; Apple Health is asked for on tap; onboarding answers follow I5. The review's stall page pre-selects Diet break (stallChoice = .dietBreak, WeeklyReviewScreen.swift:15) with no tag → "Recommended" plus a reason, or nothing selected (open question 28). A future paywall has no pre-ticked annual plan, trial or add-on; any analytics or marketing consent starts unticked.
- **Why:** Pre-selection exploits default bias, and 95% of 240 popular apps contained deceptive patterns (Di Geronimo et al.; Brignull, Gray and Mathur taxonomies).
- **Check:** Grep the @State initialisers of choice enums (e.g. StallChoice): each is marked Recommended or starts nil.
- **Status:** partly — the stall page pre-selects Diet break unmarked · Phase 3.

**E7 · MUST NOT · Declines and status copy never shame, guilt or threaten.**
- **In Yumo:** The copy rule in Review.swift:129 (never "slipped", "missed", "failed", "only") applies app-wide. Declines stay neutral ("Not now", "Decide later", "Skip"); over target shows the number in danger colour, never a verdict; unlogged days "don't count either way" (Review.calorieNote); a future paywall says "Maybe later", never "No, I'll stay stuck".
- **Why:** Confirmshaming works through guilt (Brignull); even mild patterns lowered people's willingness to come back (experimental); hard rule 9.
- **Check:** `grep -rniE '"[^"]*\b(missed|failed|slipped|lost your|give up|are you sure)\b[^"]*"' Yumo --include='*.swift'` finds quoted words only in comments (today only Review.swift:129's copy rule); read every alert and decline aloud.
- **Status:** meets.

**E8 · MUST · Nothing consequential (calorie target, macros, staples, planner memory, data sharing) changes without a tap that names the change.**
- **In Yumo:** Adaptive proposals wait in pendingTo until Apply (Expenditure.swift:46,54-60); stall options never auto-apply; "Never suggest" is always an explicit tap, never inferred from a swap (decision 7); Keep says it makes a staple. Auto-adjust, smarter suggestions and Plus follow the same rule.
- **Why:** Consent obtained through friction or visual tricks isn't consent (FTC v Amazon; DSA Article 25, regulator).
- **Check:** Unit test: Expenditure.evaluate never changes store.targets().kcal; every setPreference( and addStaple( call sits inside an explicit Button action.
- **Status:** meets.

**E9 · MUST · The streak survives one missed day in seven.**
- **In Yumo:** Store.streak(today:) (Store.swift:84-91) counts consecutive logged days, so one gap drops the StreakPill (shown at ≥ 2, TodayScreen.swift:54) to nothing. Allow one gap per 7 days, or show "6 of 7 days" to match the review's 5-of-7 rule (rolling or calendar week is open question 63). The pill can't be tapped, so if V15 is adopted it goes flat.
- **Why:** MUST via decision 16 (23 Oct). Duolingo's streak gains were small (+1.7% week-one retention; double freezes +0.38% DAU) and leaned on freezes, and the pull of a streak decays as the stake grows (company-reported); the brief says to ship slack with any streak.
- **Check:** Unit test: logged on D-9…D-1 except D-4 gives a streak ≥ 8, not 3; two gaps within 7 days resets it.
- **Status:** breaks — decision 16 not built · Phase 3.

**E10 · SHOULD · A token log can't earn a streak day, and one definition of "a logged day" feeds both the streak and measured maintenance.**
- **In Yumo:** Any day with one entry counts for the streak (Store.swift:79-82), and Expenditure counts any day with kcal > 0 (Expenditure.swift:31-34), so a coffee logged to save the streak drags meanIntake, measured maintenance and the proposed target down. Define "a logged day" once (open question 64) and call one function from both.
- **Why:** Given free choice, many Duolingo users did only very easy lessons to keep the streak (company-reported); the data bar: never a wrong number.
- **Check:** Unit test: five single-entry 50 kcal days don't count as five logged days for Expenditure; the streak and Expenditure share one function.
- **Status:** breaks — token days count for both · Phase 3.

**E11 · SHOULD NOT · Never defend a streak with fear: no streak-at-risk pushes, no "you lost your streak" screens, no paid restores or freezes.**
- **In Yumo:** Today the pill simply disappears below 2, and the only notifications are the two reminders (Services.swift:26-27). Keep it so; a future Plus sells no freezes or restores.
- **Why:** Snapchat sells streak restores; in 2,483 adolescents, streak engagement correlated weakly with problematic phone use and fear of missing out (van Essen and Van Ouytsel 2023, correlational); hard rule 9.
- **Check:** `grep -rni streak` over notification bodies, alerts and StoreKit products returns 0; in the simulator, move the clock past a missed day: nothing mentions the streak.
- **Status:** meets.

**E12 · MUST NOT · Never celebrate how often the user does a consequential thing; praise only reaching the outcome they chose, never movement against their goal.**
- **In Yumo:** The consequential acts are cutting calories, lowering the target and losing weight. Keep: the hero pulse fires only within ±40 kcal of target (TodayScreen.swift:184-190); target changes get neutral toasts; the tour finish plays once. Fix: the review praises any week without a gain ("That's a good week.", "Your first full week down.") whatever the GoalMode, and on Bulk calls a gain "water, salt… not fat" (Review.swift:107,132,141,143). No confetti, badges or haptics for a lower target, a deeper cut or a faster loss, and nothing that grows with logs per day.
- **Why:** Massachusetts charged Robinhood over trade confetti; it paid $7.5m and agreed to stop celebrations tied to how often people trade (regulator); hard rule 9.
- **Check:** Debug "Preview weekly review" for each GoalMode × {loss, flat, gain}: praise appears only when the trend moved toward the chosen goal.
- **Status:** partly — the review praises loss for Bulk and Maintain users · Phase 3.

**E13 · SHOULD · Engagement work makes the next action cheaper; no points, badges, levels, leaderboards or invite rewards.**
- **In Yumo:** The levers are the meal + (one tap logs the last amount), Recent, scan-to-log with Undo and Your day's plan. Every engagement idea names the next action it makes cheaper.
- **Why:** Duolingo's big gains came from changing the next action (delayed sign-up ~+20% DAU), while a moves counter was neutral and referrals added ~3% of users (company-reported).
- **Check:** `grep -rnwiE 'badges?|leaderboard|xp|level up' Yumo --include='*.swift'` returns nothing ("points" is left out: Yumo's chart code uses the word).
- **Status:** meets.

**E14 · SHOULD · Notifications go out only for events the user switched on, off by default and asked for in context; never re-engagement, streak, promotional or "we miss you" pushes.**
- **In Yumo:** Two local reminders, Log weight and Log dinner, both off, with permission asked at the first switch-on (Services.swift:10-28, SettingsScreen.swift:43-44); sign-out and delete cancel them all (Services.swift:32). A new push type gets its own Settings › Reminders switch, off by default.
- **Why:** Irrelevance and frequency are the top reasons people opt out (Airship 2025, Braze, company-reported), and iOS has a one-tap kill for the whole app. Outside the brief, to verify: App Review 4.5.4 limits promotional pushes to people who opted in; if confirmed, this rule becomes MUST.
- **Check:** Every UNNotificationRequest identifier maps to a profile switch that defaults to false; a fresh install shows no prompt until a switch is tapped.
- **Status:** meets.

**E15 · SHOULD · A reminder says something about the user's day and doesn't fire once the job is done.**
- **In Yumo:** Replace the daily repeating trigger (repeats: true, Services.swift:24) with requests for each of the next 7 days; remove a day's "dinner" once dinner has an entry and its "weight" once there's a weigh-in; build the text from the day ("Dinner's still open"), within what Sid allows on the lock screen (open question 67). Offer the reminder once in context after the first weigh-in, not only in Settings.
- **Why:** Personalised messages raised opens 37% (Airship 2025, company-reported); irrelevant ones drive opt-outs.
- **Check:** Log dinner on a device, then list pendingNotificationRequests: today's dinner request is gone.
- **Status:** breaks — a generic "Log dinner." fires even when dinner is logged · Phase 3.

**E16 · SHOULD NOT · No screen that serves Yumo (rate us, upsell, what's new, a widget pitch) sits between the user and the task they opened the app for.**
- **In Yumo:** Launch goes straight to Today (or onboarding). A future What's new, Plus offer or widget pitch goes in a dismissible Today card or in Settings, never a launch modal or cover. Judge any such surface by daily use, not its own click-through (P24).
- **Why:** Google+'s install interstitial converted 9% while 69% left the page; a banner instead raised one-day actives 17% (Google, company-reported).
- **Check:** Cold launch after an update and on each weekday: the first screen is Today with the meal + one tap away.
- **Status:** meets.

**E17 · SHOULD NOT · Even helpful full-screen content doesn't open by itself before the user has done what they came to do.**
- **In Yumo:** The weekly review opens 400 ms after the first return to Today after Monday 06:00 (TodayScreen.swift:149-151), exactly when people open Yumo to log breakfast or weigh in; the tour starts by itself after onboarding (YumoApp.swift:98-100). Prefer the ReviewChip ("Your week is ready ›") or open the review after Monday's first log. Never a What's new, rating prompt or promotion at launch.
- **Why:** Google+'s interstitial pushed 69% out of their task (company-reported); never show alerts at launch (Apple HIG).
- **Check:** Cold launch on a device at 07:00 on a Monday: breakfast can be logged without first leaving a full-screen review; at most one automatic presentation a week.
- **Status:** partly — the Monday review lands before the first task · Phase 3; the auto-starting tour is decision 15's (I6).
- **Exception:** Decision 10 (handoff rev 10: the review opens once on Monday) and decision 15 (the tour stays). Revisit the review after a TestFlight comparison of Monday logging (auto-open, chip, or after the first log); the tour with the backend.

**E18 · MUST · App Store ratings are asked for only with the system prompt, only after real use, never on first launch, never as a condition of anything and never behind a custom pre-prompt.**
- **In Yumo:** When added: SwiftUI's requestReview once, at a calm moment after a success (e.g. straight after finishing a weekly review), past an engagement threshold (open question 65), in a session with no errors. Never during onboarding, the tour, mid-sheet or after an Undo; no "Enjoying Yumo?" filter.
- **Why:** Apple caps the prompt at 3 a year and bars custom prompts and review-gating; asking too early invites bad reviews (App Review, Apple HIG).
- **Check:** `grep -rnE "requestReview|SKStoreReviewController" Yumo` finds one call behind an engagement guard; week one never sees it.
- **Status:** meets — no rating request yet.

**E19 · MUST · No path sets or proposes a calorie target below the safety floor, Calc.floor(for: sex) (1,500 kcal for men, 1,200 for women); safety floors and signposting are never weakened.**
- **In Yumo:** The floor (Calculations.swift:6,23, "NIH guidance floors") is applied in onboarding (OnboardingFlow.swift:27,154), the automatic target (Calculations.swift:49,79), the Calorie target override (CalorieTargetScreen.swift:22; the − stepper stops at it) and the adaptive proposal (Expenditure.swift:80). Any new path (Macros, a Plus plan, Type it) goes through the same function. Yumo has no eating-disorder signposting today; whether it needs a written safeguard policy is open question 68.
- **Why:** Hard rule 9: the eating-disorder safeguards are never weakened; the data bar: a target is a number people act on.
- **Check:** Unit test: Expenditure.evaluate, the Calorie target override, Calc.automaticTarget and createAccount() never yield kcal < Calc.floor(for: sex), for every GoalMode and pace.
- **Status:** meets by code reading (the paths above); the unit test doesn't exist yet · Phase 4.

---

## Change & process (P)

**P1 · MUST · When sources disagree, follow them in this order: Sid's own words, then this rule book, then the design handoff and prototype, then platform defaults; a lower source never silently overrides a higher one.**
- **In Yumo:** 1) Sid in chat, his hard rules, and the decisions register (below; to move to docs/DECISIONS.md). 2) This book. 3) Handoff rev 2–11: the Design System artifact, ds3 README and screens.md, and Theme.swift and Components.swift as built; inside this layer "the prototype wins over the docs", and a newer rev beats an older one. 4) Apple HIG and SwiftUI defaults. The as-built spec page and Settings › Design system (debug) describe what is built; they follow and never lead. README.md:5 still calls the Design System artifact the "source of truth" and must name this order instead. When Sid's call breaks a rule, Claude says so with reasons first (P2), then does what Sid decides.
- **Why:** The brief grades evidence; a handoff is unmeasured taste, so it ranks below evidence-based rules and above bare defaults (governance, heuristic).
- **Check:** README.md and docs/RULEBOOK.md state the order; `grep -rn "source of truth" README.md docs/` returns only it; each CHANGELOG conflict says which level won.
- **Status:** partly — README.md:5 names the DS artifact · Phase 4.

**P2 · MUST · A handoff value or a request that breaks a MUST goes to Sid with the rule, the measured number and a recommendation; Claude neither complies nor fixes silently, and records what Sid decides.**
- **In Yumo:** ds3 README:27 already set the pattern: green text (2.0:1) and muted captions (3.3:1) fail AA, so raise it as a decision rather than re-tint. Decision 13 settled button labels; green used as text (V3) and inkMuted (V2) are still open (open questions 35, 36). Every CHANGELOG entry that brings in a handoff rev carries a "Conflicts with MUST" line: the rule, the number and Sid's dated decision.
- **Why:** Hard rule 5 (ask when unsure) and Sid's wish for disagreement with reasons; the contrast and label MUSTs rest on WCAG 2.2 AA as hard rules 6 and 8 adopt it.
- **Check:** The contrast test (P12) shows no failing pair without a dated exception or a pending-decision note.
- **Status:** partly — two contrast conflicts undecided · Phase 1.

**P3 · MUST · Every deliberate departure is written onto its rule as an exception that cites the decision and its rule-specific revisit; the date and Sid's reason in his words live once in the register; the rule itself stays.**
- **In Yumo:** On the rule: "Decision 3 (no Done bar): revisit if VoiceOver can't dismiss the keypad." In the register: the date, Sid's words, every rule the decision departs from or builds, and a trigger or "none needed". Decisions 1–19 are in the register below. Audits report a departure as a tension to weigh, never as an oversight.
- **Why:** Deleting a rule for a decision hides what the decision costs; the brief keeps evidence and taste apart (governance).
- **Check:** Both ways: every Exception that names decision N is listed in row N, and every rule in row N's departures names decision N in its Exception (a script over docs/RULEBOOK.md reports 0 mismatches); `git log -p docs/RULEBOOK.md` shows no rule deleted, only retired.
- **Status:** meets in this book (checked both ways on 23 Oct); keep it so · Phase 4.

**P4 · MUST · The rule book, the decisions register and every dated checklist live in the repo, versioned with the code.**
- **In Yumo:** docs/RULEBOOK.md, docs/DECISIONS.md, docs/checks/<build>.md, and a text copy of the brief in docs/brief/ so rules can still cite it. Today the brief, CONTEXT.md, result.json and the 47 screenshots exist only in the /private/tmp scratchpad, which macOS can purge. The audit page (claude.ai/artifact/9zEKLMXXeyauEAuXRBnC6b) is a view of the record, not the record.
- **Why:** Keep a dated copy of the completed checklist with each build, so a regression is a diff (brief checklist).
- **Check:** `git ls-files docs/` lists RULEBOOK, DECISIONS and checks/; `grep -rn "/private/tmp" docs/ README.md` returns 0.
- **Status:** breaks — the repo holds only CHANGELOG.md, README.md and docs/TESTFLIGHT.md · Phase 4.

**P5 · MUST · A rule is added, changed, re-levelled or retired only with its evidence (source, kind, number), Sid's sign-off in chat and a dated line in the changelog; afterwards every screen's status for that rule is re-checked.**
- **In Yumo:** Claude may propose; only Sid signs off. Changelog line: "v1.1 · <date> · T3 56 → 60 pt · evidence: … · Sid: '…'". A retired rule keeps its number: "retired <date> — why". A new brief or handoff rev starts a review, never an automatic edit.
- **Why:** Famous "laws" drifted into folklore for decades because nobody re-checked the sources (Doherty, Miller, Zeigarnik; brief chapter 1).
- **Check:** `git log -p docs/RULEBOOK.md`: every rule diff has a matching changelog line with its evidence and sign-off.
- **Status:** meets — new with this edition.

**P6 · MUST NOT · Never cite a debunked or misquoted "law" as a reason in rules, code comments, the CHANGELOG or decisions.**
- **In Yumo:** Say instead: "visual search is linear" (not Hick's law); "sub-second; Apple: under 100 ms a tap, a hang at 250 ms" (not Doherty's 400 ms); "about four chunks across screens" (not Miller's seven); "Ovsiankina resumption" for the review and tour reopening where they were left (not Zeigarnik); "accuracy is best in the centre and worst in the corners: 9–10 mm in the body (Parhi et al., experimental), ~12 mm in corners and top or bottom strips (Hoober, proprietary data)" (not thumb-zone maps); never "100 ms costs Amazon 1%". "Things we don't say" has the full list.
- **Why:** Each is source-checked as wrong or misquoted in the brief (chapters 0–1).
- **Check:** `grep -rniwE "hick|doherty|zeigarnik|miller" --include='*.swift' --include='*.md' --exclude-dir=brief --exclude=RULEBOOK.md .` and `grep -rniE "thumb.?zone|magical number" --exclude-dir=brief --exclude=RULEBOOK.md .` return nothing.
- **Status:** meets — 0 hits on 23 Oct.

**P7 · SHOULD · Fix in order of measured impact: wrong data first, then hidden or unlabelled primary navigation, targets under 9 mm, text that truncates at large sizes, unlabelled icons, forced sign-up before value, and a cancellation path longer than sign-up.**
- **In Yumo:** Wrong kcal or lost history jumps the queue, as Phase 0 did. Then: (1) the unlabelled ✦, saved meals only in Settings, no edge-swipe back (N2, N3, N6); (2) targets under 9 mm: TextAction ~20 pt, AddCircleButton 36, ScanButton 36/40, StepperButton 44 × 36, Segmented ~34, the Your day pill 34 (T1, T2), and every hit area under 56 pt (T3, the 9 mm rule); (3) no relativeTo:, nothing stacks (A1–A3); (4) unnamed ✕, +, −/+, torch and switches, and icons with no word (A4, A5, V32); (5) the account step (I1); (6) none: Delete account is 4 taps (E1).
- **Why:** Hidden menus were used in 57% of tasks against 86% for visible-plus-menu navigation (NN/g, 179 people), and 2.4 mm targets gave 29–38% errors (Bi, Li and Zhai): experimental. The sign-up item is company-reported.
- **Check:** Each phase plan and check file groups open items by these classes; no lower class starts while a higher class has an open small fix, unless an exception says why.
- **Status:** partly — Phase 0 done; classes 1–4 open; class 5 held by decision 15; class 6 passes.
- **Exception:** Decision 18 (the phase order Sid approved with the audit plan): Phase 1 shared components runs before Phase 2 navigation because most fixes land in Components.swift and Theme.swift. Whether the "✦ Your day" chip moves into Phase 1 is open question 15. Decision 15 holds class 5 until the backend work.

**P8 · MUST · Every UI change records in its dated CHANGELOG entry which rules it touches and their status before and after; a change that makes a MUST worse doesn't ship without a recorded exception.**
- **In Yumo:** CHANGELOG.md entries already give the date, the build and Sid's reason in his words; add one line, e.g. "Rules: T1 breaks → meets (AddCircleButton 36 → 44 pt); A4 meets; parity list below (P21)." Commit only after the build gate (P9); Sid commits unless he says otherwise (hard rule 7).
- **Why:** Run the checklist each release so regressions are diffs (brief); hard rule 8: better not done than half-done.
- **Check:** From this book's date on, every CHANGELOG entry that touches Yumo/Screens or Yumo/Theme has a "Rules:" line.
- **Status:** breaks — no entry cites rules yet · Phase 4.

**P9 · MUST · Nothing is called done, installed, screenshotted or committed until the build succeeds, judged by its exit status, not a filtered log.**
- **In Yumo:** `xcodegen generate && xcodebuild -scheme Yumo -destination 'platform=iOS Simulator,id=1BB5E506-18F5-4A82-96EA-47EF6833BFEC' build` exits 0 and prints BUILD SUCCEEDED. Scripts/testflight.sh:11-12 pipes the archive into `grep … || true`, so a failed archive surfaces only later at export with a misleading message → `set -o pipefail` or test the archive's status. Once a test target exists, `xcodebuild test` joins the gate (P11).
- **Why:** Hard rule 4: gates stay green and the exit code is never lost; a broken commit once slipped through when grep exited 0.
- **Check:** `zsh -c 'set -o pipefail; xcodebuild … build | tail -3'; echo $?` prints 0; testflight.sh sets pipefail or checks the archive's status.
- **Status:** partly — gated by hand; testflight.sh hides the archive's status · Phase 4.

**P10 · MUST · Before each TestFlight upload, every screen changed since the last upload is captured at Large, extra-small and AX5, light and dark, on a 6.9″ and a 6.1″ simulator, plus the iPhone SE for screens with number rows; no truncation, overlap or broken words, and rows stack at accessibility sizes.**
- **In Yumo:** iPhone 17 Pro Max 1BB5E506 (440 × 956 pt) and iPhone 17e C66AE255, iOS 26.4: 12 shots per changed screen. iPhone SE (3rd gen, 375 pt; none is installed: `xcrun simctl create "SE3" "iPhone SE (3rd generation)" com.apple.CoreSimulator.SimRuntime.iOS-26-4`) for Calorie target, onboarding (About you, Weight, Your plan) and the Food page at Large, xLarge, xxxLarge and AX5. A change to Components.swift or Theme.swift touches every screen: it adds the reduced set (Today, Add and the Food page at Large and AX5, light and dark, on the 17e), and the full matrix of every screen runs at the end of each phase (P18 tier 3). Sizes: `xcrun simctl ui <udid> content_size large | extra-small | accessibility-extra-extra-extra-large`; dark: `xcrun simctl ui <udid> appearance dark` with Yumo on System (the in-app toggle once hid the toast-window bug); if it doesn't take (it stopped working on 1BB5E506 on 22 Oct), launch with `-yumo.appearance dark` and note it. Files named <screen>-<phone>-<size>-<appearance>.png in the build's check folder. If a size doesn't take after a relaunch, toggle it off and on (seen 22 Oct).
- **Why:** 31% of one large app's users ran a non-default text size and 37% dark mode (telemetry); truncation at large text is one of three defects even accessibility-literate companies disclose (brief ch. 8); hard rule 8.
- **Check:** docs/checks/<build>/ holds 12 shots per changed screen (plus the reduced set for a Components or Theme change); the AX5 and extra-small shots show no "…", split words or titles over buttons.
- **Status:** partly — the 22 Oct capture covered default, xSmall, AX5 and dark on the 6.9″ only, with dark set in the app · Phase 4.

**P11 · MUST · Automated accessibility audits run on the main screens at Large and AX5, light and dark, before every TestFlight upload; a new issue blocks the upload unless it's on a dated allow-list.**
- **In Yumo:** A YumoUITests target in project.yml; one test per screen (Today empty and logged, Add, Food page, Your day, Summary, Progress, Log weight, Settings, Calorie target, Staples, onboarding steps, the weekly review, a tour stop) that launches with and without `-UIPreferredContentSizeCategoryName UICTContentSizeCategoryAccessibilityXXXL` and with `-yumo.appearance dark`, navigates there and calls `try app.performAccessibilityAudit()` (iOS 17+). Scripts/testflight.sh runs `xcodebuild test` before archiving and exits 1 on failure. The allow-list is docs/checks/allow.json, each entry with a date and a rule ID. Accessibility Inspector's audit at each tier-3 pass.
- **Why:** 52.5% of image buttons were unlabelled across 9,999 apps (Ross et al.), and Apple's tools catch these; the brief asks for audits in CI.
- **Check:** `grep -n "bundle.ui-testing" project.yml`; `grep -rc performAccessibilityAudit` over YumoUITests totals ≥ 10; testflight.sh calls `xcodebuild test`.
- **Status:** breaks — one app target, no tests, no CI · Phase 4.

**P12 · MUST · A contrast test runs on every token change and fails any pair below its level in either appearance.**
- **In Yumo:** A script or unit test (e.g. Scripts/contrast.swift parsing Theme.swift's hex) checks every text token (ink, inkMuted, accentText, danger, onAccent) on bg, surface, control, track, accentTint, dangerTint and panel, light and dark: text below WCAG's large size (24 pt, or 18.7 pt at Bold and heavier) at 4.5:1, so a token is held to 3:1 only if every use is large; marks (grabber, surfaceEdge, warning, glyphs) at 3:1; small custom text on dark at 7:1 (V6); the dark elevation order (V29); and the APCA Lc reported alongside (V7). It fails today on every pair named in V1–V8 and exits 1 on any failure without a dated exception or a pending-decision note (V2, V10).
- **Why:** Hard rule 6: contrast is enforced by a test in both themes; WCAG 2.2 AA 1.4.3 and 1.4.11 (standard).
- **Check:** Run it: it lists every pair with its ratio and Lc and exits 0.
- **Status:** breaks — no test exists · Phase 1.

**P13 · MUST · At the end of each fix phase and before any public release (P18 tier 3), the main tasks are done on a physical iPhone with VoiceOver and Screen Curtain, then with Voice Control, then with Switch Control, and each result is recorded.**
- **In Yumo:** Tasks: finish onboarding on a fresh install; log a food from search to Breakfast; scan, hear the toast, Undo; open Your day, fix an amount, Keep a suggestion; repeat yesterday's meal through the row's action; delete a logged food; log a weight other than the prefilled one; change the calorie target; read the weight trend; go through the weekly review; dismiss the decimal pad without a gesture; remove a supplement. Screen Curtain is a three-finger triple-tap. Record device, iOS version, and pass or fail per task and technology, with a note, in docs/checks/<build>.md. TalkBack and Accessibility Scanner are n/a (P28).
- **Why:** Automated audits miss announcements, focus order and gesture-only actions, which Starling and Monzo still disclose (company statements); the brief requires manual passes on devices.
- **Check:** The latest tier-3 check file has a dated row for each task × technology, naming the device.
- **Status:** breaks — never done; first due at the end of Phase 1 · Phase 4.

**P14 · MUST · An item not verified on a physical iPhone is recorded as "fail (unverified)", never passed; a pass needs evidence: a path:line, a computed number, a named screenshot or a dated device record.**
- **In Yumo:** Device-only items: grips and walking, tap latency, haptics, the barcode scanner and torch, VoiceOver, Voice Control, Switch Control, Increase Contrast, Bold Text with Nunito, Button Shapes, a toast with the keyboard up, launch time. The simulator counts for layout and contrast only. Sid's TestFlight use counts when he writes down what he checked on which build. In this book, a rule whose Check has a device step says which part is unverified (Fields).
- **Why:** Finger input adds ~1 mm of noise that a simulator click can't reproduce (Bi, Li and Zhai); the brief says to treat what you can't verify on a device as failed.
- **Check:** No device-only item in docs/checks/<build>.md says pass without a device and a date; the count of "unverified" is tracked build to build.
- **Status:** partly — the 22 Oct audit followed this; nothing verified on a device since · Phase 4.

**P15 · SHOULD · At the end of each fix phase and before any public release (P18 tier 3), the main tasks are run one-thumbed (each hand), cradled and two-thumbed, standing and walking, on a 6.1″ and a 6.9″ iPhone.**
- **In Yumo:** iPhone 17 Pro Max (6.9″) plus a 6.1″ phone (16e, or iPhone 11 at 326 ppi). Tasks: the meal +, search and log, scan, Food page Log with the keypad up, the Your day amount pill, Back (the edge swipe after N5), the cog, a week-strip day, a weight log. Count misses and regrips per task, grip and device; a task that needs a regrip on the 6.1″ fails. Keep the dated table with the check file.
- **Why:** What a thumb reaches depends on grip, hand and phone (Bergstrom-Lehtovirta and Oulasvirta 2014, experimental); owners of big phones used two hands ~70% of the time (Clark, practitioner). No peer-reviewed study covers phones over 6.5″, hence SHOULD.
- **Check:** A dated grip table in the latest tier-3 check file.
- **Status:** breaks — never done; every capture so far is a 6.9″ simulator · Phase 4.

**P16 · SHOULD · Every change to launch, the first session, the data layer, the planner, a long list or the app's structure (P21) is profiled on the oldest supported physical iPhone at the next tier-3 pass (P18), and the numbers are recorded against F2–F4; this becomes MUST once open question 10 names the reference device.**
- **In Yumo:** Triggers: RootView.task, Store, Models, Balance and Planner, FoodIndex, Catalogue, any list screen, and structural changes: the NavigationStack migration (decision 14) keeps both tab roots alive (N23), so its launch, memory and tab-switch hitches are measured. Instruments App Launch, Hangs and Animation Hitches on the reference device (an iPhone XS or XR with the A12 chip, or an SE 2, while the target is iOS 17). A dated line: "launch 310 ms · hangs 0 · hitches 3 ms/s · iPhone XS iOS 17.x", with the .trace saved. Simulator and M5 Mac timings (such as the 21 Oct search benchmark) don't count.
- **Why:** Snap's redesign shipped performance regressions that hit Android users disproportionately (Spiegel, earnings call), and its 10-Q tied the first DAU fall, 191M → 188M, to the redesign; the brief's remedy is testing on the oldest supported devices. Apple's 400 ms and 250 ms budgets (platform). SHOULD until a reference device exists: a MUST nobody can run gets skipped.
- **Check:** Each tier-3 check file has a device performance line for every such change since the last pass.
- **Status:** breaks — no device measurements; no A12-chip device on record · Phase 4.

**P17 · MUST · Yumo claims support only for iOS versions it actually runs: the deployment-target OS gets the screenshot matrix and audits, or the target goes up.**
- **In Yumo:** project.yml:5 says iOS 17.0, but only the iOS 26.4, 26.5 and 27.0 runtimes are installed, so iOS 17 paths (e.g. the GeometryReader fallback for the large-title collapse, since onScrollGeometryChange is iOS 18+) have never run. Install the iOS 17 runtime and add it to P10 and P11, or raise the target (iOS 26 reached 79% of iPhones within nine months; open question 9).
- **Why:** Snap's redesign shipped performance regressions that hit Android users disproportionately (Spiegel, earnings call); the brief's remedy is testing on the oldest supported devices. MUST via hard rule 8: supporting an OS is coverage, so nothing half-done.
- **Check:** `grep -n "iOS:" project.yml` against `xcrun simctl list runtimes`: the target's major version is installed and appears in the latest check file.
- **Status:** breaks — target iOS 17; no iOS 17 or 18 runtime · Phase 4.

**P18 · SHOULD · Checks run in three tiers: every commit, every TestFlight upload, and the end of each fix phase or a public release.**
- **In Yumo:** Tier 1, every commit: the build exit code (P9), the ratchet searches and the contrast test (Definition of done, P12). Tier 2, every TestFlight upload: the P11 UI-test audits and the P10 shots of the changed screens; when the diff touches the first session (OnboardingFlow.swift, Tour/, the launch in YumoApp.swift, the permission prompts) or the data layer (Domain/Store, Models, Catalogue, FoodIndex, Balance, Planner), the onboarding and performance sections too. Tier 3, at the end of each of Phases 1–4 and before any public release: the full checklist and screenshot matrix, P13's device assistive-technology passes, P15's grip pass and P16's device profiling. Uploads are frequent (six builds on 22 Oct), so the device-heavy checks sit in tier 3.
- **Why:** The brief's cadence (touch, navigation and accessibility every release; onboarding and performance on any first-session or data-layer change), ordered by where things usually fail (heuristic); for one developer, a gate too heavy to run gets skipped, and then the book stops being trusted.
- **Check:** Each check file names its tier and the sections that ran; if `git diff --name-only <prev>..HEAD` touches the first-session or data-layer paths, those sections are listed.
- **Status:** breaks — one full audit (22 Oct) · Phase 4.

**P19 · MUST · A dated, completed checklist is kept with every build, one line per rule with its status and evidence, so a regression shows up as a diff.**
- **In Yumo:** docs/checks/<yyyyMMddHHmm>.md, named after the build number testflight.sh sets and committed with the build. Statuses: meets, partly, breaks, unverified, exception (decision N), n/a with a reason (P28 lists the n/a items). Record where the screenshots are (full-size PNGs may live outside git; open question 76). Before upload, diff the previous file against this one: any meets → breaks line blocks the upload or needs a dated exception. Seed the first file from this book's Status lines; from then on it owns status.
- **Why:** The brief: keep a dated copy of the completed list with the build; Sid asked for one source of truth for every iteration (23 Oct).
- **Check:** `ls docs/checks/` shows one file per TestFlight build since this book; every status change between the newest two is explained in CHANGELOG.md.
- **Status:** breaks — the only checklist is the 22 Oct audit in /tmp · Phase 4.

**P20 · MUST · Judge whether a layout or flow works by task performance on a device (success, time, errors); ask for ratings only after the task, never from screenshots.**
- **In Yumo:** A fixed TestFlight script for new users: log 150 g Greek yogurt to Breakfast; scan a bar and Undo; open yesterday's dinner; set chicken to 400 g in Your day; change the calorie target; log a weight. Record success, seconds, mis-taps and Undo uses, then one 1–7 ease question. Do it with 3–5 people for each structural change (Your day, Add, the Today header). Sid's reactions are owner decisions (P1), but they are taste (n = 1), not usability evidence.
- **Why:** After use, poor usability lowered beauty ratings, not the other way round (Tuch et al. 2012, n = 80; Grishin and Gillan 2019, n = 117, experimental); attractive visuals hid a struggling tester (NN/g).
- **Check:** Every usability claim in docs/checks or the CHANGELOG carries success, time and error numbers, with any rating taken after the task.
- **Status:** breaks — no timed tasks; Your day changed ~10 times in 7 days on n = 1 · Phase 4.
- **Exception:** Decisions 1, 3, 5, 6 and 8 rest on Sid's own use; they stand (P1). Revisit any of them if TestFlight task data contradicts it.

**P21 · MUST · Before any structural change (moving, merging, removing or renaming a screen, entry point or flow), list every capability the old structure offered and where each one lives afterwards; anything dropped is named and signed off.**
- **In Yumo:** The list goes in the CHANGELOG entry ("Parity: capability → where now"); assistive-technology paths count. Next up is decision 14 (pushCover → NavigationStack): every pushCover page with its Back and entry points, tab-bar visibility, scroll position on return, the review's auto-open, the DEBUG previews. Last time it was missing: the 22 Oct Your day rewrite (af8aca8) dropped "more like this" (nothing sets .liked any more, BalanceSheet.swift:154,164, yet Planner.swift:60-69 still ranks by likes and StaplesScreen.swift:231 still promises it), Open Food Facts name search in Staples, today-only amounts for non-staples, and carry-over (now dead code). Copy never promises a removed feature.
- **Why:** Sonos shipped a rewrite below parity, at a cost of at least $100m, and its CEO left; Snap's redesign preceded its first fall in daily users, 191M to 188M (earnings calls, SEC filings).
- **Check:** Every CHANGELOG entry that changes navigation or removes a view has a Parity list and, once the reference device exists, a P16 device line; grep the copy for removed features' names.
- **Status:** breaks — the Your day rewrite dropped four capabilities unrecorded · Phase 2.
- **Exception:** Decision 8 (Your day as one screen) stands; it doesn't exempt the parity list.

**P22 · SHOULD · Structural changes ship behind a switch that keeps the old path; after launch they go to a small share of users first with a retention guardrail, and a way back stays when users split.**
- **In Yumo:** The pattern exists: Features.typeIt and Features.mealSwitcherInAdd keep their code (flags are flipped, never deleted; decision 1). Gaps: the flags are compile-time constants (Features.swift:3-12), so a rollback needs a new build; the Your day rewrite had no flag; carry-over is dead code. After launch: remote JSON flags with the compiled values as defaults; ~5–10% of users or one TestFlight group first; guardrail "no drop in logged days per user per week, or in week-2 return, against control", with the rollback threshold written down. If testers split on Type it, it becomes a Settings switch.
- **Why:** Instagram reversed a few-percent test within weeks at no reported cost, while Snap's broad rollout couldn't be undone that way; Apple restored Safari's layout and added a toggle (company-reported).
- **Check:** Each structural CHANGELOG entry names its flag, and after launch its share, guardrail and rollback threshold; `grep -n "static let" Yumo/Domain/Features.swift` shows the flag.
- **Status:** partly — two compile-time flags; Your day unflagged · Phase 4.

**P23 · SHOULD · Before public release, freeze the names and layout of the screens the daily habit is built on; afterwards change them only through P21 and P22.**
- **In Yumo:** The core loop: Today (the hero, meal cards with their +), the Add sheet (search, Recent, scan) and Your day. Your day was restructured ~10 times in 7 days and renamed three times (CHANGELOG.md:3-45): fine at n = 1 on TestFlight, not after launch. Settle one name everywhere first (N20).
- **Why:** Snap moved a habit's main objects and reported its first fall in daily users (SEC filing); Duolingo's path launched at parity on its metrics (company-reported).
- **Check:** After the freeze date, `git log --since=<freeze> -- Yumo/Screens/Today Yumo/Screens/Add` shows no structural change without a flag and a parity list.
- **Status:** partly — no freeze date; names still differ · Phase 4.

**P24 · SHOULD · Judge changes by what people do (task completion, logged days, retention, opt-outs), not by complaints, praise, one person's taste or a feature's own click-through; make a feature visible and labelled before judging its use.**
- **In Yumo:** Privacy-preserving counts with no food names, weights or kcal: onboarding step reached, tour skipped at stop N, time to first log, logged days per week, scan Undo rate, review applied, kept or dismissed, a reminder switched off within 14 days, an OS permission revoked. Read onboarding changes at day 30 and record them in the CHANGELOG. Judge the Monday auto-open by Monday logging, and reminders by opt-outs, not opens. Saved meals and Your day get labelled entries (N2, N3) before anyone judges how much they're used.
- **Why:** Duolingo's path drew loud complaints while engagement held; Google+'s interstitial won 9% installs while 69% left (company-reported); median retention is 26%, 13% and 7% at days 1, 7 and 30 (Adjust benchmark).
- **Check:** Before public launch a dashboard shows these counts from TestFlight; each structural decision cites a number or says "no data (n = 1)".
- **Status:** breaks — no telemetry · Phase 4.

**P25 · SHOULD · A move to a new system (backend accounts, a paid tier) keeps every capability and all data; a forced move to something worse counts as a redesign that removes capabilities.**
- **In Yumo:** When the backend and Sign in with Apple arrive (decisions 12, 15), local accounts migrate in place with full history and no repeat onboarding. If Plus launches, what everyone has today (isPlus = true) is grandfathered, or its removal is announced in the app with dates (open question 66).
- **Why:** When Reddit forced people off third-party apps, 91% of its US iOS reviews were one-star against a 53% baseline (third-party measurement).
- **Check:** Migration test: a device with 90 days of local data upgrades and shows identical day totals, staples, saved meals and review history.
- **Status:** n/a — no backend or paid tier.

**P26 · MUST · No release, redesign, deletion or catalogue rebuild changes a day the user already logged, or replaces an unknown with a guessed number.**
- **In Yumo:** Since Phase 0, entries keep their per-100 g values (FoodEntry.keptData) when a food is deleted, and unknown nutrients show "—" (decision 11). Catalogue rebuilds, food merges and renames leave past day totals, reviews and measured maintenance unchanged.
- **Why:** The data bar: never a wrong number; Apple Maps' launch errors cost trust at once (company case).
- **Check:** Unit test: snapshot DayTotals for 30 days, then delete, rename and rebuild catalogue foods; the totals are identical.
- **Status:** meets — since Phase 0.

**P27 · SHOULD · Use the platform's pattern for every standard job unless a task test (P20) shows the custom one beats it by more than the learning cost; otherwise a custom pattern is a dated owner exception (P3) and must still behave like the system one (gesture, position, dismissal, VoiceOver role).**
- **In Yumo:** Native already: Toggle, alerts with outcome buttons, confirmationDialog, the wheel DatePicker, the share sheet, keyboards and content types; decision 14 makes back navigation native. Custom, and must behave natively: TabBar (re-tap to top works; Large Content Viewer, A8), Segmented (44 pt, selected trait), CalendarPopover (UICalendarView is the fallback), SwipeStage (mirrors system swipe actions), sheets that hide the system grabber, RulerView and MacroDragTile (typed and adjustable alternatives), toasts.
- **Why:** Reuse the platform's patterns unless yours is measurably better by more than the learning cost (brief ch. 1); centred logos raised go-home failures from 4% to 24% (Jakob's law, heuristic); breaking familiar patterns reduced usability (Google research).
- **Check:** Each custom control in Components.swift has its test result or decision number in the register, and its system behaviours tested on a device.
- **Status:** partly — custom controls drop native behaviours and rest on decision 10 alone · Phase 2.
- **Exception:** Decision 10 (handoff identity: custom tab bar, lifted buttons, drawn glyphs). The look may stay custom; the behaviour must match iOS. Revisit a control if P20's task data shows misses on it, or when system Liquid Glass bars become required.

**P28 · MUST · Yumo is iOS only: a brief item that applies only to Android, or to a field or flow Yumo doesn't have, is recorded once as "n/a (P28)" in each dated checklist, never as a pass or a failure; if an Android app is started, each Android item becomes a rule before its first screen is built.**
- **In Yumo:** Android-only, n/a: 48 × 48 dp targets and 8 dp spacing (T1 and T10 use pt); system Back, predictive back, per-tab back stacks and no custom back button (N31); sp-only text sizes; Material Symbols matched to text weight; Material 3 Expressive containment; a rationale after the first permission denial and never after the second; testing three-button and gesture navigation; working across the last five major Android versions; TalkBack and Accessibility Scanner (P11, P13); Sign in with Google as Android's platform sign-in; choosing a cross-platform framework (Yumo is native SwiftUI). No such field or flow, n/a: address fields (one full-name field, hidden Address Line 2, postcode lookup), contacts and GPS fill, guest checkout (until Plus, E3). If Android is built, it shares the IA map (N26), one copy deck, the colour, type, spacing and motion tokens (V11, V22, F21) and this book's decisions, and it renders with Material components (N29).
- **Why:** The brief is written for teams shipping both platforms (checklist preamble) and says to share the decisions and localise the rendering (ch. 7); an item skipped without a record can't be told from one forgotten (P19).
- **Check:** The newest docs/checks file lists each item above once as "n/a (P28)"; nothing else is n/a without its own reason.
- **Status:** meets in this book; the check file doesn't exist yet · Phase 4.

---

## Owner decisions

Sid's dated calls. Each row lists the rules it departs from (their Exceptions name it) and, after "builds", the rules it creates or raises. A trigger marked "proposed" is Claude's suggestion and needs Sid's yes; "not recorded" means ask Sid (open question 77).

| # | Decision | Date | Departs from; builds | Reason | Revisit when |
|---|---|---|---|---|---|
| 1 | Type it (one-line logging) off behind Features.typeIt; flags are flipped, never deleted | 20 Oct | A30, P20 | Confusing for new users | After TestFlight: as an opt-in, or on while VoiceOver runs (open question 61) |
| 2 | No meal switcher in the Add sheet (Features.mealSwitcherInAdd off) | 20 Oct | None; builds N3's scoped sheet | The meal card's + already chose the meal | If TestFlight testers log to the wrong meal (proposed) |
| 3 | No Done or accessory bar above the decimal keypad; it closes on a tap outside or a swipe down | 20 Oct | I23 (met once the escape gesture works), T16, N21, P20 | "Looks terrible" | A VoiceOver or Switch Control pass can't dismiss the pad (open question 62) |
| 4 | No food photos anywhere | 20 Oct (CHANGELOG.md:100) | None | "No images" | None needed (proposed) |
| 5 | Grams first; servings unit as muted text plus a green ▾ | 20 Oct | V13, V14 (the ▾ must reach 3:1), I24 (fits), P20 | Dislikes MyFitnessPal-style serving sizes; a boxed chip read like a text field | TestFlight shows most logs typed rather than added with +, or testers miss the unit picker (proposed) |
| 6 | No raw/cooked segmented control; one "Switch to cooked?" link | 20 Oct | V14 (the link's signifier; an underline is proposed), P20; builds N15's in-place swap | Clutter | Testers miss the link (proposed) |
| 7 | The planner never infers dislike from a swap; "Never suggest" is always an explicit tap | 22 Oct | None; builds E8 | Explicit consent | None needed |
| 8 | Your day is one screen | 22 Oct | P20, P21 (the parity list still applies); builds N15 (the model for it) | "Doing too many things at once" | None needed |
| 9 | One-action toasts (Undo, Never suggest) in their own window above sheets; scans auto-log with a 4 s Undo | 22 Oct (CHANGELOG.md:24,30) | F27, F28 (4 s → ~5 s), A11, N29; builds F29 | Not recorded; the scan auto-log was Sid's request (CHANGELOG.md:30) | The Undo hold now (F28); if VoiceOver can't reach Undo (A11) |
| 10 | Visual identity and IA from the design handoff (rev 2–11): sand palette, Nunito, green accent, lifted buttons, 2-tab bar with Settings behind a cog, 9-stop tour, streak pill at ≥ 2 days, weekly review that opens once on Monday | 15–19 Oct | T4, T5, T7, T8, T22, N2, N9, N11, N18, N21, V2 (pending), V3, V10 (pending), V14, V15, V23, V28, V31, F13, F14, F15, F19, F20, F23, F27, I6, I9, A7, A9, A12, E17, P27 | "The prototype wins over the docs." | Per rule: the ✦ label now (N2); ink-muted and weight-delta colours when Sid picks (open questions 35, 45); the review's auto-open after a TestFlight comparison (E17); custom bars when Xcode 27 requires glass (V31); the rest when testers show misses |
| 11 | UK-first food data; unknown values show "—", never a guess | 16–21 Oct | None; builds F8, P26, A17 | One trustworthy answer | None needed |
| 12 | Local account (username + password) as a placeholder | Not recorded | I1, I3 | Until a REST backend exists (Sid's words not recorded) | When the backend is built |
| 13 | Primary buttons keep the #4CC417 fill; labels become ink #1F1C17 (7.45:1), not white (2.28:1) | 22–23 Oct | None; builds V4 | Keep the bright green; not a darker fill | None needed |
| 14 | Back navigation moves to a NavigationStack per tab; replaces pushCover and the handoff's fade-and-rise push | 22–23 Oct | None; builds N4–N7, which rest their MUST on it (supersedes part of 10) | Edge-swipe back; the tab bar stays visible | None needed |
| 15 | The local account step and the 9-stop tour stay for now | 22–23 Oct | I1, I3, I6, I7, I8, F13 (tour finish), F17, A13, E17, P7 | Deferred until the backend; the brief's evidence is against both. Sid: raise them again when the backend work starts, not before | When the backend work starts (Sign in with Apple / passkeys) |
| 16 | The streak gets slack: one missed day a week doesn't break it | 22–23 Oct | None; builds E9, which rests its MUST on it | Not recorded | Rolling vs calendar week (open question 63) |
| 17 | Phase 0 correctness fixes committed: deleted-food history kept, complete account deletion, goal and sex must be chosen and body fat stays unset unless entered (age, height, weight and activity still default, I5), honest lookups, calendar paging, denial explanations, app-wide keyboard dismissal, dark panel token | 22 Oct 23:41 (commit 1a558a1, build 2026-10-22 night) | None | Correctness first | None needed |
| 18 | Fix phases in order: 0 correctness, 1 shared components, 2 navigation, 3 first run & habits, 4 keep it fixed; re-run the screenshots and the audit after each | 22–23 Oct, approved with the audit plan | P7 (navigation is first by measured impact) | Sid approved Claude's phased plan; most fixes land in Components.swift and Theme.swift | Whether the ✦ chip moves into Phase 1 (open question 15) |
| 19 | This rule book is the source of truth for every iteration | 23 Oct | None; builds P1, P4, P19 | "a source of truth that we can base all other iterations off of" | At each new brief or handoff rev |

---

## Definition of done for any UI change

Run before a commit (P18 tier 1). Repo-wide checks are ratchets until the phase named: no new hits compared with the newest docs/checks file (until one exists, with the parent commit); after that phase each becomes absolute. A box that can't be ticked needs a dated exception (P3) or the change waits.

- [ ] The build exits 0, read from the exit code (P9).
- [ ] The CHANGELOG entry has the date, Sid's reason in his words and a "Rules:" line (P8). A structural change also has a Parity list and a flag (P21, P22).
- [ ] No MUST got worse; any handoff value or request that breaks a MUST went to Sid first (P2, P3).
- [ ] Every new or changed control hit-tests at ≥ 44 pt with the frame inside its label, and T2's search finds no new hit (absolute after Phase 1); removals sit ≥ 32 pt from Log/Save and offer Undo (T1, T2, T6, I28).
- [ ] Entry points and icons show a word, or the icon is on V32's approved list; every icon and control has a purpose label that's unique on its screen, with its trait and value; one name per destination (N2, V32, A4–A6, N20).
- [ ] Type uses Font.yumo roles with a text style; no new `.nunito(` outside Theme.swift, and no new `lineLimit(1)` or `minimumScaleFactor` without a comment (V22, A1, A2; absolute after Phase 1).
- [ ] Colour uses tokens only; the contrast test shows no new failing pair in either theme (absolute after Phase 1); nothing is told by colour alone (V1–V5, V9, P12).
- [ ] Motion uses Motion tokens with no new inline curve, stays ≤ 500 ms, and has a Reduce Motion form once Motion.reduced exists (F21, F13, A21; absolute after Phase 1).
- [ ] Gestures have a visible control and an accessibility action, and nothing claims the leading edge (N21, A12, N7).
- [ ] Toasts and new content are announced; every wait ends in a named state; spinners wait ~1 s (A10, F8, F5).
- [ ] A new screen is in the IA map with one home, ≤ 2 levels deep, with no stacked modal and a labelled ✕ (N26, N13, N14, N18; absolute for existing screens after Phase 2).
- [ ] Numbers come from the shared parser, unknowns show "—", past days are unchanged, and no target goes below the floor (I20, F8, P26, E19).
- [ ] Permissions are asked in context with a true purpose string; buttons state their outcome; no shaming copy (I11, I15, I30, E7).
- [ ] The touched screen, checked at Large and AX5 in the simulator, shows no "…", broken words or overlap; the full P10 set runs per upload.

Before a TestFlight upload: P18 tier 2 (P10 shots, P11 audits, P19's diff against the last build). At the end of each phase and before a public release: tier 3 (the full checklist, P13, P15, P16, and the accessibility statement's date, A29).

---

## Things we don't say

Claims that sound like evidence but aren't. Don't use them in rules, code comments, the CHANGELOG or decisions (P6).

**Laws and memory**

| Don't say | Say instead | Brief |
|---|---|---|
| Hick's law: fewer options are always faster, so cap the list | Hick covers practised stimulus–response choices; scanning a list is linear. Order and label lists so people can narrow them | ch. 1 |
| Miller's 7 ± 2: keep menus, tabs and forms to seven | Working memory holds ~4 chunks (Cowan 2001), and it limits what's carried across screens; a visible list is read. The five-tab cap is about touch width | ch. 1 |
| The Doherty threshold: respond within 400 ms | The 1982 IBM report says 0.3 s and "subsecond". Use Apple's numbers: under 100 ms a tap, a hang at 250 ms | ch. 1, 6 |
| Nielsen's 0.1 / 1 / 10 s are measured breakpoints | A 1993 synthesis with no new data: rough bands, not budgets | ch. 1, 6 |
| Zeigarnik: unfinished tasks stick, so streaks and progress bars work | The meta-analytic ratio is 0.99, no effect. Ovsiankina resumption (~67% resumed) and goal-gradient hold | ch. 1 |
| Beautiful design is more usable | That's a correlation before use; after use, usability drives beauty ratings. Judge by task performance | ch. 1 |
| A great ending (peak-end) redeems the week | Peak-end weakens for long, many-part experiences; fix the daily friction | ch. 1 |
| Progressive disclosure always lowers load | It adds taps and depends on scent: hide only behind a labelled control, ≤ 2 levels | ch. 1 |

**Touch and reach**

| Don't say | Say instead | Brief |
|---|---|---|
| Edges and corners are infinite targets (Fitts) | True for a mouse, not a finger: edge targets took longer on touch, and corners need ~12 mm against ~7 mm in the centre (Hoober's proprietary data; size the body at 9–10 mm per Parhi) | ch. 1, 2 |
| The thumb-zone map shows the bottom corner is easy | The maps are sketches their author disowned; accuracy is best in the centre and worst in every corner; the top is slower one-handed | ch. 2 |
| 49% use their phone one-handed with the right thumb | Logged in the first seconds on small phones; grips change constantly and big-phone owners use two hands ~70% of the time | ch. 2 |
| 44 pt is about 9 mm, so Apple's default meets the research | 44 pt is 7.3 mm at 460 ppi and 6.9 mm on an iPhone 11 or SE; 9.2–9.6 mm needs ~56–60 pt. The brief's own ch. 1 phrase "9–10 mm (roughly 44 pt)" is wrong by arithmetic; its ch. 2 table puts 44 pt at ~7–9 mm | ch. 1, 2 |
| WCAG AA's 24 × 24 px is an adequate touch target | It's about half the 9.2 mm its own guidance cites | ch. 2 |
| Fingertips are 8–10 mm (MIT Touch Lab) | That's a monkey's fingertip; human ones are 16–20 mm and the screen senses the centre. Size from tap-accuracy studies | ch. 2 |
| People will be careful with small targets | ~1 mm of finger noise survives any care: 2.4 mm targets still gave 29–38% errors | ch. 1 |
| More space between small targets fixes mis-taps | Gaps help only once targets are full size (Instagram's 2 mm gaps did nothing) | ch. 2 |
| Bottom sheets put content within thumb reach | NN/g calls this "largely incorrect"; use a sheet for a short, scoped task | ch. 2, 3 |
| A big button above the keyboard is four times faster to find | Google's result compared a larger, contained button with a toolbar icon, so it is about size and salience as much as position | ch. 2, 5 |

**Navigation and change**

| Don't say | Say instead | Brief |
|---|---|---|
| The hamburger icon is the problem | Visibility is: hidden navigation was used 57% vs 86% for visible-plus-menu | ch. 3 |
| Facebook's and Spotify's tab bars raised engagement by an audited amount | Facebook gave no number; Spotify's 9% and 30% are company-reported via the press. Cite NN/g's lab study | ch. 3, 10 |
| Redbooth's tab bar raised DAU 65% | It was a whole redesign of a small B2B app: evidence that features became visible, not a tab-bar effect size | ch. 10 |
| People find swipe gestures by themselves | 3–7% ever swiped to open a drawer; gestures are shortcuts for visible controls | ch. 3 |
| With edge-swipe back, the Back button is redundant | Gestures supplement standard controls; Back is usually the most-used button | ch. 2, 7 |
| Edge-swipe back is ergonomically proven | No study exists; keep it because iOS users expect it | ch. 2 |
| Native navigation measurably beats custom | No controlled study; decision 14 rests on the edge swipe, kept state, a visible tab bar and accessibility | ch. 7 |
| The costs of modals are proven | Argued, not measured; the no-stacking rule rests on Apple's HIG, so N14 is SHOULD NOT | ch. 3 |
| Loud complaints mean a redesign failed; silence means it worked | Duolingo's path drew complaints while engagement held; judge by a retention guardrail | ch. 9, 10 |
| Instagram rolled back its full-screen feed because of the Kardashian backlash | Its head cited usage data first; testing on a few percent made the rollback cheap | ch. 10 |
| Snap's redesign failed on phones it hadn't tested | Spiegel cited performance regressions hitting Android users disproportionately; the 10-Q tied the DAU fall to the redesign | ch. 9, 10 |
| An interstitial that converts 9% works | Google+'s did, while 69% left; a banner raised one-day actives 17% | ch. 9, 10 |
| Big apps do it, so it's best practice | 95% of 240 popular apps contained a deceptive pattern, seven types on average | ch. 9 |

**Onboarding and permissions**

| Don't say | Say instead | Brief |
|---|---|---|
| A tutorial helps new users | NN/g: 91% vs 94% success and rated harder; Vevo's logins rose almost 10% without one | ch. 4, 10 |
| Facebook's "7 friends in 10 days" proves a magic number | A correlation from a secondhand summary; leading indicators are hypotheses to test | ch. 4 |
| Threads proves one-tap sign-up builds a product | 100M sign-ups in five days says nothing about retention | ch. 4, 10 |
| Pre-permission screens get 46% (or 100%) acceptance | In one app in 2014, push rose from under 40% to 66%, and photos from 67% to 89% when asked after the camera tap | ch. 4 |
| Push opt-in is 80–95% on Android, so only iOS needs care | Obsolete since Android 13; the iOS median (~51%) is Yumo's benchmark | ch. 4 |
| Validate as people type: 22% more success, 42% faster | That's Etre's 22-person study, in which validating on leaving the field beat validating while typing | ch. 4 |
| A placeholder is a fine label on a small screen | It vanishes when typing and filled-looking fields get skipped | ch. 4 |
| "Are you sure?" prevents mistakes | People learn to tap through; undo what's reversible, confirm only the irreversible | ch. 4 |
| A paywall must always come after value | Hard paywalls converted 10.7% vs 2.1% with the same one-year retention; it depends on whether value is already believed | ch. 4 |
| 6% uninstall after one push a week | A vendor claim with no method; people opt out over irrelevance and frequency | ch. 9 |

**Visual and dark mode**

| Don't say | Say instead | Brief |
|---|---|---|
| Apple says a third of users use larger text | It can't be traced to Apple. Telemetry: a quarter to a third change size, both ways (8.8% smaller, 19.3% larger, 3.1% accessibility sizes) | ch. 5, 8 |
| 11 pt is 11 pt in any font | x-height decides: Nunito at 17 pt reads like SF Pro at ~16.2 pt | ch. 5 |
| Flat design makes apps 22% slower | Measured on findability tasks on nine web pages (71 people); its author warns against quoting it app-wide | ch. 5 |
| Most people use dark mode (73–82%) | Those are enthusiast polls; NN/g found a rough three-way split, one app 37% | ch. 5 |
| Dark mode is easier to read | Light won for normally sighted readers; dark helped some low-vision readers | ch. 5 |
| Dark mode saves lots of battery | 3–9% at 30–50% brightness; 39–47% only at full brightness | ch. 5 |
| APCA is the new WCAG 3 standard | It's a public beta, not in the WCAG 3 draft: pass WCAG 2, check APCA too | ch. 5 |
| Contrast rules are for colour-blind users | The ratios are about luminance and age-related loss; colour-blind users need non-colour cues as well | ch. 5 |
| Light grey text looks clean and modern | It costs legibility and looks disabled; cut content instead | ch. 5 |
| Cards are the modern way to show any list | Lists scan better for uniform items | ch. 5 |
| A good icon needs no label; SF Symbols solve meaning | Only home, print and the magnifier are near-universal; SF Symbols solve consistency | ch. 5 |
| Material 3 Expressive makes interfaces four times faster | That compared a big contained button with a small toolbar icon; removing labels hurt | ch. 5 |
| To look native on iOS 26, use Liquid Glass everywhere | Navigation layer only, sparingly, never glass on glass | ch. 5 |
| Liquid Glass only hurts low-vision users | Apple's retreat in the betas and the Tinted option show mainstream harm | ch. 8 |
| People understand less on phones | No practical difference for ordinary text; hard content slows reading ~30 ms a word | ch. 5 |
| Dense is bad, minimal is better | Density is value per time and space; cut content rather than cram or dim it | ch. 5 |

**Speed and feedback**

| Don't say | Say instead | Brief |
|---|---|---|
| 100 ms costs Amazon 1% of sales | No primary source; the one first-hand post gives no percentage | ch. 0, 6 |
| 53% abandon an app that takes over 3 s | A 2016 figure from analytics on 3,700 opted-in mobile websites (its bounce curves are modelled); a mobile-web number, not a native-app one | ch. 6 |
| Google lost 20% of traffic from 500 ms | The same test also showed 30 results instead of 10 | ch. 6 |
| Skeletons feel faster than spinners | The evidence is thin and mixed | ch. 6 |
| Users blame a custom spinner on the app and the system one on their phone | A 2013 tweet, never published | ch. 6 |
| Infinite scroll has cost half a million lifetimes | Its inventor doesn't remember the figure; use NN/g's usability case | ch. 6, 9 |
| A toast is the standard iOS confirmation | iOS has no toast; prefer status in place, and snackbars wait for screen readers | ch. 6, 7 |
| Haptics are proven to improve apps | The lab support is for keyboards; the rest is vendor guidance, so haptic rules are SHOULD | ch. 0, 6 |

**Accessibility**

| Don't say | Say instead | Brief |
|---|---|---|
| Accessibility is for a small minority | 31% run a non-default text size, 37% dark mode, 3.5% Reduce Motion, 2.6% Reduce Transparency; screen readers are 1 in 11,000 | ch. 8 |
| WCAG 2.2 AA is the law Yumo must meet | It's the standard hard rules 6 and 8 adopt. As the brief describes them, UK rules bind public bodies, the US Title II rule state and local government, the EAA exempts microenterprises, and the Equality Act duty names no standard | ch. 8 |
| The laws ask for 44 pt targets | WCAG AA asks 24 × 24 px; 44 is AAA. One spec at 44 pt exceeds all three regimes | ch. 2, 8 |
| Audits find truncation and unannounced content most | The largest audit (9,999 apps) found missing labels and sub-48 dp targets most; unannounced content, truncation and low-contrast text are the three defects Starling and Monzo disclose | ch. 8 |
| Accessibility needs a big team | Art of Fauna, an Apple Design Award inclusivity winner, was made by one developer | ch. 8 |
| Nutrition Labels are mandatory or have a deadline | Voluntary as of October 2026, with no date announced | ch. 8 |
| Nutrition Labels are free discoverability | They count only if every common task passes, and App Review can challenge them | ch. 8 |
| 70% of screen-reader users are on iPhone | A self-selected survey; 84% in North America, 31% in South America | ch. 8 |
| 13 million people have temporary arm injuries | The sources disagree by a units error; quote only the ~500:1 ratio of temporary to permanent | ch. 8 |
| If the automated audit passes, the app is accessible | Tools miss labels and focus problems; do manual passes on devices | ch. 8 |

**Engagement and ethics**

| Don't say | Say instead | Brief |
|---|---|---|
| Countdown timers lift conversion | No measurable effect, and fake urgency draws enforcement | ch. 9 |
| Mild nudges are harmless if nobody complains | They lowered follow-up interest and people's sense they could refuse | ch. 9 |
| Click-to-cancel was struck down, so hard cancellation is fine | Amazon ($2.5bn) and Adobe were pursued afterwards under ROSCA; the DSA applies, and the UK DMCC regime is expected in January 2027 | ch. 9 |
| Duolingo proved streaks massively boost retention | The effects were small and depended on slack; its own former lead calls the correlations selection | ch. 9, 10 |
| Confetti is just delight | On a consequential action, regulators read it as inducement (Robinhood, $7.5m) | ch. 10 |
| Game-like features cause problem gambling | The FCA found an association and said cause wasn't shown | ch. 9 |

---

## Open questions for Sid

Deduplicated across the eight areas. Each names the rules it would settle. Numbers stay stable; by when an answer is needed: now 70, 77 · Phase 1: 1–3, 5–7, 26 (its VoiceOver part), 30, 33, 35–51, 53, 54, 56, 62 · Phase 2: 4, 8, 11–23 · Phase 3: 27–29, 31, 32, 34, 63, 64, 67–69 · Phase 4: 9, 10, 52, 57, 58, 71–76 · with the backend, Plus or launch: 24–26, 55, 59–61, 65, 66.

**Touch & layout**
1. Hit-area standard: 44 pt as the MUST floor with 56 pt (or 60 pt) as the SHOULD for body targets, or 56 pt as the MUST (the evidence meets that bar, T3)? And may visuals stay at handoff sizes (AddChip 40 × 34, ✦ 40, ✕ 44) while only the hit frames grow? (T1–T3)
2. Corners: accept CloseButton, Back and Scan hit areas reaching ~60–72 pt beyond the visible circle? The tab bar: grow it, or accept 8.1 mm? (T4, T5)
3. Meal card: make the whole header row (60 pt × card width) the Add target, with a press tint? (T8)
4. Repeat row: give it a tap (e.g. add yesterday's foods with Undo), or keep it swipe-only with an accessibility action? (T7, N21, A12)
5. Removals: does every removal (entry, weight, saved meal, staple, supplement) use the Undo toast and sit ≥ 32 pt below the primary, or do some get a named confirmation? Should My foods delete move from its confirmation to Undo with a soft delete? (T6, I28, I29)
6. Pin Log/Save above the decimal pad with safeAreaInset on the Food page, Create food, Log weight and Calorie target? (T16)
7. Spacing for bare text actions: Apple's ~24 pt clear space, or touching 44 pt hit areas with ≥ 8 pt visual gaps? (T10)
8. Keep/Swap/Never: a fitted sheet with Keep lowest, or an inline unfold in the row? (T15, N14)

**Devices and versions**

9. Deployment target: keep iOS 17 (iPhone SE at 375 pt, 326-ppi phones where 44 pt is 6.9 mm, an A12-chip performance floor, an iOS 17 runtime to install) or raise to iOS 18 or 26? (T9, P16, P17)
10. Which physical iPhones can you test on: a 6.1″ and a 6.9″ for grips, and the oldest supported model for Instruments (P16 becomes MUST once it's named)? (P13–P16)

**Navigation**

11. Scan: header icon only, a labelled "Scan a barcode" row under the field, or a "Scan" pill in the field? And is the scanner a mode inside the Add sheet, or a cover after the sheet closes? (N2, N14)
12. Add sheet search: stay at the top and auto-focused (the keyboard hides 9 of 15 Recent rows), or a bottom search bar like iOS 26 Mail? Skip auto-focus at accessibility sizes? (N27)
13. Food page from Add: one push inside the sheet's own NavigationStack (audit fix 43), or keep "no hierarchy inside a modal" and use an inline expansion or a detent change? The brief and the audit disagree. (N15)
14. Edit staples from Your day: a push inside Your day, close it and jump to Settings › Staples, or move today's staple edits into Your day? (N3, N15)
15. The ✦: a "✦ Your day" chip, "Plan my day", or the icon with a first-encounter tip? Is "Your day" the one name everywhere, should the tour show it, and should the chip move from Phase 2 into Phase 1? (N2, N20, P7)
16. Two tabs or three: what TestFlight signal would justify a third (e.g. "Plan" or "Foods")? (N9)
17. The custom TabBar around two NavigationStacks, or a system TabView with Yumo's glyphs (per-tab state, filled tab icons, Liquid Glass and the Large Content Viewer for free), decided before Xcode 27? (N11, N23, V31, P27)
18. Settings also reachable from Today, or only from Progress? (N30)
19. Back labels: the system back (the parent's title, shortened by iOS) or the handoff's named labels ("‹ Your day")? (N6)
20. Onboarding and Sign in in a NavigationStack too, for the edge swipe between steps? (N6)
21. Calorie target and Macros: apply edits live with Undo, or keep Save and add "Discard changes?" (which needs a custom back that keeps the swipe)? (N22)
22. Deep links: route the reminders before launch? A "kcal left" widget and a "Log weight" App Intent in v1? (N25)
23. After decision 14, confirm that the system edge swipe always wins in the leading ~20 pt over swipe rows, the chart and the ruler. (N7)

**Input, forms & permissions**

24. App Store and the account step: outside the brief and to verify, App Review 5.1.1(v) asks apps without account features to work without a login. Flag the local account off at submission rather than when the backend arrives? (I1)
25. With the backend: when does the soft wall appear (after the first logged week? after N days?), is there ever a hard wall (e.g. only for sync), and which sign-in methods: Sign in with Apple and passkeys only, or email codes too (App Review 4.8, to verify)? (I2, I3)
26. The tour (decision 15). Now: under VoiceOver, skip it or adapt it (A13)? When the backend work starts, not before: Claude proposes dropping stops 4–8 (empty Progress cards on day 1; stop 4 has people close the sheet they opened), ending on a real first log, and replacing it with three tips (Breakfast +, ✦ Your day, Maintenance's first "Estimate"); is an earlier trigger worth setting then (e.g. most TestFlight users skipping by stop 3)? (I6–I8, A13)
27. Is a permission explainer worth one extra tap before the first scan and the first reminder, when tapping Scan already shows intent? (I12)
28. Onboarding defaults: Age, Height and Weight start at "—" or at visible values? Activity unselected? Pace pre-selected? The stall page's Diet break: marked "Recommended", or unselected? (I5, E6)
29. Birth year, full date of birth, or age? Offer "Fill from Apple Health" in onboarding (which adds a Health read ask there)? (I10, I27)
30. Do numeric list rows with the label on the left (Create food, Food page Amount, Settings) count as visible labels? (I16)
31. Keep Confirm password, or a show/hide toggle, while the local account exists? (I18)
32. Create food: optional micronutrient fields visible, or behind "More nutrients ›" (your bar is micronutrients on everything)? (I18)
33. The supplement nudge's "Not now": really ask again (after how long?), or relabel it "Don't ask again"? (I30)
34. Delete account and Apple Health: delete the samples Yumo wrote, or say they stay? (I29, E1)

**Visual design**

35. Text colours: accentText #2A6C0D, inkMuted #655E52 (or the stricter #5F5A51), dark inkMuted #C2BCB1 (4.5:1) or #CCC7BD (7:1), dark accentText #55C723 or #8FDA6E, danger #B43039 / #E88389. Approve, or pick others that pass? A side-by-side is needed. (V2–V6)
36. Green text links: accentText, or ink text with a green › or underline? (V3)
37. Dark mode: aim for 7:1 on small custom text, or stop at 4.5:1? (V6)
38. V1 now uses WCAG's large-text limits (24 pt, or 18.7 pt Bold): hold all text under 24 pt to 4.5:1 whatever its weight (stricter), or allow 3:1 for Bold from 18.7 pt as WCAG does? (V1, P12)
39. The disabled primary button once labels are ink: what label and fill? (Ink on accentSoft is 13.18:1 in light, 2.31:1 in dark.) (V4)
40. Warning words on Summary ("low"): ink beside the dot, or a darker warning text colour (≈ #A37B26)? (V8, V9)
41. Lifted static cards and the streak pill: keep the edge, or a 1 pt stroke and a flat pill? (V15, E9)
42. Glyphs: which stay drawn (calendar tile, bars, sparkle) and which move to SF Symbols at .heavy (✕, +, ›, tick, barcode, torch, info, pin)? Which icons may stay without a word (V32 proposes the sheet ✕, system Back, the AddChip + and −/+), and what do the torch, the Nutrients pin, the (i), the row +, the ‹ › arrows and the staple ✕ show? Does the cog stay icon-only? (V23, V32, N2)
43. Big numbers at accessibility sizes: cap the hero, ruler and plan numerals at .accessibility2, or let the hero stack "1,657" over "/ 2,950"? (A1, A2)
44. The Appearance toggle: keep it (default System) or remove it? (V28)
45. One macro colour map for onboarding, Summary and StackedBar; weight change coloured by direction toward the goal, or neutral? (V10)
46. Bold Text with Nunito: step weights up, or switch to SF Rounded while it's on? Increase Contrast: close to ink, or modest bumps that keep the sand look? (A24, V12)

**Feedback & motion**

47. Is every food log a "significant completion" with a haptic (5–15 a day), or only the day's first log or landing the target? (F23)
48. Toasts: Undo for 5 s or 6 s; info toasts with a 2.5 s floor or timed per word; which info-only toasts go ("Pinned X", "Macros saved", "Saved X", "Targets reset")? (F27, F28)
49. Exits at 0.6× the entrance, replacing the handoff's "exact reverse"? (F14)
50. Count-up and chart entrances: ≤ 400 ms and once per data change, or keep ≈620 and 700 ms? (F13, F19)
51. Move the bézier Motion tokens to springs (duration and bounce)? (F15, F16)
52. Add MetricKit to TestFlight builds for on-device hang, launch and hitch reports? (F2–F4, P16)
53. Haptics: rely on iOS's System Haptics switch, or add one in Settings? (F22)
54. Scan auto-log (decision 9): only when a remembered amount exists, showing the card otherwise? (F31, F32)
55. With the backend: which writes show at once, how a failed sync shows on its row, and automatic sync with "Synced … ago"? (F31–F33)

**Accessibility**

56. Charts: Swift Charts restyled in sand (audio graphs for free), or a hand-written chart descriptor? (A18, A19)
57. Recruit a VoiceOver user through TestFlight for the device passes? (P13)
58. The accessibility statement: which target (WCAG 2.2 AA plus the main tasks with VoiceOver and at AX5?), by when, where it lives before a website exists, and which contact address? (A29)
59. Nutrition Labels at launch: Dark Interface only, or hold launch until Larger Text and VoiceOver pass? (A28)
60. Legal: per the brief, the EAA covers e-commerce, banking, transport, telecoms, audiovisual and e-books and exempts service providers under 10 staff and €2M turnover; UK WCAG rules bind public bodies; the US Title II rule covers state and local government; the Equality Act duty is anticipatory and names no standard. So Yumo's accessibility MUSTs rest on hard rules 6 and 8. Re-check, and take advice, before selling to EU consumers or growing past the exemption? (A29, How to read a rule)
61. Type it (decision 1): on automatically while VoiceOver runs, Siri and App Intents instead, or neither? (A30)
62. Decision 3: if the escape gesture proves unreliable, show a Done bar only while VoiceOver or Switch Control runs? (I23)

**Ethics & habits**

63. Streak slack (decision 16): a rolling 7 days or Monday to Sunday? A number or "6 of 7 days"? Keep the streak at all (the handoff README said "no streaks")? (E9)
64. What counts as a logged day: any entry, ≥ 2 meals, ≥ 50% of target, a "day complete" tap? The same definition for measured maintenance? (E10)
65. Ratings: when may Yumo call requestReview (after the first finished review? after 14 logged days?), and not before public launch? (E18)
66. Plus: a hard paywall, freemium, or a soft wall after first value; what goes behind it; are today's users grandfathered? (E2, E3, P25)
67. Lock screen: may a reminder show kcal left or weight, or stay generic unless you opt in? (E15)
68. Praise by goal: what may the review praise for Maintain and Bulk users? Ever praise a day well under target? A written eating-disorder safeguard policy beyond the safety floors? (E12, E19)
69. May a recommended option (Apply, Diet break, Add supplement) keep the filled primary style when its alternative is the same height and readable? (E5, E6)

**Change & process**

70. Where the book lives: docs/RULEBOOK.md and docs/DECISIONS.md in the repo, the claude.ai page as a view, README.md:5 rewritten? (P1, P4) **Answered 23 Oct (Claude, by default; Sid may change it):** docs/RULEBOOK.md in the repo is the canonical copy, with the decisions register inside it; the claude.ai page is a read-only view; README points here.
71. Gate strictness: should a new audit failure or a meets → breaks line stop testflight.sh automatically, or be recorded for you to waive? (P11, P19)
72. Telemetry: privacy-preserving counts before launch, on-device only, opt-in export, or through the backend, and with which tool? Without them P22–P24 can't be measured. (P24)
73. Remote flags before launch, or TestFlight groups as the "small share" until there are public users? (P22)
74. Usability rounds: about five new users per TestFlight round with the P20 script, and how often? (P20)
75. What starts the core-loop freeze (first public release, the backend, a date), and what counts as "structural" (any change to entries, names or screen order on Today, Add and Your day)? (P21–P23)
76. Screenshots: downscaled copies in docs/checks/<build>/, a folder outside the repo, or an artifact? (P10, P19)
77. Decisions 9, 12 and 16: in your words, why, and (for 12) when? (P3)

---

## Changelog

- v1 · 23 Oct 2026 · first version from the brief.
- v1 · 23 Oct 2026, before adoption · edited after review against the brief and the repo: levels re-based on the evidence table (N10, N13, N14, N15, N24, I13, I19, V19, V30, F3, F6, F22, F25, F26, F34, E14 and E16 to SHOULD or SHOULD NOT; P16 to SHOULD until a reference device exists; N30 rewritten as SHOULD NOT); MUSTs resting on an owner decision or hard rule now name it; WCAG 2.2 AA treated as the standard the hard rules adopt, not as law; V1 and P12 use WCAG's large-text limits; T22, V32, E19 and P28 added; check tiers (P18) and a ratcheted Definition of done; decision 15 recorded as an exception, not scheduled work; decision 18 recorded as approved; citations corrected against the brief. Needs Sid's sign-off (P5).
