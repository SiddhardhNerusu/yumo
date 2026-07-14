# Yumo Meal Engine Master Plan — the in-house meal brain, hardened for quality & longevity (no runtime LLM)

**Status:** approved for implementation · **Author:** Fable (plan) → Opus 4.8 (implement) · **Date:** 2026-07-13
**Repo:** `/Users/sidnerusu/Desktop/488/Yumo` (npm-workspaces TS monorepo; packages `@yumo/*` — tokens/shared/brain/menu/catalogue-pipeline/server/app). **Not** the Goyo Server repo.
**Parent docs:** `calorie_app_master_plan.md` (Goyo Server repo root — product spec; this plan expands its §4.1–4.5) · `docs/kitchen_master_plan.md` (in Yumo repo — pantry/Kitchen, mostly built).

---

## 0. How to use this document (instructions to the implementing agent)

- **This is a DELTA plan.** Much of the engine already exists and is verified (see §2). Do not rebuild working systems; extend them. Read the current code for a module before touching it. Where this doc specs behavior the code already has, verify + keep it.
- **Binding spec.** Where a number is given, use it — and wire it through config (§10), never hardcoded at the call site.
- Owner hard rules: **no hardcoded food/cuisine/recipe lists in code** (content = versioned data), **no band-aid fixes**, **Sid commits — you never commit** (exception only if Sid explicitly re-authorizes), tests + typecheck green at every milestone. Run `npm test` and **wait for it** before declaring a milestone done (a red-test commit happened once; never again).
- If a spec item conflicts with existing code architecture, STOP and surface it to Sid — don't silently improvise.

## 1. Product intent (what Sid wants, distilled)

1. App builds meal plans from **what's in the user's house** (Kitchen/pantry) that hit **calorie + protein/carb/fat goals** (cut/maintain/gain; e.g. 200g protein).
2. Meals that *almost* work (1–2 missing items) are shown too, labelled with exactly what to buy — intelligent, not rigid.
3. **Weekly shopping lists** from the menu minus the pantry.
4. **Zero LLM at runtime** — per-user LLM calls kill unit economics at scale. Intelligence = food database (per-100g macros) + meal-composition knowledge (dinner ≈ protein+carb+veg, breakfast lighter) + deterministic maths.
5. **Real food only, tastes and smells good.** Never a macro-correct abomination (tuna-in-milk). Every meal = a real named dish with proper seasoning/sauces and instructions.
6. Quality and longevity: it must stay good as the catalogue grows and users stay for months.

## 2. Current state (verified built — do NOT rebuild)

| System | Where | Status |
|---|---|---|
| Food DB | `data/fdc-cache/foods.json` (8,092 FDC foods) + `packages/catalogue-pipeline` resolver | ✅ Built; refresh via `npm run fetch:fdc` |
| Catalogue pipeline | `@yumo/catalogue-pipeline`: Zod `.strict()` schema (authored macros = hard reject), category-head resolver (<0.9 conf → human queue), deterministic `Σ qty×per100g/100`, Atwater ≤5% verify, lints (hazard/raw-protein-cook-step/kcal-outlier/UK-14 allergens), review page `data/review.html` | ✅ Built, spike PASSED (38 recipes e2e, 90% auto-match) |
| Menu engine | `@yumo/menu` `generateWeekMenu` (seeded RNG, HARD allergy/hate/needs-pinned/day ±5% w/ uniform portion-repair clamp [0.6,1.6]; SOFT likes/pantry/cuisine-lean/novelty-dial/protein-floor-1.6g-per-kg/effort-mix) + `mixItUp` (kcal ±10%, protein ±15%, effort ≤+1) + `boostIds` feedback | ✅ Built, tested |
| Kitchen (pantry) | `app/src/data/` kitchen-model/cookability/kitchenStore: fuzzy levels (plenty/some/low/out), `cookability` tiers **now/oneShort/shop** with staples-assumed + whole-word `tokenMatch`, computed freshness, depletion on log, voice add | ✅ Built + 2 adversarial audits (all findings fixed) |
| Shopping list | `ShoppingListSheet` (menu-lookahead − projected stock, check→restock, empty-mode pause) | ✅ Built (client) |
| Server | `@yumo/server` Express in-monorepo: menu/mixup/swap/foods/recipes/config/entitlements; `MemoryStore` + Postgres schema in `server/migrations/001_init.sql` (pg adapter NOT wired) | ✅ Built (dev); prod = deferred |
| Brain, Today/Menu/Progress, onboarding, analytics | app + `@yumo/brain` | ✅ Built (out of scope here) |

