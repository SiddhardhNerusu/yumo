# Yumo Refine Wave — suggestions, goal engine, macro split, weight ranges, photo journey

**Status:** approved direction (Sid, 2026-07-20 — 4 design calls resolved in chat) · **Author:** Fable 5 (plan) → Opus 4.8 (implement)
**Repo:** `~/Desktop/488/Yumo` (npm-workspaces TS monorepo; RN/Expo SDK 57 app in `app/`). **Not** the Goyo Server repo.
**Parent docs:** `next_wave_master_plan.md` v2 §0 (gates, browser gotchas, owner rules — ALL still binding) · `HANDOFF.md`.
**Base:** HEAD `5fcc800` — gates green: root `npm run typecheck` + `cd app && npx tsc --noEmit` + `npm test` = **298 tests / 29 files**. Every file:line below verified at this commit.

> **How this wave came about.** Sid dogfooded the pushed build and asked for five refinements: (1) kill the "ON THE MENU" section on slot cards → 3 suggestions + a source selector (calories / fridge); (2) time ranges on the weight chart; (3) a real progress-photo page with Goyo-style swipe-through; (4) Settings overhaul — rate-based budget (−1…+1 kg/wk) + activity + all-three-macros-sum-to-100%; (5) this plan. Research pass done: Goyo's photo implementation fully mapped from its source; industry standards pulled from MacroFactor / MyFitnessPal / Lose It / Cronometer / Apple Health / Happy Scale / Hevy / Samsung Food (§2).

---

## 0. Binding ground rules (delta from v2 §0 — read that first)

- Gates: root `npm run typecheck` AND `cd app && npx tsc --noEmit` AND `npm test` (**298 green today**). `app/test/**/*.test.ts` is now a live vitest target — **RN-free modules only** (node env; a test importing an RN component breaks the whole run).
- Browser verify per milestone. Gotchas carried forward: kill stale Metro; **CI-mode Metro serves a stale bundle after edits — restart with `--clear`, hard-navigate is NOT enough**; `resize_window` mobile; real clicks for kit buttons; seed `localStorage` explicitly (`usual.profile.v1` envelope, `yumo.weight.v1` for photos/chart).
- Owner rules: tokens only (no new raw hex — Goyo's viewer uses black/white photo-chrome, that's allowed ONLY inside a full-bleed photo view, mirroring the existing viewer Modal); never-punitive copy (rate/floor messaging is factual, never scolding); no hardcoded food lists; serif for names/titles only; ≤0 emoji.
- Commits: per-milestone to `main`, same trailer/author convention as the last wave. Ask Sid before pushing.
- **Shared-state lesson (M5):** anything read by two mounted screens is a **provider**, not a plain hook.

## 1. Ground truth (verified at `5fcc800` — code against THIS, not memory)

### The budget engine already exists — Settings just never calls it
`packages/shared/src/budget.ts` (88 lines, tested in `packages/shared/test/budget.test.ts`):
- `type Sex = 'male'|'female'` · `type ActivityTier = 'desk'|'onfeet'|'active'|'veryactive'` · `type Goal = 'lose'|'maintain'|'gain'` (**exported from budget.ts via the shared barrel** — nowhere else).
- `ACTIVITY_MULTIPLIER = { desk:1.2, onfeet:1.375, active:1.55, veryactive:1.725 }` and **`ACTIVITY_LABEL`** with copy already written ('Mostly at a desk' / 'On my feet a fair bit' / 'Active most days' / 'Training hard / very active').
- `RATE_MIN=0.25, RATE_MAX=1.0, KCAL_PER_KG=7700`, **sex-specific floors `FLOOR = { male:1500, female:1200 }`** — matches NIH/NHLBI guidance exactly (§2).
- `dailyBudget({weightKg,heightCm,age,sex,activity,goal,rateKgPerWeek}) → { bmr, tdee, dailyDelta, rawTarget, target, floor, floored, edSignpost }` — **gain IS supported** (`dailyDelta = +perDay` for `goal==='gain'`, line 81); rate clamped [0.25, 1.0]; `edSignpost === floored`.

