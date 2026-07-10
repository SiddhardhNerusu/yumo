# Menu engine (§4.3) + Mix it up (§4.4)

**Status: BUILT & verified.** `@yumo/menu` — pure TS, deterministic. This is
the seam of moat #2: it turns the catalogue into a personalised, constraint-
satisfying 7-day menu, and it feeds the Brain's `menuPrior`.

See it run end-to-end (catalogue → macros → menu): `npm run menu:demo`

## What it does

Given a `MenuRecipe[]` pool (built by the server from published catalogue
recipes) and a `UserProfile`, `generateWeekMenu` produces 7 days × 4 slots:

**Hard constraints (never violated):**
- allergies excluded at the allergen-class level;
- hated ingredients excluded;
- each **need** pinned ≥1×/day in a natural slot;
- day total within **±5%** of budget (uniform portion-repair pass).

**Soft signals (weighted sampling, deterministic seed):**
- likes ↑, pantry-compatibility ↑, cuisine-lean multiplier;
- novelty per the variation dial (0.2 / 0.5 / 0.8) — penalises repeats;
- protein floor 1.6 g/kg (paces toward the day's protein target);
- closeness to the slot envelope (B 25 / L 32.5 / D 32.5 / S 10);
- effort mix: ≤2 "30min+" dinners/week.

**Mix it up (`mixItUp`)** — same slot, kcal ±10%, protein ±15%, allergy/hate
filtered, effort ≤ original +1 tier, ranked by soft preference.

## Verified (12 tests + live demo)

- Allergen/hate recipes never appear; needs appear every day; no same-day repeat.
- Every day within ±5% of budget; all 4 slots filled; ≤2 hard dinners/week.
- Same seed → byte-identical menu (replay-testable); cuisine lean shifts the mix.
- Mix-it-up stays within kcal/protein bands, respects allergies, excludes the original.

Demo (2,200 kcal user, needs chicken, hates tuna, Indian lean): 7 days all
2,104–2,245 kcal, chicken every day, no tuna, Indian dishes up-weighted.

## v1 limitations / tuning notes

- **Day total is the hard budget constraint; per-slot envelopes are soft.** A
  recipe whose natural kcal is far from a slot target gets clamped
  (portionScale ∈ [0.6, 1.6]), so a slot can under/over-deliver while the day
  still balances. The `closeness` term reduces this; cuisine-lean can still
  outweigh it (a leaned low-kcal recipe may win a slot). All weights are config.
- **Needs can bypass the effort cap** (they're pinned before the soft effort
  mix runs). Fine for v1 — needs are hard, effort mix is soft.
- **Protein floor is a soft "quiet default"** (§4.3), not a hard gate — some days
  land below target when the pool/constraints are limiting.
- **Template-based v1.** The plan's full solver is v2. Swaps re-weighting future
  generation (`menu_swap`/`mixup_pick` events) is wired conceptually via the
  Brain's event log but not yet fed back into generation.
- Regeneration cadence (Sunday 18:00 local, §4.3) and persistence are server/
  client concerns, added with the server.
