# Yumo — Design Brief

*A briefing for a designer picking up the app. Everything here describes what exists today (built and verified) plus the intended vision. Read top to bottom; the "Where design help matters most" section at the end points you at the highest-value work.*

---

## 1. What Yumo is

**One-liner:** *The calorie app that learns you.*

**Positioning:** "MyFitnessPal makes you search. Cal AI makes you snap. We just ask: **the usual?** — one tap, and it's logged."

Calorie tracking apps lose ~97% of users by day 30, and the #1 documented reason is **logging friction** — too much typing, too much effort. Photo logging (snap your plate) is now commoditised and inaccurate. Yumo's bet is different: a **per-user habit model** that predicts what you're about to eat and lets you confirm it in **one tap**, ideally from the lock screen without opening the app.

**The two moats:**
1. **The Brain** — an on-device model of *your* eating habits. It gets sharper every day and powers proactive one-tap logging. Photo AI is static; this compounds per user.
2. **The Catalogue + "Mix it up"** — a 7-day flexible menu with isocaloric swaps and ≤6-step "tired at 7pm" recipes. Trackers don't cook; recipe apps don't track. Yumo sits on the seam.

**Free vs Premium:** The full Brain, barcode, budget ring and all logging are **free forever** (retention engine). Premium (£9.99/mo · £39.99/yr, 7-day trial) unlocks the full 7-day menu, weekly regeneration, pantry-aware curation, and coach insights/history.

---

## 2. Who it's for & the emotional job

- People trying to lose / maintain / gain weight who find calorie counting **tedious and a bit punishing**.
- **Tone is a product feature.** Motivation/coach support was the #2 unmet need in research. The app must feel **warm, brief, and never punitive** — no red "over budget / failed" screens, no moralising.
- **Design target: Day-3 retention.** The first three days decide everything. Every meal should be ≤3 taps to log.
- **Safety is non-negotiable.** Eating-disorder guardrails (see §10): calorie floors, gentle check-ins, never "earn your food" exercise framing.

---

## 3. Brand & current visual identity

**Name:** Yumo (warm, food-y, short). Home-screen icon says "Yumo".

**Current aesthetic:** dark-first, warm charcoal, single burnt-orange accent, high-contrast type. It should feel calm, premium, and encouraging — closer to a well-made habit app than a clinical health tracker. The palette was deliberately warmed up (it read "washed out" on device early on).

### Design tokens (the current system — source of truth)

Colour is defined for **both light and dark** themes; the app currently ships dark and adapts to the device.

**Dark (primary):**
| Token | Hex | Use |
|---|---|---|
| `bg` | `#131110` | app background |
| `surface` | `#221E19` | cards |
| `surfaceSunken` | `#0D0B0A` | inset rows/tiles inside a card |
| `border` | `#38302A` | hairline borders |
| `textPrimary` | `#F8F4ED` | headings, key numbers |
| `textSecondary` | `#C9BEAF` | body |
| `textMuted` | `#998E7E` | captions, labels |
| `accent` | `#FF6A3D` | the one accent (buttons, ring, current-slot) |
| `accentText` | `#1A1310` | text on accent (dark, for contrast) |
| `accentSubtle` | `#33200F` | tinted accent chip background |
| `accentSubtleText` | `#FFB392` | text on accentSubtle |
| `success` | `#5FC48C` | logged confirmations, weight-down |
| `warning` | `#E9B45C` | — |
| `danger` | `#FF7A5C` | destructive (start over) |
| `ringTrack` | `#38302A` | budget ring unfilled track |

**Light:**
`bg #FBF7F2` · `surface #FFFFFF` · `surfaceSunken #F1EAE1` · `border #E7DBCD` · `textPrimary #1C1815` · `textSecondary #5E544A` · `textMuted #746A5C` · `accent #C2410C` · `accentText #FFFFFF` · `accentSubtle #FCE7DC` · `accentSubtleText #8A2F12` · `success #2E6B4A` · `warning #8A5A0B` · `danger #B23A22` · `ringTrack #ECE1D4`

**Type scale** (system-ui): `micro 11 · caption 13 · callout 14 · body 15 · subhead 17 · heading 20 · title 26 · display 34`. Weights `400/500/600/700`. Line-heights `tight 1.15 · snug 1.3 · normal 1.45`. Screen titles currently render ~30px/800 (a touch above `title`).

