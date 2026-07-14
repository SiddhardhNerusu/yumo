# Yumo — UI Redesign Master Brief (v1)

Handoff spec for implementing the approved redesign in the existing React Native app
(`usual/app`). Everything below was signed off in interactive HTML prototypes; implement
it **exactly** — values are literal, not suggestions.

Prototype references (HTML, open in browser): `Menu — Redesign.dc.html`,
`Today — Redesign.dc.html`, `Progress — Redesign.dc.html`.

---

## 1. Scope

Full visual + interaction overhaul of the three tabs (**Today · Menu · Progress**), the
**Settings sheet**, the **Add-food sheet**, the **Mix-it-up sheet**, the **Recipe sheet**,
and the **tab bar**. Onboarding, paywall, and widget are out of scope for this pass.

Files affected (existing): `packages/tokens/tokens.json`, `app/src/theme.ts`,
`app/src/AppShell.tsx`, `app/src/screens/Menu.tsx`, `app/src/screens/Today.tsx`,
`app/src/screens/Progress.tsx`, `app/src/components/RecipeSheet.tsx`,
`app/src/components/Settings.tsx`, `app/src/components/LogSearch.tsx` (replaced by the
new Add sheet), `app/src/components/BudgetRing.tsx`, `app/src/components/CoachLine.tsx`.

---

## 2. Design tokens (update `tokens.json` — dark theme)

The redesign is dark-first. Update the dark ladder to these values (light theme untouched
for now):

```json
"dark": {
  "bg":            "#17130F",
  "surface":       "#211B15",
  "surfaceSunken": "#191510",
  "sheet":         "#221C16",
  "chipSurface":   "#231D17",
  "mixSurface":    "#2B2118",
  "border":        "rgba(247,242,234,0.07)",
  "borderStrong":  "rgba(247,242,234,0.12)",
  "divider":       "rgba(247,242,234,0.05)",
  "textPrimary":   "#F7F2EA",
  "textSecondary": "#C7BBAA",
  "textMuted":     "#9C8F7C",
  "textLogged":    "#E9E1D3",
  "accent":        "#FF6A3D",
  "accentText":    "#1A1310",
  "accentSoft":    "#FBA78B",
  "accentFaint":   "rgba(255,106,61,0.13)",
  "success":       "#5FC48C",
  "successFaint":  "rgba(95,196,140,0.12)",
  "ringTrack":     "rgba(247,242,234,0.08)"
}
```

Notes:
- `accentSoft` / `accentFaint` are precomputed mixes of accent (RN has no `color-mix`).
  If accent ever changes: soft = 55% accent over `#F7F2EA`; faint = accent at 13% alpha.
- Borders move from solid hex to alpha hairlines — this is deliberate; keep them.
- `success` is used ONLY for logged/positive states. Never a red/punitive state (ED rule).

### Typography

Two families:
- **UI (sans):** system font, as today.
- **Display (serif): `Newsreader`** (Google Fonts; use `@expo-google-fonts/newsreader`,
  weights 400/500 + italic 400). Used for: screen titles, meal names, sheet titles,
  coach line (italic).

Type ramp used in the screens (px):
- Screen title: 36 serif w500, letterSpacing −0.5, lineHeight 1.05
- Screen kicker: 12 sans w600, letterSpacing 1.4, UPPERCASE, textMuted
- Card meal name: 23 serif w500, lineHeight 1.15
- Sheet title: 24 serif w500
- Sheet option name: 19 serif; featured suggestion (Today): 23 serif
- Slot label: 11 sans w700, letterSpacing 1.2, UPPERCASE
- Section kicker (sheets): same as slot label
- Body/rows: 15 sans; meta/captions 12–13 sans; buttons 14 sans w600–700
- Big numbers (ring, streak): 42 / 34 sans w800, tabular-nums, letterSpacing −1
- ALL numeric figures use tabular numerals (`fontVariant: ['tabular-nums']`)