### Onboarding captures everything, then discards it
`app/src/onboarding/OnboardingFlow.tsx`: `OnbState` (:27-45) holds `goal, weightKg, heightCm, age, sex, activity, rateKgPerWeek` (+ prefs). `RATE_PRESETS` (:67-72): 0.25 Gentle / 0.5 Steady / 0.75 Focused / 1.0 Fast. `dailyBudget` called at :150-158. `finish()` (:160-174) builds `UserProfile{ budgetKcal: budget.target, targetWeightKg: s.weightKg, … }` and **discards `age/sex/activity/rateKgPerWeek`** (and `formerlyFit/notifOptIn/healthOptIn`). ⚠️ **`targetWeightKg` is actually the CURRENT weight** — there is no separate target-weight input. Don't redesign that here; just know `targetWeightKg` ≈ "weight at onboarding".
- Persisted envelope (`App.tsx`): `usual.profile.v1` = `{ profile: UserProfile, goal: Goal }` (:57,77,83). `handleDone` :75-80, `handleUpdateProfile` :82-86 (carries existing goal), `handleReset` :88-91.

### Day.tsx slot-card region (the R2 surface)
- Ladder gating (today branch, :592-597): `open = !items.length && !skipped`; `usual` only when `s.isCurrent`; `tiles = open && isCurrent && !usual ? state.tiles.slice(0,3) : []`; `showPlanned = open && !usual && !tiles.length`.
- **QUICK LOG tiles block :711-747**: kicker `Quick log` (:714); tiles rows; divider + **kicker `On the menu` (:732)** + planned row + `MixButton label="Mix"` → `openMix(\`${dayIdx}:${slot}\`, cur.recipe, slot)` (:739); footer `＋ More` / `Skip this meal` (:742-744). **This block is what R2 replaces.**
- `plannedBlock(slot, cur, opts:{loggable,addLink,skipLink})` :369-408 — call sites: future :529 `{f,f,f}`, past :586 `{t,t,f}`, **today showPlanned :749 `{t,t,t}` ← this third call site goes away in R2**; the first two stay untouched.
- Sources in scope: `state.usual`, `state.tiles`, `state.remaining`, `currentFor(slot)` :240-247 (selected day, override-aware), `currentForToday(slot)` :270-281. `Cur = { recipe: MenuRecipe; kcal; protein; carbs; fat; portionScale }` (:41). `logMeal(slot, cur, targetEpoch)` handles pantry decrement + meta; `logTile(slot, t)` for brain tiles.
- Mix engine: `getMixup(recipe, slot, profile, {boostIds?, recentlyUsed?, pantryFit?, userWeights?}) → Promise<MenuRecipe[]>` (repo.ts:121-133, falls back to local `mixItUp` — isocaloric kcal ±10%, protein ±15%, effort ≤ +1, returns top 4).
- `cookability(recipe, have) → { tier:'now'|'oneShort'|'shop', missing[] }` (cookability.ts:37-47); `softScore`/`isAllowed` exported from `@yumo/menu`; `POOL` from `data/menu-seed`.