**So the architecture Sid asked about already holds:** P1 zero runtime LLM (voice-add decision 2026-07-11 = 100% on-device), P2 engine only selects+scales human-gated recipes, P3 macros always computed. This plan **hardens quality and closes the gaps** below.

## 3. The gaps this plan closes (the actual work)

1. **G1 — Macro goals are half-wired.** Users set kcal only; protein is a soft 1.6g/kg floor; carbs/fat aren't targeted at all. Sid wants explicit P/C/F goals honored ("200g protein").
2. **G2 — Portion scaling is crude.** Day-repair scales meals uniformly [0.6,1.6] and scales EVERYTHING linearly — including seasonings (1.4× paprika) and countable items (1.3 eggs). No per-recipe bounds.
3. **G3 — Catalogue is at spike scale (38 recipes).** Launch bar is 600–800 across the parent doc's cuisines, and the drafting prompt has no enforced *taste floor* (seasoning/sauce/aromatics with quantities) or composition-role checks.
4. **G4 — Near-miss isn't a first-class menu concept.** Cookability tiers exist in the Kitchen, but menu items should carry `ready | near_miss(missing:[…]) | shop` and the UI copy "Just need: chicken thighs, 1 red pepper."
5. **G5 — No learning loop beyond boostIds.** No per-user recipe weights with clamps/decay, no global quality prior, no retirement of duds, no drift monitoring.
6. **G6 — No engine-level quality regression net.** Nothing proves, on every change, that plans hit targets for hundreds of simulated users with zero allergy violations.
7. **G7 — Shopping list lacks shop-ability.** No aisle grouping, no household units ("2 chicken breasts ≈450g"), seasonings the user lacks aren't included.

## 4. Non-negotiable principles (already true — keep them true)

| # | Principle | Enforcement |
|---|---|---|
| P1 | Zero LLM calls at runtime | No LLM client import under menu/kitchen/server-menu paths (add a lint/test asserting it) |
| P2 | Engine never invents meals — selects + scales `live` recipes only | No runtime ingredient-combination code path |
| P3 | Macros always computed (`Σ qty_g × per-100g × yield`), never authored/LLM-sourced | Zod strict schema already hard-rejects authored macros; keep |
| P4 | Nothing reaches users without human approval (`draft → linted → reviewed → live`) | Only the review UI transitions to `live` |
| P5 | All tunables in remote config with §10 defaults | Engine reads config at generation time |
| P6 | Every generated plan explainable | Per-meal score breakdown in a `debug` field (dev/beta) |

## 5. G1+G2 — Macro targeting & real portion scaling (`@yumo/menu` + `@yumo/shared`)

**5.1 User macro targets.** Extend `UserProfile`/`user_targets`: `proteinG` (required, default 1.6×target-weight-kg), `carbsG?`, `fatG?` (optional). Onboarding + Settings expose them (protein always; C/F under "advanced"). Budget math stays in `@yumo/shared/budget.ts`.

**5.2 Slot budgets.** Day kcal → slots B .25 / L .325 / D .325 / S .10 (config `slot_envelopes`, renormalized for 3–5 meals/day). Protein split .20/.32/.38/.10 (dinners carry more; breakfasts structurally lighter).

**5.3 Target semantics (binding):**
- kcal: day total within ±5% (existing hard rule — keep).
- Protein: **one-sided** — ≥ target matters, overshoot ≤ +15% is free. Promote from soft floor to repair-priority (below).
- Carbs/fat: soft ±15% bands — score contribution only, never rejection.