### Shape & spacing
- Cards: radius 20, padding 16–18, bg `surface`, 1px `border` (current slot: 1.5px accent @55%)
- Sheets: radius 26 top corners, bg `sheet`, grabber 36×4 `rgba(247,242,234,0.15)`,
  padding 12 20 36(–40), backdrop `rgba(0,0,0,0.55)`, shadow 0 −12 40 rgba(0,0,0,0.4)
- ALL buttons/chips are pills (radius 999). No rectangular buttons anywhere.
- Screen padding: 20 horizontal; header top 64; card gap 10
- Motion: sheet slide-up 260ms cubic-bezier(0.32,0.72,0,1); backdrop fade 180ms;
  content swap-in 220ms (fade + 6px rise); press scale 0.97

### Button vocabulary (used everywhere)
1. **Primary**: accent bg, `accentText` label, w700 14, pill, padding 11×(flex or 16–20)
2. **Mix it up**: bg `mixSurface` (#2B2118), label `accentSoft`, w600, with ⇄ glyph
3. **Quiet outline**: transparent bg, 1px `borderStrong`, label `textSecondary`
4. **Text link**: no chrome, `accentSoft` (positive) or `textMuted` (neutral)
5. **Selected chip**: accent bg + accent border, `accentText` label;
   unselected: `surfaceSunken` bg, `rgba(247,242,234,0.09)` border, `textSecondary`

---

## 3. Tab bar (AppShell)

Replace text-only tabs with icon + label, both colored accent when active, textMuted when
not:
- Today: ring icon (circle outline r7.5 stroke2 + center dot r2.5)
- Menu: three rounded bars (16/16/10 wide × 2.6, radius 1.3)
- Progress: three vertical rounded bars (heights 7.5/11.5/15)
- Label: 11px, w600 (active w700)
- Bar: top hairline `border`, bg `bg` at 94% opacity + blur, padding 8 top / 26 bottom
  (safe area)

---

## 4. Menu screen

Header: kicker "THIS WEEK" + serif title "Menu"; right: "↻ New week" pill
(bg `chipSurface`, hairline border, textSecondary 13 w600). Regenerating: swap label to "…".

Day strip: 7 equal-width cells (flex:1, gap 4), each a pill radius 14, padding 9/8:
weekday 11 w600 top, day-number 16 w700 below. Selected: accent bg, `accentText` text
(top label at 70% opacity). Unselected: transparent bg, textMuted / textPrimary.
Switching day closes any open mix state.

Summary line: "`{dayTotal}` **kcal planned**" (total 15 w700 primary, label 13 muted);
right-aligned "`{n}` logged ✓" in success when > 0.

Meal card (per slot Breakfast/Lunch/Dinner/Snack):
- Row 1: SLOT LABEL (muted) ··· "cuisine · effort" (12 muted) right
- Row 2: meal name 23 serif ··· kcal (16 w700 + " kcal" 12 muted) right, baseline-aligned
- Row 3: macros, one quiet line — equal emphasis, NO protein highlighting:
  "`{p}g` protein `{c}g` carbs `{f}g` fat" (values 13 w600 textSecondary, labels 13 muted, gap 14)
- Row 4 (mt 16): [Log it — primary, flex:1] [⇄ Mix it up] [Recipe — quiet outline]
- Logged state: Log button becomes a static pill: bg `successFaint`, "✓ Logged" success
  w700; card border becomes `rgba(95,196,140,0.25)`

Log-it behavior: 1 tap → logged, updates summary count. (Wire to existing
`logFood` accept-to-log path.)

### Mix it up — bottom sheet (default; keep the old inline list behind a flag if desired)
- Title "Mix it up" 24 serif; subtitle 13 muted: "Same slot, same calories — a different meal."
- 3 option cards (bg `surfaceSunken`, radius 16, hairline; hover/press border accent@45%):
  - Row 1: name 19 serif ··· kcal right
  - Row 2: reason chip (12 w600 `accentSoft` on `accentFaint` pill) + macro line
    "45P · 78C · 21F" 12 muted
  - Reason strings: "Same macros" / "Uses your pantry" / "You like this" /
    "Something new" (from swap-engine signals; "Back to the usual" when returning)
- Footer: quiet outline full-width "Keep `{currentMealName}`"
- Picking an option swaps the card content in place (220ms swap-in), closes sheet,
  records the preference signal (`recordMixupPick`).

### Recipe — bottom sheet
- Title: name 24 serif ··· kcal right
- "YOU'LL NEED" kicker; ingredient rows: name 15 left, quantity 14 textSecondary right,
  hairline divider between rows
- "HOW TO MAKE IT" kicker; steps: 24px numbered circle (`accentFaint` bg, `accentSoft`
  number) + step text 15/1.5
- Footer: primary full-width "Done"

---

## 5. Today screen

Header: kicker = time-aware greeting ("GOOD MORNING/AFTERNOON/EVENING") + serif "Today";
right: date "Fri 11 Jul" 13 muted.

Budget ring (hero): 196px, stroke 13, track `ringTrack`, progress accent with round caps,
starts at 12 o'clock; animate offset 600ms. Center: kcal-left 42 w800, "kcal left" 13
muted. Below ring: "`{eaten}` eaten · `{budget}` budget" 13 muted.

Coach line (italic serif 16, textSecondary, centered) — **computed, never decorative**:
- remaining planned slots fit: "Your lunch + dinner + snack fit today's budget with `{spare}` kcal spare."
- over: "The menu runs `{over}` kcal over — Mix it up for a lighter pick."
- all logged: "`{left}` kcal spare today — nicely done." / "Day logged. Tomorrow is a fresh start."
- NO generic filler lines, NO "learning chip".

Meal slot cards (same card anatomy as Menu):
- Header row: SLOT LABEL (current slot: `accentSoft`) ··· slot total when items exist
  (13 w600 textSecondary + " kcal" 11 muted)
- Logged items — quiet checked sub-list (sans, NOT serif): rows of
  ✓ (success 12) · name 15 w500 `textLogged` · kcal 13 muted right; 8px vertical padding,
  `divider` hairline between rows
- **Current slot** (accent-bordered) when nothing logged: featured planned meal
  - name 23 serif ··· kcal right; meta "British · 15 min · from your menu" 13 muted
  - Actions: [Log it — primary flex] [⇄ Mix it up] [Recipe]
  - Below a `divider`: centered text links "＋ Add more" (`accentSoft`) · "Skip this meal"
    (muted). NO other buttons — hierarchy is: one primary row, one quiet text row.
  - Mix it up opens the same sheet as Menu; picking swaps the featured suggestion
    (does NOT log). Recipe opens the recipe sheet for the suggestion.
- Other slots: just a small "＋ Add" quiet outline pill (muted label)
- Skip state: "Skipped — no worries." 14 muted

### Add sheet (replaces LogSearch modal)
- Title "Add to `{Slot}`" 24 serif ··· "Cancel" text link
- Search field (bg `surfaceSunken`, radius 14, hairline; focus border accent@50%) +
  square barcode button (44–48px, barcode glyph)
- **Calorie filter** (NOT quick-add): 4 equal pills "All · ~250 · ~500 · ~700".
  Selected = accent. Filters both sections by nearest band
  (item's nearest of 250/500/700 must equal the selected band). There is NO
  "add 500 kcal of nothing" — estimates without macros were removed on purpose.
- "FROM YOUR MENU" (hidden while searching/filtering): planned meal for that slot as a
  highlighted row (bg `accentFaint`, name 18 serif, kcal `accentSoft` w700) — one tap logs
- "MEALS": rows name 15 + macro line "45P · 78C · 21F" 12 muted · kcal + ＋ (`accentSoft`)
- "FOODS": single ingredients (bread, milk, banana, eggs…) rows name 15 + portion 12 muted
  ("1 slice", "200ml") · kcal + ＋
- Empty state: "Nothing matching — try a different search or filter."
- Any add: closes sheet, item appears in slot list (swap-in), ring + coach line update.

---

## 6. Progress screen

Header: kicker "LAST 3 WEEKS" + serif "Progress"; right: "Settings" pill (same style as
New week).

Card 1 — Streak + this week (one card, not two):
- "**22** day streak" (34 w800 + 14 muted) ··· "1 freeze banked" 13 muted
- 7 day dots (26px circles, flex row): logged = accent bg + `accentText` ✓; labels
  S M T W T F S 11 muted below
- Caption 13 muted: "7 of 7 days logged — the habit's what counts."

Card 2 — Weight:
- "WEIGHT" kicker ··· change chip "▾ 1.5 kg" (success on `successFaint` pill)
- "79.1 kg" (30 w800 + 14 muted)
- Chart 120px: ghosted daily weigh-ins as round dots `rgba(247,242,234,0.18)` (r≈2.3);
  7-day moving-average trend as accent line, stroke 3, round caps. No axes, no grid.
- Caption: "7-day trend · daily weigh-ins ghosted"

Card 3 — Weekly recap: three equal columns split by vertical hairlines:
"2,080 / avg kcal per day" · "6 of 7 / days on target" · "−0.5 / kg this week"
(values 20 w800; the kg delta in success; labels 12 muted)

Below cards: italic serif recap line, centered:
"Down 1.5 kg over three weeks — steady as you like."

### Settings — bottom sheet (max-height 88%)
- Title "Settings" serif ··· "Close" text link
- **Go Premium** row: bg `accentFaint` radius 16; "Go Premium" `accentSoft` 15 w700 +
  "Full menu · weekly regen · coach insights" 12 muted; chevron ›. (One line, no emoji.)
- "DAILY BUDGET": stepper row (bg `surfaceSunken` radius 16): − / value 22 w800 tabular +
  "kcal" / ＋. 38px round bordered buttons, ±50 kcal steps, clamp 1400–4000
  (kcal floor is an ED guardrail — keep it).
- "VARIETY": segmented control in a pill track (bg `surfaceSunken`, padding 4):
  Habit · Balanced · Mix it up; selected = accent pill. Hint line below (12 muted):
  Habit "Mostly your usuals — the menu repeats what works." /
  Balanced "A steady mix of usuals and fresh ideas." /
  Mix it up "Something new most days — maximum variety."
- "PANTRY STAPLES" chip cloud (18 items) and "ALLERGIES" chip cloud (14 EU allergens):
  selected-chip style from §2; 7px gaps, wrap
- "Start over — clear profile & logs": quiet muted text button, hover/press shifts to
  danger tint. NO red resting state.
- Footer: primary full-width "Save changes"

---

## 7. Cross-cutting rules (unchanged product law)

- Never punitive: no red overage, success-green reserved for positive states
- kcal floors enforced in budget stepper
- ≤1 emoji per line; the redesign currently uses none — keep it that way
- Every meal ≤3 taps to log; "the usual?" is 1 tap from Today
- All copy tone: warm, plain, no exclamation-mark cheerleading
- WCAG AA: the new ladder passes on `bg`/`surface`/`sheet` — keep the token contrast test
  green (`textMuted` #9C8F7C is the floor; never use it below 11px)

## 8. Implementation order (suggested)

1. tokens.json + theme.ts (new dark ladder, serif family plumbed through)
2. AppShell tab bar
3. Menu screen + Mix sheet + Recipe sheet restyle
4. Today screen (ring, coach line computation, slot cards, Add sheet replacing LogSearch)
5. Progress + Settings sheet
6. Delete dead styles; sweep for old hex values (#131110, #221E19, #0D0B0A, #38302A,
   #F8F4ED, #C9BEAF, #998E7E, #33200F, #FFB392 should no longer appear)