**Spacing scale:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Screen padding is 20; card padding 16–20; gap between stacked cards ~12–20.

**Radius:** `sm 8 · md 12 · lg 16 (cards) · xl 24 (bottom sheets) · pill 999 (chips, buttons-as-pills)`.

**Motion:** `instant 80 · fast 120 · base 200 · slow 320` ms.

### Binding design principles (do not break these)
1. **One accent colour.** Warm neutral ladder for everything else. Accent discipline — if everything is accent, nothing is. (Earlier versions overused it; that was a bug.)
2. **WCAG AA on all text**, both themes. This is enforced by an automated contrast test — any new colour pairing must pass. (That's why accent-on-dark uses dark `accentText`, and tinted chips use the `accentSubtle`/`accentSubtleText` pairing.)
3. **Never punitive.** No red for overage. Overage copy: *"Big day today — tomorrow's a fresh one."* Never "over budget / failed / bad."
4. **Emoji sparing** (≤1 per line). The one signature emoji moment is the ✨ "learning" chip.
5. **A rough log beats an abandoned day.** Quick-add estimates are first-class, not buried.

---

## 4. Information architecture

```
Onboarding (one-time, ~1 min)  →  App shell with 3 bottom tabs:
   • Today     (home — the daily loop)
   • Menu      (the week's meals)
   • Progress  (weight, streak, adherence, settings)
```

A soft, skippable **paywall** appears once, just after onboarding's menu reveal, and again at premium touchpoints.

---

## 5. Onboarding flow (screen by screen)

Progress dots across the top. Warm one-line prompts. Order:

1. **Welcome** — "The calorie app that learns you." + "We'll just ask 'the usual?' — one tap logs it."
2. **Goal** — Lose / Maintain / Gain, plus an optional "I used to be in shape" toggle (only flavours the coaching).
3. **Body** — weight, height, age, sex. *(Currently metric only — imperial is a known gap.)*
4. **Activity** — 4 tiers (desk / on-feet / active / very active).
5. **Rate** — how fast (gentle → aggressive; four presets 0.25–1.0 kg/wk). *(A continuous slider is a design opportunity.)*
6. **Number reveal** — the hero screen. Big kcal/day number, "How did we get this?" expander showing the maths (BMR → ×activity → −deficit → target), and a **Share** button (this screenshot is a growth loop). A gentle ED floor note appears if the target is clamped.
7. **Needs bubbles** — "Can't live without…" (≤3). A **physics bubble cloud**: tap a food to fan out related foods around it (Apple-Music / Pinterest interest-picker style).
8. **Likes bubbles** — soft cap 12.
9. **Hates bubbles** — uncapped; never suggested.
10. **Allergies** — the 14 UK allergen classes; copy stresses "we help, we don't guarantee — always check labels."
11. **Pantry** — staples you usually have in (menu leans on them). Editable later ("I did a shop").
12. **Variation dial** — Creature of habit / Balanced / Mix it up.
13. **Cuisine lean** — data-driven chips (only cuisines with real recipes behind them); tap once for "more", twice for "less".
14. **Menu reveal** — "Your menu's ready — chicken most days, never tuna, ~2,200 kcal a day."
15. **Asks** — notification + Health permissions, framed contextually (never the cold OS prompt first).

**The bubble cloud** is a signature interaction and a design centrepiece — floating, tappable, expands around the tap point. It's real and working but could be made more delightful (motion, sizing, long-press-for-info is not yet built).

---

## 6. Today tab (the daily loop) — home

Top-to-bottom:

- **Greeting kicker** — time-aware ("Good morning" / "Midday check-in" / "Winding down"), above the "Today" title.
- **Budget ring** — a circular ring: big "kcal left" number, "X of Y eaten" below. Fills with accent as you eat. *(A planned but unbuilt element: an "+150 kcal from your walk — use it?" activity chip.)*
- **Coach line** — one warm sentence that varies by state and rotates daily (e.g. "Cruising along — 1,370 kcal to go."). Cold-start users also see "I get sharper every day you log — give me a week."
- **Learning chip (magic moment)** — when the Brain notices a real pattern, a ✨ chip appears: *"Got it — Fridays are different 👍."* This is the shareable "wow."
- **ED check-in card** — gentle, dismissible, only if intake runs very low for days (support link). Never alarming.
- **The four meal slots** — Breakfast / Lunch / Dinner / Snack, each a card:
  - The **current slot** has an accent border and shows the prediction inline: either the high-confidence **"The usual? — Chicken & rice · 400g"** with `✓ Log it` / `Something else →`, or the top-3 **tiles** for a one-tap log.
  - **Logged** slots list their items with kcal (tap to edit portion / move / delete).
  - Each slot has a quiet **＋ Add** (opens search for that slot) and the current one offers **Skip** ("meal off" — streak-safe).
- **Log search sheet** — recents-first, then debounced server search; **barcode** (scan a number → OpenFoodFacts); and **Quick-add** (rough "~700 kcal" estimate). Barcode + quick-add are first-class and free.

**The core loop:** predict → one tap → ring + timeline update → the Brain re-predicts. This works end-to-end today.

---

## 7. Menu tab (the week)

- **Week header** — "This week", a **↻ New week** regenerate button (the weekly ritual).
- **Day selector** — 7 pills (opens to today).
- **Per-day meal cards** — Breakfast / Lunch / Dinner / Snack. Each card:
  - Name · cuisine · effort tier (5min / 15min / 30min+) · kcal
  - **Macro pills** — P / C / F in grams (protein in accent)
  - **[Log it]** → logs that pre-quantified meal to your day (becomes "✓ Logged")
  - **[Mix it up]** → 3–4 isocaloric alternatives (same slot, ±10% kcal), tap to swap; the swap teaches the Brain your preferences
  - **[Recipe]** → a **bottom sheet** with a **"You'll need"** ingredient list *with exact quantities* ("Rolled oats — 50g") then ≤6 numbered steps. Recipes are never inline — always tap-to-reveal.

Recipes are "tired at 7pm" simple: one pan where possible, short steps, exact amounts.

---

## 8. Mix it up — the swap engine (the heart of Moat #2)

*This is one of the two things that make Yumo defensible. Give it real design weight.*

**What it is:** every suggested or planned meal carries a **Mix it up** button. Tap it and Yumo offers **3–4 isocaloric alternatives** — different dishes that fit the *same* slot and keep your day on track:
- **Same slot** (a lunch only swaps for a lunch)
- **±10% calories, ±15% protein** — your budget and macros barely move, so a swap never blows your day
- **Allergy / hate filtered** — never offers something you can't or won't eat
- **Pantry-boosted** — favours what you already have in
- **Effort ≤ original + one tier** — won't swap a 5-minute meal for a 30-minute faff

**Why it's a moat, not a feature.** Meal-plan apps fail because plans are **rigid**: the moment you don't fancy the planned dinner, or don't have the ingredients, the plan breaks and you quit. (This is exactly why planner apps like Eat This Much never won — a plan without an escape hatch.) Mix it up removes that failure mode — **you're never stuck with a meal you don't want.** Trackers don't help you decide what to eat; recipe apps don't track what you ate. Yumo sits on the seam: **the menu bends to you, instead of you bending to it.**

**It learns from every swap.** Picking "Chicken curry" over "Salmon & greens" is a preference signal, and **future weekly menus re-weight toward what you actually swap to.** Over a few weeks the menu quietly becomes *yours* — the same compounding-per-user effect as the Brain. (This feedback loop is built and working today.)

**The interaction now:** tap "Mix it up" on a meal card → a panel expands inline listing 3–4 ranked alternatives (name + kcal) → tap one → it swaps into the menu and becomes one-tap loggable. Ranked: cuisine lean → foods you like → Brain preference → novelty (per your variation dial). Unlimited during beta.

**Where design can lift it (high value):**
- Make the swap feel **effortless and a little joyful** — "oh, I'll have *that* instead" should be a delight, not a form.
- **Show *why* each alternative is offered** — chips like "same macros", "uses your pantry", "you like this", "something new" — so the swap feels intelligent, not random.
- Make the **"same calories, different meal"** guarantee legible at a glance — the isocaloric promise *is* the magic; surface it (e.g. show that all options land within a few kcal of the original).
- Surface the **learning** — a subtle "we'll lean this way next week" so the user feels the menu adapting to them.
- Consider elevating the swap from the current inline panel to a **focused bottom sheet / dedicated moment** — it's important enough to deserve the stage.

---

## 9. Progress tab

- **Streak** with **freeze** — a big day count; a missed day *freezes* (not resets); a logged "meal off" preserves it. Computed from real history.
- **Weight** — current weight, change vs start, a 7-day-smoothed line with ghosted raw dots.
- **This week** — an adherence strip of 7 dots (days *logged*, not days "under") + "X of 7 days logged — the habit's what counts."
- **Weekly recap** — a warm coach card.
- **Settings** (top-right) — edit budget, variation, allergies, pantry; go Premium; start over.

---

## 10. Cross-cutting systems

- **Coach voice** — short templated lines (no chatbot), warm and non-moralising, surfaced on: nudges, menu reveal, learning moments, weekly recap, overage. Copy is centrally versioned so it can be A/B-tuned.
- **"The usual?" nudge** — the signature interaction. High-confidence prediction = 1 tap. Medium = tiles (2 taps). Low = silent search. Never auto-logs — every prediction is a question.
- **Mix it up** — isocaloric swaps that keep macros roughly constant; unlimited during beta.
- **Paywall** — annual-first, soft, skippable; 7-day trial; warm feature list, not a hard wall.
- **ED guardrails** — calorie floors (never below 1,500 M / 1,200 F), a gentle 5-day-low signpost with helpline links, no red/punitive states, no exercise-as-punishment.

---

## 11. What's built vs. what's next (scope for a designer)

**Built & working today** (verified in a live web build): onboarding (incl. bubble cloud), Today 4-slot loop with predictions + logging, budget ring, coach copy, learning chip, ED signpost, Menu with macros + Mix it up + recipe sheet with quantities, Progress with computed streak/adherence/weight, search/barcode/quick-add, paywall, settings, data-driven cuisines.

**Designed in spec but NOT yet native (the hero moat still needs design):**
- **Lock-screen widget** — ring + "the usual?" with tap-to-log. This is *the* marketing image and isn't visually designed yet.
- **Actionable notifications** — "time to eat" → [Log now] [Something else] → confirmation ("Logged 🍚 620 kcal — 1,410 left").
- **Apple Watch / Live Activity** surface.

**Fast-follow (not MVP):** photo logging, voice logging, user-created recipes, real food photography (launch is text-first typographic cards — no AI food images).

**Known rough edges to polish:** the onboarding "Female" button wraps awkwardly; imperial units; the rate slider is currently discrete buttons; the activity-adjustment chip on the ring; richer bubble-cloud motion.

---

## 12. Where design help matters most (priorities)

1. **The lock-screen widget + actionable notification** — the entire product promise ("one tap from your lock screen") lives here and has no visual design yet. Highest leverage.
2. **Mix it up (the swap moment)** — Moat #2's heart (see §8). The isocaloric-swap interaction should feel effortless and joyful, show *why* each alternative is offered, and make the "same calories, different meal" promise obvious. Currently a plain inline list — big upside.
3. **The Today home screen** — it's the screen people live in. The 4-slot layout works but could be more beautiful and more clearly hierarchical (ring as hero, current slot obvious, logged vs open states crisp).
4. **The bubble-cloud onboarding** — signature, delightful, differentiating. Motion and polish.
5. **The number-reveal + Share** — a growth loop; make the shared image gorgeous.
6. **The menu meal card** — carries name, cuisine, effort, kcal, P/C/F, and three actions (Log it / Mix it up / Recipe). Information-dense; needs a designer's hand to stay scannable.
7. **A cohesive component pass** — buttons, chips, cards, sheets, empty states — so the whole app reads as one system in both light and dark.

**Constraints to honour:** one accent, warm neutral ladder, WCAG AA (enforced), never punitive, ≤1 emoji/line, and keep it to the three tabs — nothing new enters v1 that isn't in this brief.

---

## 13. Quick screen/component inventory

Onboarding (15 steps) · App shell (3 tabs) · Today (ring, coach line, learning chip, ED card, 4 meal-slot cards, prediction/tiles, log-search sheet, edit sheet) · Menu (week header, day pills, meal cards with macros, mix-it-up panel, recipe bottom sheet) · Progress (streak card, weight chart, adherence strip, recap card, settings modal) · Paywall · Budget ring · Bubble cloud.