**5.4 Per-recipe, per-ingredient scaling (replaces uniform linear):** recipe fields `scaleMin`/`scaleMax` (defaults 0.75/1.5; snacks 0.5/2.0; author-overridable) and per-ingredient `scaling: 'linear' | 'fixed' | 'stepped'` — `fixed` = seasonings/sauces (1 tsp paprika stays 1 tsp across the scale range), `stepped` = eggs/wraps/fillets round to integer units **and displayed macros are recomputed from the actual rounded quantities** (what's shown always equals the maths of what's on the plate). Catalogue schema + drafting prompt + review page gain these fields; sensible defaults derived from ingredient `role` so the 38 existing recipes migrate automatically (seasoning/sauce→fixed, egg/wrap-like→stepped, else linear).

**5.5 Scale solve.** For slot budget `(kcal_s, protein_s)` and recipe base `(kcal_r, protein_r)`: `scale = clamp(argmin_s[(s·kcal_r − kcal_s)² + 0.5·max(0, protein_s − s·protein_r)²], scaleMin, scaleMax)` — closed-form quadratic then clamp, then apply per-ingredient rules, then recompute true macros.

**5.6 Day assembly + repair ladder.** Fill dinner → lunch → breakfast → snack (biggest levers first; scored per §5.7, softmax-sampled over top-K=8 with temperature from the variation dial 0.2/0.5/0.8 — sampling, not argmax). If day is out of tolerance: (1) re-scale within bounds starting with the largest meal; (2) swap the snack; (3) relax kcal tolerance to ±7.5% and protein to −10%, log `plan_relaxed`. **Never** exceed scale bounds to force numbers — a plan 5–7% off but real beats exact-and-gross.

**5.7 Scoring (config `score_weights`, defaults):**
```
score = 2.0·target_fit      // 1 − |kcal gap|/envelope − 0.5·protein shortfall/target (post-scale est.)
      + 1.5·pantry_fit      // 1.0 ready · 0.6 near-miss(1) · 0.35 near-miss(2) · 0 shop (§7)
      + 1.0·preference      // user weight × global quality prior (§8)
      + 0.8·likes_overlap + 0.6·variety + 0.4·effort_fit + ε jitter
```
Existing HARD constraints keep: allergy (ingredient-level), hate, needs-pinned, slot affinity, ≤2 '30min+' dinners/wk. Add repetition floor: same recipe ≤2×/week, never consecutive days, not within `novelty_window_days=4` unless pinned.

**5.8 Determinism:** generation stays seeded (`(userId, weekStart, engineVersion)`); same inputs reproduce the same plan. Store `engineVersion` + config snapshot on each generated menu.

## 6. G3 — Catalogue scale-up (600–800 live recipes; `@yumo/catalogue-pipeline`)

**6.1 Drafting prompt v2 (versioned in-repo).** Inputs: cuisine + slot + effort + kcal envelope + dish-type seed. Add the **taste floor (binding)**: every savoury recipe MUST have (a) ≥1 seasoning-role ingredient beyond salt/pepper with exact quantity — never "season to taste"; (b) a fat source; (c) the aromatic/sauce element the cuisine expects (garlic/ginger/soy/passata/stock…). Sweet/breakfast must have the flavor element (cinnamon/vanilla/honey/berries…). Names must be real dish names (no macro words, no "Protein Meal 7"). Generate ~3× target and let the funnel cut.

**6.2 Lint additions** (existing lints keep): ingredient `role` field (protein/carb/veg/fat/dairy/sauce/seasoning/other) mandatory; **composition check** — lunch/dinner needs roles protein + (carb or veg); **taste-floor structural re-check** (≥1 seasoning row for savoury); **pairing-sanity flag** (not reject) for role combos with no cuisine precedent (start with a small curated `incompatible_roles` data table, e.g. dairy+canned-fish outside pasta-bake methods → review flag).

**6.3 Cooked-weight yields.** Add FNDDS yield/retention factors to the macro computation (raw→cooked). This is the #1 silent accuracy killer; currently absent. `foods` gain `yield_factor` where applicable.