### Weight UI (R3/R4 surface)
- `WeightChart.tsx` (36 lines): `{data: number[]}`, 7-day trailing MA polyline + ghost dots, min/max ±0.3, **no axes/labels/interaction**. Ghost-dot rgba is pre-existing debt — leave.
- Progress.tsx: delta chip :149-153 = **`latest.kg - first.kg` — change since FIRST weigh-in EVER** (why Sid's 120 kg test read "▴45.8 kg"); hero :158-164 (`weightParts`); chart call :167 (`data={kgs}` = ALL entries); `kgThisWeek` :89-90 (separate, Card 3); PHOTOS strip :188-201 (`photos` = entries with `photoUri`, newest first :92; 72×96 thumbs; caption `kgToDisplay`); viewer Modal :256-272 (single photo, **no swipe/zoom/pager**); `dateLabel(epochDay)` :26-29. M3 unit system (`weightParts/weightDelta/kgToDisplay`) already flows through every surface.
- Overview full-page back-header pattern to copy for any new full page: Overview.tsx:176-189.

### Settings (R1 surface)
Current: `<Sheet>` + ScrollView maxHeight 560 (:127). Order: Premium :128 → Daily budget stepper ±50 `clampBudget(1400,4000)` :137-148 → Daily targets (protein ±5 + Advanced carbs/fat) :150-188 → Variety :190-204 → Weight unit :206-219 (immediate, not save-gated) → Pantry :221-229 → Allergies :231-239 → Start over :241-261 → Save (outside ScrollView) :264-266. `save()` :86-101 writes budgetKcal + touched-only `proteinTargetG/carbTargetG/fatTargetG` + variation/allergies/pantry.
- `macroTargets` (app/src/data/macros.ts:19-21): protein `?? 1.6×targetWeightKg`, fat `?? budget×0.3/9`, carbs `?? remainder` — all `Math.max(1, round(...))`. Call sites: Day.tsx:176, Overview.tsx (+ MacroBar is presentational).
- `budgetKcal` consumers (blast radius when it becomes computed): Day:67→useToday, Overview:136-137/154/161/233, Progress:121, Kitchen:84, Settings, repo.ts:38 (bootstrap payload), menu engine. All read the NUMBER — none care how it was produced. ✓ safe.

### Goyo's photo feature (the R4 design contract — mapped from source)
`Runin/Screens/Calories/WeightSheet.swift` + `WeightPhotoViewer.swift` + `WeightCompareSheet.swift`:
- **Strip:** horizontal 84×112 thumbnails, newest leftmost, trailing dashed "＋ ADD" placeholder; selected thumb full-saturation + ring, others desaturated; caption card below (label + weight + date + COMPARE button).
- **Viewer:** full-screen, hand-rolled drag pager (not TabView) with animated index; header = **date**; footer stat card = **big weight number + "VS. FIRST PHOTO" delta with ▲/▼**; **dot pager** (pill for current); chevron buttons; **drag-down-to-dismiss** with scale+opacity falloff; selection haptic per swipe; long-press → delete confirm.
- **Compare:** side-by-side newer|older with a draggable wipe divider, "N-DAY CHANGE" hero (kg + days), A/B picker tiles, share via snapshot.
- **Data:** photo stores a **frozen weightKg + date** so captions survive edits; photos render as markers on the weight chart; `.scaledToFit` on black (no cropping); empty state = dashed camera invitation.

## 2. Research digest (industry standards — full agent reports in session log)

- **Macro editors:** MFP free = three 5%-step wheels + red "must equal 100%" error (its most-hated UX); MacroFactor = protein-first (1.6–2.2 g/kg) + a single carb↔fat remainder slider (sum can't break); Cronometer Ratios mode = % in, grams auto-recalc whenever energy changes (← we adopt exactly this coupling). Consensus: **auto-rebalance beats free-edit+error**. AMDR: protein 10–35%, carbs 45–65%, fat 20–35% — fitness apps deliberately allow protein above 35%; practical fat floor 15–20%.
- **Rate pickers:** MFP = fixed steps 0.25/0.5/0.75/1 kg/wk loss, gain capped ~0.45; MacroFactor = %BW/wk slider, green "sustainable" band, hard cap 1 kg/wk, **factual (never moral) aggressive-rate copy**; NIH floors 1200-1500F/1500-1800M — our `FLOOR{1500,1200}` already matches. Lean-bulk consensus 0.1–0.5 kg/wk (fastest gains = more fat; MacroFactor: 0.16%BW/wk ≈ 85% lean vs 60-65% at 0.38%).
- **Activity:** consumer standard is **4 levels** with occupational descriptions (our `ActivityTier` + `ACTIVITY_LABEL` are already exactly this).
- **Weight charts:** Apple = D/W/M/6M/Y segmented; year views plot **aggregates, not raw dots**; compact cards stay axis-free (we keep that); MacroFactor = faded raw + bold trend (we already do); Happy Scale's best idea = the delta compares **within a window**, not vs first-ever.
- **Photos:** value ranking across MacroFactor/Hevy/Progress/PhotoJourney: ① date-ordered full-screen pager with date+weight caption (fast swiping = free time-lapse — exactly Sid's ask, and exactly Goyo's build), ② two-date side-by-side compare, ③ ghost overlay at capture (out of scope — we use the OS picker), ④ wipe/share (stretch).
- **Suggestion chips:** "For you" default tab is standard; pantry filter = Samsung Food's "use what you have" (recipes using your ingredients first); **a "fits your remaining budget" chip is a genuine differentiator** — MFP users have begged for it for years and nobody ships it. 3-4 chips inline max; more belongs in a sheet.

## 3. Decisions

Resolved in chat (2026-07-20): **D1 Mix = chip beside the selector** · **D2 budget = recompute on Save + "About you" + latest-weigh-in weight + Custom escape hatch** · **D3 macro editor = auto-rebalance** · **D4 Settings = full page**.

Defaults (build as written unless Sid overrides):

| # | Decision | Default |
|---|---|---|
| D5 | Rate presets: Sid listed ±0.25/0.5/1; onboarding ships 0.25/0.5/0.75/1 | **Keep all four presets** (Gentle/Steady/Focused/Fast) in Settings — matches onboarding, and a user who onboarded at 0.75 must see their own rate. Sid's list reads as shorthand, not an exclusion. **Flagged to Sid** |
| D6 | Chart ranges | Exactly **W · M · Y · All** (his words; Apple's 6M omitted — trivial to add later). Default selection **M** |
| D7 | Macro % steps | **±1% per tap** (5% = ±25 g at 2000 kcal, too coarse for a protein-forward app); grams live under each % |
| D8 | Macro % clamps | protein 10–45 · fat 15–45 · carbs 5–65 (AMDR-derived, protein ceiling raised per fitness-app norm); clamps silent, no warning copy in v1 |
| D9 | Gain rates | Same four pills as loss. At 0.75/1.0 gain show one calm factual line: `Slower gaining keeps more of each kilo as muscle.` |
| D10 | Delta chip semantics | Becomes **window-scoped**: change across the selected range (Happy Scale pattern). Kills the "▴45.8 kg since first-ever" weirdness |
| D11 | Pager orientation | Start at **newest**, swipe left→right moves back in time (Goyo's exact semantics); `vs first photo` delta in the caption |
| D12 | Compare scope | Side-by-side two-photo compare WITH A/B date pickers and day-count delta — **no wipe divider, no share snapshot** in this wave (stretch) |
| D13 | Custom budget mode | Keeps today's stepper + `clampBudget(1400–4000)` untouched. (Known quirk: engine floor for females is 1200 but Custom floor is 1400 — pre-existing, leave) |
| D14 | Suggestion chips | `For you` · `In budget` · `Kitchen` + a trailing `⇄ Mix` chip, one row. "In budget" = kcal ≤ today's remaining |
| D15 | Where new pure logic lives | Generic math → `packages/shared` (`macroSplit.ts`, `weightWindows.ts`); app-data-coupled but RN-free → `app/src/data/` + `app/test/` (`suggest.ts`) |

---

## R0 — Goal prefs foundation (envelope + onboarding stops discarding) — S

1. **New type** in `app/src/data/goalPrefs.ts` (app-side; not engine — `UserProfile` stays pure):
   ```ts
   export interface GoalPrefs {
     heightCm: number; age: number; sex: Sex; activity: ActivityTier;
     rateKgPerWeek: number;            // meaningful when goal !== 'maintain'
     macroPct?: { protein: number; carbs: number; fat: number }; // ints, sum 100
     customBudget?: boolean;           // true → manual kcal stepper is the source
   }
   ```
2. **Envelope** `usual.profile.v1`: `{ profile, goal }` → `{ profile, goal, prefs?: GoalPrefs }`. Backwards-compatible read (old saves parse fine, `prefs` undefined). Touch every read/write: App.tsx :57 (parse), `handleDone`, `handleUpdateProfile` — signature becomes `(p: UserProfile, goal: Goal, prefs?: GoalPrefs)` threaded App → AppShell → Progress → Settings (today `onSave: (p) => void`; goal was previously not editable post-onboarding at all).
3. **Onboarding**: `finish()` also emits `prefs` built from `OnbState` (heightCm/age/sex/activity/rateKgPerWeek). `onDone(profile, goal, prefs)`.
4. **Migration behavior** (old installs, `prefs` undefined): Settings' Goal section opens in **Custom mode** with an inline "Finish your goal setup" card exposing the About-you fields; completing them enables rate mode. Never block; never lose the existing budget number.
5. **Current weight rule (D2):** `currentKg = latest weigh-in ?? profile.targetWeightKg` (which IS onboarding weight — §1). Show the source in the UI: `Using your last weigh-in · 74.2 kg` so a joke entry (Sid logged 120) is visible and self-correcting.
6. **Acceptance:** old envelope parses (unit-test the parse guard in `app/test/`); onboarding round-trips prefs; reset clears them (envelope lives inside `usual.profile.v1` — free).

## R1 — Settings overhaul: full page, goal engine, macro split — L

**Container (D4):** Settings becomes a **full-screen Modal** copying Overview's back-header pattern verbatim (Overview.tsx:176-189; back label `‹ Progress`, kicker `Make it yours`, serif title `Settings`). Keep the Save button pinned bottom (outside the ScrollView, as today). Weight-unit segment stays save-independent.

**New section order:** Premium → **Goal** → **Daily targets** → Weight unit → Variety → Pantry staples → Allergies → Start over.

**Goal section:**
1. Goal segmented (copy the Variety segment pattern + a11y roles, Settings.tsx:190-204): `Lose · Maintain · Gain`.
2. Rate pills when goal ≠ maintain (D5: the four onboarding presets, `RATE_PRESETS` labels reused — lift them out of OnboardingFlow into a shared module rather than duplicating).
3. Activity pills: 4 tiers, labels from **`ACTIVITY_LABEL`** (already in `@yumo/shared` — do not rewrite the copy).
4. About you row: height / age / sex compact inputs (reuse/extract onboarding's `NumberField` if exportable; else minimal local inputs). Weight is **not** an input here — show the D2 source line (`Using your last weigh-in · ⟨w⟩`, formatted via the unit system).
5. **Computed budget card:** on ANY change to goal/rate/activity/about-you, preview `dailyBudget({...}).target` live (pure function, cheap). Anatomy: value 22 w800 tabular + ` kcal/day`, plus a muted line `≈ ⟨tdee⟩ maintenance ⟨− / +⟩ ⟨|dailyDelta|⟩`. When `floored`: calm factual line, never red: `Held at ⟨floor⟩ kcal — going lower isn't something we'll plan for. A gentler pace gets there too.`
6. **Custom escape hatch (D2/D13):** quiet `TextLink` `Set calories manually` toggles `prefs.customBudget` — reveals today's ±50 stepper, hides rate/activity computation (About you stays). Link back: `Use a goal-based budget`.
7. **Save:** rate mode → `budgetKcal = dailyBudget(...).target`; custom → stepper value (existing clamp). Always write `goal` + `prefs` through the new envelope. **Recompute happens ONLY at Save** (D2) — no background drift.

**Daily targets section (replaces the protein-stepper + Advanced block):**
1. **New pure module `packages/shared/src/macroSplit.ts`** + barrel export + tests (NUIA applies — mind `arr[i]`):
   ```ts
   export interface MacroPct { protein: number; carbs: number; fat: number } // ints, sum === 100
   export const MACRO_PCT_CLAMP = { protein:[10,45], carbs:[5,65], fat:[15,45] } as const;  // D8
   defaultMacroPct(budgetKcal, targetWeightKg, proteinTargetG?, fatTargetG?): MacroPct  // from today's derivation, normalized to 100
   rebalanceMacroPct(cur: MacroPct, key, nextVal): MacroPct  // clamp key; distribute the delta over the other two proportionally to their current share; keep ints; ALWAYS returns sum 100
   pctToGrams(pct: MacroPct, budgetKcal): { proteinG; carbsG; fatG }  // P&C ×4, F ×9, rounded
   ```
   Rebalance rules to pin in tests: sum always exactly 100 (rounding remainder goes to the larger of the two others); a neighbor at its clamp floor passes the overflow to the third; moving a key to its own clamp stops there; idempotent when nothing changes.
2. **UI:** three rows (`Protein · Carbs · Fat`), each: 38px `StepBtn` pair, value `⟨n⟩%` 22 w800 tabular, and a muted live-gram line under it (`142 g` — from `pctToGrams` at the CURRENT computed/custom budget, so changing the goal instantly moves the grams — Cronometer's coupling). ±1% per tap (D7). A quiet total line `= 100%` (always true — it's a statement, not a validation).
3. **Persistence:** `prefs.macroPct` is the source of truth; on Save also write the **gram** fields (`proteinTargetG/carbTargetG/fatTargetG` = `pctToGrams(macroPct, finalBudget)`) so `macroTargets()`, MacroBar, Overview meters, and the menu engine (`resolveProteinTargetG`) keep working with **zero changes**. When `macroPct` is absent (pre-migration), seed from `defaultMacroPct(...)`.
4. Keep hint copy: `Protein drives your menu; carbs and fat are guides.` Remove the now-dead `Advanced: carbs & fat` toggle and the `targetsOverBudget` note (a sum-100 editor can't produce the carb collapse — the guard condition becomes unreachable; delete, don't strand).

**Acceptance R1:** shared tests green for `macroSplit` (the pinned rules above) + existing `budget.test.ts` untouched; browser — full-page Settings opens from the cog; pick Lose · Steady · Active → budget card shows the computed number; Save → Today's ring budget changes to it; set macros 30/40/30 → MacroBar targets move to the matching grams; toggle Custom → stepper returns, computed card hides; old-envelope profile (delete `prefs` in localStorage) → Custom mode + finish-setup card, nothing crashes; Start over clears everything.

## R2 — Slot-card suggestions: one block, three sources, Mix chip — M

**What dies:** the today-branch `Quick log` block (Day.tsx:711-747) INCLUDING the `On the menu` kicker/row/Mix button, and the today `showPlanned` plannedBlock call (:749). **What stays untouched:** the `usual` card (the §3.4 moat — when the Brain is confident, it still wins the slot), `plannedBlock` for future (:529) and past (:586) days, the skip/undo rows, `＋ More`.

1. **New pure module `app/src/data/suggest.ts`** (RN-free → `app/test/suggest.test.ts`):
   ```ts
   export type SuggestSource = 'foryou' | 'budget' | 'kitchen';
   export interface Suggestion { kind: 'recipe'; cur: Cur } | { kind: 'tile'; tile: Tile }
   suggestFor(source, ctx: { slot; tiles: Tile[]; planned: Cur|null; pool: MenuRecipe[];
     profile; have: Set<string>; remaining: number; offset: number }): Suggestion[]  // exactly ≤3
   ```
   - `foryou`: dedupe by id: `[...tiles-as-suggestions, planned]`, backfill to 3 from `pool` ranked by `softScore` (slot-affine, `isAllowed`). Cold start (no tiles) ⇒ planned + 2 alternates — the menu engine still feeds day-0.
   - `budget`: pool where `isAllowed && slotAffinity includes slot && perServing.kcal ≤ remaining`, ranked by `softScore`; if none fit, the 3 lowest-kcal slot picks + the quiet line `Not much room left — lighter picks:` (never punitive).
   - `kitchen`: pool ranked `cookability(r, have).tier === 'now'` first, then `'oneShort'` (row shows `Just need: ⟨missing⟩` via the existing PantryLine pattern), by `softScore` within tiers. Empty kitchen ⇒ chip hidden (not disabled).
   - `offset` implements **Mix (D1)**: the Mix chip advances `offset` by 3 with wrap over the ranked list, `haptics.select()` — deterministic re-roll, works identically for all three sources. (The heavier `getMixup` isocaloric engine stays where it lives — recipe-sheet swaps — untouched.)
2. **UI block** (replaces :711-747): kicker `Suggestions` → chip row: `For you · In budget · Kitchen` + trailing `⇄ Mix` chip (use `Chip` from kit; selected = source; Mix is momentary, not selectable) → 3 rows (name → recipe sheet where `kind:'recipe'`; kcal; `＋` logs — `logMeal(slot, cur, epochOf(dayIdx))` for recipes so pantry decrement/meta stay correct, `logTile` for tiles) → footer `＋ More` / `Skip this meal` unchanged.
3. Source selection is per-slot component state (resets daily — fine); default `foryou`.
4. **Acceptance:** suggest.test.ts pins: ≤3, dedupe, cold-start fill, budget filter + fallback, kitchen tiering, offset wrap. Browser: fresh profile (DEMO off) lunch card shows 3 suggestions with NO "On the menu" section; `In budget` respects the ring's remaining after logging something big; `Kitchen` reorders when the fridge changes; Mix re-rolls; ＋ logs and the card flips to the logged state; future/past days unchanged.

## R3 — Weight chart ranges (W · M · Y · All) — S

1. **New pure module `packages/shared/src/weightWindows.ts`** + barrel + tests:
   ```ts
   export type WeightRange = 'w' | 'm' | 'y' | 'all';
   windowWeights(entries: {day,kg}[], range, todayEpoch): { points: {day,kg}[]; delta: number|null }
   ```
   - Windows: w = 7 days, m = 30, y = 365, all = everything.
   - **Aggregation (Apple pattern):** y/all with > 60 raw points → weekly means (`floor(day/7)` buckets, mean kg, midpoint day). w/m stay raw.
   - `delta` = last kg − first kg **within the window** (null if < 2 points).
2. **Progress UI:** segmented pill row `W · M · Y · All` (Variety pattern, default `m` per D6) between the hero and the chart. Chart gets `data={windowed.points.map(p => p.kg)}` — WeightChart itself needs **no change** (self-normalizing; keep axis-free per the compact-card standard, §2). Empty window (no weigh-ins this week) → muted line `No weigh-ins in this window yet.` + keep the button.
3. **Delta chip goes window-scoped (D10):** replace the since-first-ever computation (:87, :149-153) with `windowed.delta`, formatted via `weightDelta(delta, unit)` as today. Chip hides when delta is null. Caption under the chart: `7-day trend · ⟨W|M|Y|All⟩` (trend stays the 7-day MA — EWMA is out of scope).
4. `kgThisWeek` (Card 3) stays as-is — it's a different, correct stat.
5. **Acceptance:** weightWindows tests (window edges, aggregation threshold, delta null rules); browser: seed 400 days of `yumo.weight.v1` → Y shows a clean aggregated line, W shows this week only, chip matches each window, `st` unit renders deltas in lb (existing unit rules).

## R4 — Progress-photo journey (Goyo port) — M/L

Port Goyo's design (§1) into RN, scoped to what Yumo's data supports (photo = `WeightEntry.photoUri`, so date + weight already exist per photo — Goyo's "frozen weight caption" for free).

1. **Entry:** the PHOTOS strip header row gains `See all ›` (TextLink) when `photos.length ≥ 1`; tapping a thumb ALSO opens the journey at that photo (replaces the old single-photo Modal — delete :256-272).
2. **`app/src/screens/PhotoJourney.tsx`** — full-screen Modal (Overview back-header pattern; back label `‹ Progress`, kicker `Your journey`, serif `Photos`):
   - **Pager:** horizontal `FlatList` `pagingEnabled` + `getItemLayout` (RN-web-safe; fall back to `ScrollView pagingEnabled + onMomentumScrollEnd` if FlatList paging misbehaves in the browser — verify there first). One photo per page: `Image resizeMode="contain"` on `#000` full-bleed (photo-chrome exception, mirrors the existing viewer). **Newest first; swiping forward goes back in time (D11).**
   - **Caption card** (Goyo's statCard, tokens not hex — it sits on the photo but can be a floating `surfaceSunken`-on-black pill): date (`dateLabel`) + weight (`kgToDisplay(kg, unit)`) + `vs first photo` delta (`weightDelta(kg − oldest.kg, unit)`, ▲/▼ glyphs like the Progress chip, `success` tint only on loss — surfaceSunken otherwise, exactly the existing chip's never-punitive coloring).
   - **Dot pager** (Goyo): pill for current, dots otherwise; cap visual dots at ~9 with `x of n` text fallback beyond.
   - `haptics.select()` on page change. `Remove photo` + `Close` links as in the current viewer (keep `removePhoto(day)` + confirm via the existing confirm-row pattern, not an OS alert).
3. **Compare (D12):** a `Compare` TextLink in the journey header (enabled at ≥2 photos) → sheet: two photos side-by-side (newer left, per Goyo), each above a compact date pill that cycles through available photo dates; hero line between: `⟨n⟩-day change · ⟨±delta⟩` via `weightDelta`. No wipe divider, no share (out of scope).
4. **Empty state:** strip already handles zero photos; the journey is unreachable then — fine.
5. **Acceptance:** browser — seed 3+ photos in `yumo.weight.v1` (data URIs work on web) → strip `See all ›` opens the journey newest-first; swipe (drag) pages with correct captions and vs-first delta; dot pager tracks; compare shows the right day-count; delete removes and re-pages; unit flip to `lb` reformats captions. Device (§10 smoke list): pager feel, big-image memory.

## 5. Build order & DoD

| Order | Milestone | DoD |
|---|---|---|
| 1 | R0 prefs | envelope round-trip + migration test; onboarding emits prefs; gates green |
| 2 | R1 settings | macroSplit tests pinned green; full-page Settings; computed budget live-previews and lands on Save; Custom + migration paths; browser-verified end-to-end |
| 3 | R2 suggestions | suggest tests green; ON THE MENU gone; 3 sources + Mix verified in browser; usual card + future/past days untouched |
| 4 | R3 chart | weightWindows tests green; W/M/Y/All + window delta browser-verified incl. aggregated Y |
| 5 | R4 photos | journey + compare browser-verified; old viewer deleted; device items listed for the smoke test |

Each milestone: all three gates + one commit. **298 is the floor** — every milestone adds tests, none may lose one.

## 6. Out of scope (this wave)

Adaptive/weekly TDEE (MacroFactor-style — revisit as its own wave) · EWMA trend line · per-day-of-week macro goals · named macro presets (balanced/low-carb) · 6M range · wipe-divider compare + share-image render · ghost overlay at capture / in-app camera · timelapse export · photo angles (front/side/back) · a real target-weight input (the `targetWeightKg`-is-current-weight quirk) · reconciling Custom-floor 1400 vs engine floor 1200 · server sync of prefs · the M1/M6/M7 native remainders (unchanged, still pending the EAS build).

## 7. Open flags for Sid

1. **D5:** Settings shows all four rate presets (incl. 0.75 Focused), not just the three you listed — matching onboarding. Say the word to drop 0.75.
2. `In budget` / `Kitchen` chip labels are my compression of "calories / what's in your fridge" — happy to rename.
3. The compare wipe-divider + shareable image (Goyo's flashiest bits) are out of scope this wave — flag if you want them in.
