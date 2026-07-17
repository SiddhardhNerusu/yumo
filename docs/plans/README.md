# Yumo — the plans (single source of truth)

Every spec Sid has written for Yumo, in one place. Fable writes the plans; Opus implements them.
Previously these were scattered across the Goyo Server repo and `~/Downloads` — they now live here,
version-controlled, so they travel with the code.

| Plan | What it covers | Status |
|---|---|---|
| **[calorie_app_master_plan.md](calorie_app_master_plan.md)** | The founding spec (v2, implementation-grade). The two moats: "the Brain" (prediction-first one-tap logging) and the catalogue + "Mix it up". Onboarding, budget math, stack, pricing, §14 decisions. | ✅ **Built.** App v1 complete end-to-end. |
| **[meal_engine_master_plan.md](meal_engine_master_plan.md)** | Meal-engine hardening — a DELTA plan (§2 lists what already exists and must not be rebuilt). Closes 7 gaps: G1 macro targets, G2 portion scaling, G3 catalogue scale-up, G4 near-miss, G5 learning loop, G6 sim harness, G7 shopping list. | ✅ **Built** (M1–M5 + §6.3). ⚠️ **§6.3 is WRONG** — see below. |
| **[kitchen_master_plan.md](kitchen_master_plan.md)** | "The Kitchen" moat — fridge/pantry inventory. Fuzzy levels (never a ledger), re-rank-never-restrict, computed expiry, deterministic depletion, receipts as the hero input, the animated fridge scene. Phases A–E. | ✅ **Built** (A–D). E (household) not started. |
| **[kitchen_addendum_v1.1.md](kitchen_addendum_v1.1.md)** | Delta on the v1 fridge → the zoomable **room** (4th zone "the counter", wood/appliance materials, dynamic shelves, glyph tiles, receipt choreography). | ✅ **Built.** |
| **[yumo_redesign_master_brief.md](yumo_redesign_master_brief.md)** | The dark-first serif UI redesign — token ladder, Newsreader serif, the shared `kit.tsx` component set, per-screen specs. | ✅ **Built.** |
| **[next_wave_master_plan.md](next_wave_master_plan.md)** | Sid-approved 2026-07-17 wave: actionable nudges + iOS widget (the moat's delivery), backfill logging, weight units, editable macro targets, saved meals, on-device receipt OCR, Apple Health, seasoning-list debt. M1–M8 with binding UI specs. | 🔨 **Approved — for Opus to implement.** |

---

## ⚠️ Known error in the meal-engine plan: §6.3

The plan says to add **FNDDS yield/retention factors** for raw→cooked conversion, calling it
"the #1 silent accuracy killer". **Do not implement this.** It was researched and audited:

- **Retention factors do not apply to macros.** USDA's RETN table covers vitamins, minerals and
  alcohol only — there are no retention factors for protein, fat, or carbohydrate.
- **Yield factors are unnecessary.** FDC already ships *separately lab-measured* raw AND cooked
  entries (chickpeas raw 378 vs cooked 164 kcal/100g). Selecting the correctly-stated entry gives
  cooked-basis macros directly, and more accurately than multiplying by a factor.

The real bug was **state-aware entry selection** ("chickpeas, cooked" was matching the *dry* entry —
one recipe overcounted by **+900 kcal**). Fixed in `packages/catalogue-pipeline/src/fdc/resolve.ts`;
mismatches went 40 → 3, adversarially verified with zero regressions. See `HANDOFF.md` §3.

---

## Where the current state lives

- **[../../HANDOFF.md](../../HANDOFF.md)** — start here in a new session. What shipped, what's left,
  the gotchas that will bite you.
- Engineering write-ups per subsystem: `docs/brain.md`, `docs/menu-engine.md`, `docs/server.md`,
  `docs/client.md`, `docs/voice-add.md`, `docs/phase0-recipe-spike.md`, `docs/testflight.md`.