**6.4 Content bar (config-monitored, computed — never a hardcoded list):** ≥600 live total; per-slot minimums breakfast ≥80 / lunch ≥200 / dinner ≥250 / snack ≥70; ≥25% of lunch+dinner at effort 5min|15min; cuisine surfaces at ≥20 live (`CUISINE_MIN_RECIPES` prod value — config exists, flip from spike's 3). Authoring runs as **batches through the review page**; Sid approves everything (target <10s per obvious approve — keep the review UI keyboard-fast).

**6.5 Review = the taste brain.** Sid's approve/reject in `data/review.html` is the final gate (P4). Add reject-reason logging so prompt v2 can be tuned against real rejection causes.

## 7. G4 — Near-miss as a first-class menu concept

Reuse `cookability.ts` (tiers now/oneShort/shop, staples set, whole-word tokenMatch — already audited; do NOT re-implement matching). Changes:
- `generateWeekMenu`/`mixItUp` per-item output gains `pantryState: 'ready'|'near_miss'|'shop'` + `missing: string[]` (food tokens, staples excluded, `near_miss_max=2`).
- `pantry_fit` in §5.7 consumes it (1.0 / 0.6 / 0.35 / 0).
- UI: menu cards + Mix sheet show "Just need: chicken thighs, 1 red pepper" (missing ranked protein > carb/veg > sauce; TierBadge already exists — extend copy, don't duplicate).
- Kitchen quantity-ledger math stays fuzzy-levels (v2 per kitchen plan) — presence + level is enough here.

## 8. G5 — Learning loop + retirement (new: nightly jobs; server + `@yumo/menu`)

- **Per-user weights** `user_recipe_prefs.weight` (multiplicative, clamp [0.1, 3.0], decay 2%/wk toward 1.0): swap-away ×0.8 · mixup-pick/accept+log ×1.15 · thumbs-down ×0.5 · thumbs-up ×1.3. Feeds `preference` (§5.7); generalizes the existing `boostIds` mechanism rather than bolting on beside it.
- **Global quality prior** per recipe = Bayesian-smoothed accept rate `(accepted+5)/(served+10)` from `recipe_stats` (served/accepted/swapped_away/mixup_picked/thumbs). New recipes start neutral.
- **Retirement:** nightly flag swap-away rate ≥0.70 over ≥50 serves OR thumbs-down ratio ≥0.4 → Sid's review queue → fix (version+1, re-approve) or `retired` (stays resolvable for history, never re-serves). Recipe edits NEVER mutate a live version silently.
- **No content is generated from signals** — they only re-rank the human-approved catalogue (P2 preserved).
- Add optional 👍/👎 on logged meals (one tap, timeline/menu card) — the highest-signal input; events `recipe_thumb{up|down}`.

## 9. G7 — Shopping list, shop-able

Extend the existing ShoppingListSheet + add `GET /api/menu/shopping-list`: aggregate `Σ scaled qty_g` per food across the week's menu − pantry (presence-level; owned non-staple with weekly need >500g → "top up" row); **group by aisle** (`foods.shop_aisle`: produce/meat/dairy/dry/frozen/world/spices — data on foods, not code); render household units via `default_portion_g`/`qty_label` ("2 chicken breasts (≈450g)"); **include `fixed` seasonings the user lacks** (the paprika gets bought); check-off writes to the Kitchen (existing bought→restock flow). Empty-mode pause behavior keeps.

## 10. Config parameter table (defaults; served via existing `GET /api/config`)

| key | default | ref |
|---|---|---|
| `slot_envelopes` | .25/.325/.325/.10 | §5.2 |
| `protein_slot_split` | .20/.32/.38/.10 | §5.2 |
| `day_kcal_tolerance` | 0.05 → relax 0.075 | §5.6 |
| `protein_overshoot_free` | 0.15 (one-sided) | §5.3 |
| `carb_fat_soft_tol` | 0.15 | §5.3 |
| `scale_bounds_default` | 0.75–1.5 (snack 0.5–2.0) | §5.4 |
| `score_weights` | 2.0/1.5/1.0/0.8/0.6/0.4 | §5.7 |
| `topK` / `variation_temps` | 8 / 0.2/0.5/0.8 | §5.6 |
| `novelty_window_days` | 4 | §5.7 |
| `near_miss_max` | 2 | §7 |
| `mixup_kcal_band` / `mixup_protein_band` | 0.10 / 0.15 | existing |
| `pref_clamp` / `pref_decay` | 0.1–3.0 / 0.02/wk | §8 |
| `retire_swap_rate` / `retire_min_serves` | 0.70 / 50 | §8 |
| `CUISINE_MIN_RECIPES` | 20 (prod) | §6.4 |

## 11. G6 — Quality bar: numeric acceptance criteria (a milestone is DONE only if green)

1. **Macro truth:** automated test recomputes every live recipe's macros from FDC and asserts equality with stored values; 20 random recipes hand-checked ≤±5% kcal (existing Atwater verify keeps).
2. **Plan fit (the regression net — new `scripts/` sim harness, runs in CI):** 500 simulated users (kcal 1,400–3,600, protein 100–220g, random allergies/hates/pantries/dials) → ≥98% of days within kcal tolerance; ≥95% hit protein without relaxation; **exactly 0** hard-constraint violations (allergy/hate/slot/scale-bounds) — the allergy-zero assertion is a dedicated test that fails the build.
3. **Variety:** in the sim, no recipe >2×/week, no consecutive-day repeats, ≥4 distinct cuisines/user-week at dial 0.5.
4. **Realness (tuna-milk test):** structural — a test asserts no runtime code path constructs meals from foods (P2); content — Sid cold-samples 30 live recipes: ≥28/30 "a normal person would cook and enjoy this," every savoury one has quantified seasoning.
5. **Performance:** 7-day generation <300ms p95 at launch-catalogue scale; shopping list <100ms.
6. **Explainability:** every menu item carries a score breakdown in beta; a "why this meal?" debug view renders it.

## 12. Longevity

- **Versioning:** menus store `engineVersion` + config snapshot → reproducible; recipe edits bump version and re-enter review.
- **Drift monitoring (weekly job):** % plans relaxed, mean |kcal gap|, swap rate by cuisine/slot, near-miss conversion. Relaxation >10% ⇒ catalogue coverage hole (usually high-protein breakfasts) ⇒ targeted authoring batch. **Usage steers authoring; content stays human-gated.**
- **FDC quarterly refresh:** re-run `fetch:fdc`; recompute affected recipes; any live recipe kcal changing >2% → review queue diff report.
- **Catalogue growth:** §6 pipeline re-runs in batches forever (seasonal, new cuisines, budget tiers); per-slot minimums monitored; cuisines auto-hide below threshold (computed).

## 13. Build order (each M: `npm test` + typecheck green across the monorepo; Sid commits)

| M | Deliverable | Definition of done |
|---|---|---|
| M1 | §5 macro targets + scaling: profile P/C/F fields, slot splits, per-ingredient scaling rules, scale solve, repair ladder, seeded determinism kept | Unit tests on the pure core (fixtures incl. stepped-egg recompute); existing 132 tests stay green |
| M2 | §11.2 sim harness in CI | 500-user sim green at the §11 bars against the current (small) catalogue, allergy-zero test in place |
| M3 | §7 near-miss in engine output + UI copy + §5.7 pantry_fit | Integration tests; live browser verify (known gotchas: seed localStorage profile, PointerEvent dispatch) |
| M4 | §9 shopping list (aisles, household units, seasonings, server endpoint) | Endpoint + sheet tests; curl-verified |
| M5 | §8 learning loop + retirement + thumbs + nightly jobs | Weights move as specced on synthetic events; retirement flags into review queue |
| M6 | §6 pipeline v2 (taste floor, roles, composition lint, yields, reject-reasons) + first 150-recipe authoring batch through Sid's review | Batch live; §11.1 + §11.4 pass on it |
| M7 | Catalogue fill to §6.4 bar + §12 drift job + config flips (CUISINE_MIN_RECIPES→20) | Full §11 pass at scale; Sid taste-pass done |

M1–M5 are engine work (buildable now, catalogue-size independent). M6–M7 are content-heavy and gated on Sid's review time — interleave batches with other work.

## 14. Explicitly OUT of scope (do not build)

Any runtime LLM (P1) · photo/voice **logging** (separate surfaces; kitchen voice-add is done) · Kitchen gram-ledger quantities (fuzzy levels stay) · full constraint solver (v2 — filter/score/scale/repair as specced) · recipe images (text-first, decided) · micronutrients beyond fiber · price optimization of shopping lists · prod-deploy work (pg adapter, JWKS, RevenueCat — separate track, device/account-gated) · native modules.
