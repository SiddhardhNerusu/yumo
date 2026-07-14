# Calorie App — Master Plan & Implementation Spec (v2)

**Working name:** TBD (placeholder: "Usual")
**One-liner:** *The calorie app that learns you.* Cal AI removed typing. We remove the app.
**Date:** 2026-07-09 · Owner: Sid · Planning: Fable · Implementation: Opus 4.8
**Status:** SPEC — pending final research merge (Eat This Much post-mortem + imagery, workflow wf_937e6315-76d running) and Sid's §14 sign-offs.

> **How to read this doc (for the implementing model):** Everything here is decided unless marked ⚠️ OPEN or PROVISIONAL. Do not re-litigate decisions; do not add features not in this spec. Where exact values are given (thresholds, weights, caps), implement them as config-with-defaults, not hardcoded constants — they will be tuned. Owner hard rules apply throughout: no hardcoded food/recipe lists in code (all catalogue content is versioned server data), build must stay green, design tokens only, no Claude-authored commits (Sid commits).

---

## 0. The edge (verified market research, 2026-07-09)

Two deep-research passes (104 + 103 agents, adversarially verified claims, primary sources through mid-2026):

- **Logging friction is the #1 documented churn cause** (peer-reviewed; users quit in days — "too much input, too annoying"). Cal AI built $30M+/yr attacking it; MyFitnessPal bought them (closed Dec 2025). Friction is the proven battleground.
- **Photo logging is commoditized** (MFP owns Cal AI; MacroFactor shipped photo AI Apr 2025) with a documented accuracy backlash (25–50% error on mixed dishes; cameras can't see oil/sauces). Table stakes, not a wedge.
- **~97% of users are gone by day 30; ~30% of annual subs cancel in month one.** Days 1–3 decide everything. Design target: D3 retention.
- **Motivation/coach support is the #2 unmet need** (unprompted in all six research focus groups). Calorie counting itself feels punishing to a large segment — tone is a product feature.
- **The proactive prediction wedge ("the usual?" from the lock screen) is open:**
  - **MacroFactor (verified):** widgets are launch shortcuts/display-only ("launch your dashboard, search, barcode scanner…"). Their FLSI speed benchmark counts only *in-app* taps.
  - **MyFitnessPal (verified):** meal reminders are time-based plain pushes, no actions, no predicted contents. 2025–26 roadmap is reactive in-app AI capture (Voice Log Premium 5–6 step flow; Meal Scan; Cal AI kept standalone per TechCrunch).
  - **Lose It! / Yazio / Lifesum / Cronometer — VERIFIED CLEAR (2026-07-09, unanimous verdict):** none ships the combination of habit-based prediction + proactive delivery (widget/notification) + one-tap log without opening the app. Lose It!'s quick-add widgets hand off into the app (third-party 2026 audits: 4.4–6.1s per log); Lifesum widgets are view-only dashboards; Cronometer's own "ten fastest logging methods" guide has no widget-direct logging and its notification is a plain timed reminder.
  - **Closest threats, watch both:** (a) **YAZIO iOS Live Activities** — vendor doc claims lock-screen/Dynamic Island meal logging "without opening the app," but the direct-logging claim was REFUTED 1-2 in verification (static non-predictive quick-log surface at best) → hands-on device test is a Phase-0 task. (b) **MyNetDiary Premium Plus AI Coach (Jan 2026)** — "meal suggestions matched to your budget and preferences," but reactive and in-app only. 
  - **Industry pattern (now verified across 6+ apps):** everyone is racing on input-modality richness (photo/voice/text, in-app, premium-gated); Cronometer proves in-app AI meal *suggestion* is already commoditized. **Nobody owns proactive delivery — the differentiation is the delivery, not the suggestion.** This race is moving fast (MyNetDiary shipped Jan 2026) → re-audit all six immediately before launch.
- **Recipe catalogue licensing (verified):** Spoonacular & Edamam prohibit storing catalogue data (Spoonacular: 1-hr cache max; ingredients/instructions/nutrition explicitly unstorable). RecipeNLG/Recipe1M+ are non-commercial-only. **USDA FoodData Central is CC0 public domain** — bulk-downloadable, storable, commercially free. → We build our own catalogue (§4).
- **Cal AI's growth model (~$770K/mo ads) is not replicable solo** → organic/viral only; the product must be the demo.

**The two moats:**
1. **The Brain** — per-user habit model → proactive one-tap logging. Compounds per user; photo AI is static.
2. **The Catalogue + "Mix it up"** — menu + isocaloric swaps + ≤6-step recipes. Trackers don't cook; recipe apps don't track. We sit on the seam.

**Positioning:** "MyFitnessPal makes you search. Cal AI makes you snap. We just ask: *the usual?* — one tap, from your lock screen, and it's logged."

---

## 1. Product principles (implementation-binding)

1. **Never auto-log.** Every prediction is a question. One tap to confirm, always.
2. **Never worse than manual.** Every "no" path lands on personal tiles, never a blank search.
3. **Logging never refuses food.** HATE/ALLERGIC gate *suggestions*, never manual logging.
4. **No free-form AI generation at runtime.** Users only ever see human-reviewed catalogue content (see §4.5 safety).
5. **Macros are computed, never AI-guessed.** Deterministic USDA FDC arithmetic with per-ingredient traceability.
6. **Tone: warm, never punitive.** No red screens for overage, no "failure" language. ED guardrails (§7.4) are non-negotiable.
7. **A rough log beats an abandoned day.** Quick-add estimates are first-class.
8. **Notification respect.** Hard nudge budget (§3.6). Fatigue = churn.
9. **Free tier is a complete, unhumiliated calorie counter.** Barcode free forever. The Brain is free (it's the retention engine).
10. **Three tabs. Nothing enters v1 not in this spec.**

---

## 2. Onboarding (minutes 0–5)

Flow: `Welcome → Goal → Body → Activity → Rate → NUMBER REVEAL → Bubbles(Needs) → Bubbles(Likes) → Bubbles(Hates) → Allergies → Pantry → Variation dial → Cuisine lean → Menu reveal → Notification ask → HealthKit ask → (account creation deferred to first sync)`

### 2.1 Steps & rules
| Step | Inputs | Rules |
|---|---|---|
| Goal | lose / maintain / gain + optional "I used to be in shape" toggle | toggle only changes coach copy flavor |
| Body | weight, height, age, sex | units by locale, editable |
| Activity | 4 tiers (desk / on-feet / active / very active) | multipliers 1.2 / 1.375 / 1.55 / 1.725 |
| Rate | slider gentle↔aggressive | lose: 0.25–1.0 kg/wk; floors: never render a target <1,500 kcal (M) / <1,200 (F) — clamp + show §7.4 signpost |
| **Number reveal** | — | Mifflin-St Jeor × activity − (rate_kg_wk × 7700 / 7). Big number, "how did we get this?" expander with the math. This is the screenshot moment. |
| Needs bubbles | ≤3 selections | "foods you can't live without" — each anchored 1×/day in menu |
| Likes bubbles | soft cap 12 | up-weighted, no guarantee |
| Hates bubbles | uncapped | never suggested/generated |
| Allergies | explicit separate screen, common allergen list + free-add | never suggested + ingredient-level scan + ⚠️ flag on composite foods; copy: "always check labels — we help, we don't guarantee" |
| Pantry | staple multi-select + free-add | menu prefers pantry-compatible; editable later ("I did a shop") |
| Variation dial | 3 options | Creature of habit / Balanced (default) / Mix it up → novelty weight 0.2 / 0.5 / 0.8 |
| Cuisine lean | multi-select cuisines, light/heavy each | generator weight, not filter; **cuisine options served from catalogue counts (§4.2), never hardcoded** |
| Menu reveal | — | "Rice every day like you asked. No tuna, ever. ~2,800 kcal/day." |
| Notification ask | contextual | "want me to nudge you when it's time to eat? this is how one-tap logging works" — never the cold OS prompt first |
| Health ask | HealthKit / Health Connect read: steps, weight, workouts | skippable |

### 2.2 Bubble mechanics
- Physics-y floating bubbles (Reddit-interests style). Tap → select + spawn 2–4 related bubbles from food-graph edges (tap "rice" → biryani, fried rice, rice bowls). Long-press → info (kcal/100g typical).
- Bubble content = top ~200 food-graph nodes per round, server-served, ranked by locale popularity. **Zero hardcoded food lists in the client.**
- Every tap is an event (§3.2) — onboarding seeds the Brain before meal one.

---

## 3. The Brain (prediction engine) — Moat #1

### 3.1 Architecture
On-device, deterministic, interpretable scoring over the user's event log. No runtime server dependency, no cloud inference. Pure TypeScript module `@app/brain` with zero UI imports; replay-testable (given event fixture → assert predictions).

### 3.2 Event log (append-only, local SQLite, synced encrypted)
```
events(
  id TEXT PK,            -- uuidv7 (time-ordered)
  ts INTEGER,            -- epoch ms, device tz offset stored alongside
  tz_offset_min INTEGER,
  kind TEXT,             -- 'log' | 'nudge_accept' | 'nudge_decline' | 'tile_tap' |
                         -- 'search_log' | 'barcode_log' | 'photo_log' | 'menu_accept' |
                         -- 'menu_swap' | 'mixup_pick' | 'portion_edit' | 'delete' |
                         -- 'skip_meal' | 'onboard_bubble' | 'pantry_edit'
  food_id TEXT,          -- food-graph node or recipe id (nullable for skip)
  slot TEXT,             -- 'breakfast'|'lunch'|'dinner'|'snack'
  portion_g REAL,
  kcal REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
  meta TEXT              -- JSON: source detail, swap-from id, decline reason etc.
)
```
Deletes are soft (a `delete` event referencing the original) — the log is truly append-only.

### 3.3 Scoring (config defaults; all weights server-tunable via remote config)
For candidate food/recipe F at time T in slot S:
```
score(F,T,S) = 0.30·freq(F|S)          -- share of S-slot logs, trailing 28d
             + 0.20·recency(F)          -- exp decay, half-life 10d
             + 0.15·dow(F,T)            -- P(F | day-of-week), Laplace-smoothed
             + 0.10·tod(F,T)            -- gaussian around F's median log time, σ=45min
             + 0.15·menuPrior(F,T,S)    -- 1 if on this week's menu for (day,S)
             + 0.10·seq(F|ctx)          -- v1: workout-logged-today → boost workout-associated foods
             − 0.25·declinePenalty(F,S) -- 1.0 if declined last offer in S, decays over 48h
```
Candidates = union(user's logged foods, this week's menu items, onboarding NEED/LIKE foods). Score ∈ [0,1] via clamp.

### 3.4 Confidence ladder
| Confidence | Behavior | Taps |
|---|---|---|
| ≥ 0.75 | Proactive nudge (actionable notification) + widget shows one-tap log | 1, app closed |
| 0.40–0.74 | No push. App/widget opens to top-3 tiles for current slot | 2 |
| < 0.40 | Silent. Quick Log screen (tiles + search + photo) | ≈ best-in-class |

### 3.5 Portion learning
- default portion(F) = median(last 5 logged portions of F), seeded by menu quantity or food-graph default.
- Confirm chips: `[bit less −25%] [✓ usual] [bit more +25%]` + "exact…" opens gram entry.
- `portion_edit` events update the median.

### 3.6 Nudge budget (state machine, hard rules)
- Max 1 proactive nudge per slot per day; max 3/day total (config).
- 2 consecutive declines in a slot → that slot goes quiet 48h (drops to medium behavior).
- Nudge fires at `median log time of slot − 10min` (per-user), fallback to user-set meal times from onboarding.
- Decline action = "Something else →" (deep-links to tiles), never a bare dismiss (dismissals still logged via notification callbacks where OS exposes them).
- After 3 declines of the same food F in slot S: F suppressed from nudges in S for 14d (tiles unaffected).

### 3.7 Notification scheduling (fully local)
On every app foreground + after every log event: recompute next-24h predictions → cancel + reschedule local notifications (iOS `UNUserNotificationCenter` category with `LOG_NOW` + `SOMETHING_ELSE` actions; Android notification with action buttons via Notifee). `LOG_NOW` executes the log through a background handler (no app open) and posts a confirmation notification "Logged 🍚 620 kcal — 1,410 left today."
Widgets: iOS WidgetKit interactive (App Intents) + Android Glance; widget displays ring + current-slot prediction with tap-to-log; refreshed via the same recompute hook (WidgetCenter reload / Glance update).

### 3.8 Cold start
- Day 0: candidates from bubbles + menu; menuPrior dominates (weights auto-renormalize when freq/recency have <7 days of data — multiply data-driven terms by min(1, days_active/7)).
- First nudge is menu-framed: "Your menu says chicken & rice — did you have it? [Yes] [Something else]".
- Coach sets expectation: "I get sharper every day you log — give me a week."
- D1–3 target: every meal ≤3 taps.

### 3.9 Learning visibility (the magic moment)
When a previously-declined pattern gets learned (e.g. 3rd Friday salad), coach line: "Got it — Fridays are different 👍". Fire analytics event `brain_learned_visible`. This moment is the TikTok clip.

---

## 4. Catalogue + Menu + "Mix it up" — Moat #2

### 4.1 Food graph (server data, versioned)
```
foods(id, canonical_name, kcal_per_100g, protein, carbs, fat, fdc_id,
      default_portion_g, portion_label, allergens JSONB, tags JSONB)
food_edges(from_id, to_id, weight)        -- relatedness (bubbles, variety)
```
~2,000 curated concepts at launch (LLM-assisted authoring, human-reviewed) + long-tail passthrough: USDA FDC (CC0, bulk-hosted in our Postgres) for whole foods, OpenFoodFacts for barcodes (ODbL — keep as separated layer/schema `off.*`, attribution in-app).

### 4.2 Recipes
```
recipes(id, name, slot_affinity[], cuisine, effort TEXT('5min'|'15min'|'30min+'),
        method_tags[], steps JSONB,       -- array of ≤6 strings, one sentence each
        kcal, protein, carbs, fat,        -- COMPUTED, never authored
        status('draft'|'reviewed'|'live'|'retired'), version, review_meta JSONB)
recipe_ingredients(recipe_id, food_id, fdc_id, qty_g, qty_label, note)
```
- **Macro computation:** `Σ qty_g × FDC per-100g nutrients`, with FNDDS yield/retention factors for cooked-weight conversion. Recomputed on any ingredient edit; recipes carry full FDC traceability.
- **Format standard ("tired at 7pm"):** ≤6 steps, one sentence each, one pan where possible, exact quantities in g/ml + household measure. **Steps render as a tap-to-reveal sheet ("How to make it →"), never inline** — cards show name/kcal/macros/effort only (decision 2).
- **Launch scale:** ~600–800 recipes across the authoring target list: British-everyday, Indian, Chinese, Italian, Thai, Jamaican/Caribbean, West African, Mexican + "5-min/easy" tier. **Cuisine availability in UI is computed from live catalogue counts (≥20 live recipes to surface a cuisine) — never a hardcoded list** (decision 5). Post-launch: crank toward thousands.
- **Images — DECIDED (verified research):** launch **text-first typographic cards**, optionally + a small curated set of REAL photos for ~20 hero recipes. **Never generative AI food photography:** documented technically-impossible dishes; a 2025 British Food Journal study (n=241) found disclosed AI food images significantly reduce perceived value and increase negative word-of-mouth; DoorDash's 2025 tooling deliberately restricts AI to enhancement (lighting/framing) of real photos — that's the ceiling if we ever touch AI imagery. Stock-licensing economics at catalogue scale = unanswered, moot while text-first.

### 4.3 Menu engine (server-side, weekly)
Template-based v1 (full solver v2). Per user, generate 7 days × slots:
1. **Hard:** ALLERGIC never (ingredient-level) · HATE never · each NEED 1×/day pinned to natural slot · day total within ±5% of budget · slot envelopes (B 25% / L 32.5% / D 32.5% / S 10%, config).
2. **Soft (weighted sampling):** LIKES ↑ · pantry-compatible ↑ · protein floor 1.6 g/kg target-weight (quiet default) · novelty per variation dial (0.2/0.5/0.8) · cuisine-lean weights · effort mix (≤2 "30min+" dinners/week).
3. Regenerates Sunday 18:00 local ("next week's menu is ready — 30-second review" notification = weekly ritual). Swaps persist: `menu_swap`/`mixup_pick` events re-weight future generation.
4. Every menu item pre-quantified → accepting = complete accurate log.

### 4.4 "Mix it up" (isocaloric swap)
- Button on every suggested meal → 3–4 alternatives: same slot · kcal ±10% · protein ±15% · allergy/hate filtered · pantry-boosted · effort ≤ original+1 tier.
- Ranked: cuisine lean → LIKES overlap → Brain preference → novelty per dial.
- Pick → slots into menu + becomes one-tap loggable + logged as `mixup_pick` (preference signal).
- Gating: **unlimited during beta** (decision 4). Entitlement check built as remote-config flag (default unlimited) so post-beta gating is a config flip. Ranked alternatives served cuisine-lean-first from data-driven cuisine set (decision 5).

### 4.5 Catalogue authoring pipeline (offline, never runtime)
1. LLM generates candidate recipes against a **schema** (quantities mandatory, steps ≤6, ingredient names must resolve to food-graph nodes — **ingredient whitelist**: non-food tokens are a hard reject; OECD incident 2024 = why).
2. Auto FDC mapping w/ confidence; <0.9 confidence → human queue.
3. Deterministic macro computation + outlier lint (computed kcal vs slot envelope ±40% → flag) + food-safety lint (raw chicken/pork/egg temperature-step check) + allergen extraction.
4. Human review UI (simple internal web page): approve/edit/reject; Sid taste-tests top-served recipes. Nothing reaches `live` without human approval.
5. Marketing language: "expert-reviewed recipes," never "AI-generated."
- **Pipeline verdict — CONDITIONAL GO (verified research):** LLM authoring of recipe *text/structure* is viable; trusting LLM *nutrition numbers* is a hard NO-GO. Peer-reviewed 2026 evidence: general-purpose LLMs hit only 43–63% tolerance accuracy on recipe macros (Gemini 2.0 five-shot; Llama 3 8B worse); even domain-fine-tuned models collapse to 29–46% on branded foods. Our deterministic FDC computation (§4.2) is exactly the recommended mitigation. Stakes are quantified: in a 3M-review study across 90 AI apps, reviews reporting hallucinations average **1.8 stars vs 3.5** — one wrong macro surfaced to a user is a 1-star event.
- **Failure precedents (why the whitelist + human gate exist):** Pak 'n' Save's GPT recipe bot produced chlorine-gas "recipes" from non-food inputs (root cause: no input validation — our ingredient whitelist closes this); Google's AI recipe summaries produced a "charcoal" cake (3–4h @ 320F); an AI cookie recipe went viral for being uncookable. No litigation precedent yet — the damage mode is PR/ratings, which for a solo app is fatal anyway.

---

## 5. Logging surfaces (priority order)

1. **Actionable notification** — §3.7. The hero.
2. **Widgets** — ring + one-tap current-slot log (iOS interactive WidgetKit, Android Glance).
3. **Quick-log tiles** — top-12 predicted for current slot, learned portions, one tap. This is the Today screen's core.
4. **Search + barcode** — recents-first local index (<50ms), then server search (debounced 250ms). Barcode → OFF + branded FDC. **Free forever.**
5. **Quick-add estimate** — "~700 kcal pub lunch" one-tap rough entry (kcal only, optional protein). First-class, not buried.
6. **Photo (fast-follow, not MVP)** — Claude vision → decompose to food-graph items → user confirms. Framed as estimate ("looks like ~650 kcal — adjust?"). Metered: free 3/day, premium unlimited.
7. **Voice (v1.1+)** — parse via server (Goyo voice DNA). Not load-bearing.
8. **"Meal off"** — skip/fasting = `skip_meal` event; streak-safe; Brain goes quiet for that slot.

---

## 6. App structure — 3 tabs

### 6.1 Today (home)
- **Budget ring** (eaten / remaining; activity adjustment shown as optional "+150 kcal from your walk — use it?" chip, never silently applied).
- **Current-slot card:** prediction ≥0.75 → "the usual?" inline confirm; else top-3 tiles; always "more…" → Quick Log.
- **Timeline** of today's logs (tap → edit portion / delete / move slot).
- **Coach line** (one sentence, §7).
### 6.2 Menu
- Week view (7 days × slots), today expanded. Per meal: [Log it] [Mix it up] [Swap →] [Recipe steps].
- Pantry editor · bubbles revisit (needs/likes/hates/allergies live here post-onboarding) · variation dial · cuisine lean.
### 6.3 Progress
- Weight trend (7d-smoothed line, raw dots ghosted) · weekly adherence strip (days logged, not days "under") · streak with **freeze** (1 missed day = frozen not zero; logged skip preserves) · coach weekly recap card.

---

## 7. Coach voice (v1 = templated lines, not chat)

### 7.1 Surfaces: nudge copy · menu reveal · learning moments (§3.9) · weekly recap · overage response.
### 7.2 Tone rules (binding): warm, brief, zero moralizing. Overage: "big day today — tomorrow's a fresh one." Never "over budget/failed/bad." Emoji sparing (≤1 per line).
### 7.3 Implementation: server-served template packs (versioned, A/B-able), variables injected client-side. No LLM at runtime in v1. Conversational coach = future premium surface (Goyo DNA).
### 7.4 ED guardrails (non-negotiable): rate floors (§2.1) · no punitive UI/red states · if avg logged intake < floor for 5 consecutive days → gentle signpost card (BEAT/NEDA links per locale) · no "earn your food" exercise framing · App Store health-sensitivity review pass before launch.

---

## 8. Server (Node/Express, Render, same patterns as Goyo)

### 8.1 Endpoints (v1)
```
POST /api/auth/apple | /api/auth/google        -- token exchange, JWT session
GET  /api/profile · PATCH /api/profile
GET  /api/onboarding/bubbles?round=needs|likes|hates&locale=
POST /api/menu/generate · GET /api/menu/current
POST /api/menu/swap · POST /api/menu/mixup     -- returns ranked alternatives
GET  /api/foods/search?q= · GET /api/foods/barcode/:ean
GET  /api/recipes/:id
POST /api/sync/events (batched, encrypted blob) · GET /api/sync/events?since=
GET  /api/config                               -- remote config: weights, caps, thresholds
POST /api/photo/estimate                       -- fast-follow; metered by entitlement
GET  /api/health                               -- build string (deploy verification, Goyo pattern)
```
### 8.2 Data: Postgres. Server-authoritative: users, entitlements, food graph, recipes, menus, template packs, remote config. Client-authoritative (synced): event log (encrypted blob per batch; server never parses in v1), weights.
### 8.3 Entitlements: reuse Goyo `requirePremium`/user_entitlements patterns. RevenueCat for IAP (both stores, solo-dev sanity).
### 8.4 Jobs: Sunday menu regeneration (per-user tz) · catalogue publishing pipeline (§4.5) · FDC bulk import (quarterly refresh).

---

## 9. Client (cross-platform)

- **React Native + Expo (dev client), TypeScript** — one language with the server. ⚠️ Confirmed pending Phase-0 bubble spike (Flutter fallback if Skia/Reanimated can't hit 60fps bubbles on mid-tier Android).
- Native modules required: iOS WidgetKit extension + App Intents (Swift — Sid's home turf), Android Glance widget (Kotlin), Notifee (actionable notifications + background log handler), HealthKit/Health Connect (react-native-health / Health Connect lib), RevenueCat SDK.
- Local store: SQLite (expo-sqlite) + typed DAO layer; `@app/brain` pure TS package with fixture replay tests.
- Design system: token file (color/spacing/type ramps) from day 1 — Goyo lesson: accent discipline, one accent color, warm neutral ladder, WCAG AA on all text (define before any screen is built; no ad-hoc styling ever).
- Offline-first: everything works offline except search-beyond-recents, menu regen, photo.

---

## 10. Analytics & targets (PostHog or self-hosted umami+events; privacy-clean, no food content in analytics)

Events: `onboard_step_*`, `number_reveal_shared`, `log_completed{source, taps, ms}`, `nudge_shown/accepted/declined`, `mixup_opened/picked`, `menu_accepted/swapped`, `brain_learned_visible`, `paywall_viewed/converted`, `notif_permission{granted}`.
**North-star: median taps-per-log.** Targets: D1 ≥ 55% · D3 ≥ 35% · D7 ≥ 25% · D30 ≥ 12% (4× category baseline) · nudge accept ≥ 35% by week 2 · median taps ≤ 2 by week 2 · trial→paid ≥ 30%.

---

## 11. Monetization

$9.99/mo · $39.99/yr (highlighted) · 7-day trial. RevenueCat. Annual-first paywall after menu reveal (soft, skippable) + at premium-feature touchpoints.

| Free forever | Premium |
|---|---|
| All logging: search, barcode, tiles, nudges, widgets, quick-add — full Brain | Full 7-day menu + weekly regen + pantry-aware curation |
| Budget ring, weight log, current week history | Coach weekly insights · full history/trends/export |
| 1 NEED honored in starter menu | All bubbles honored + variation dial |
| Photo 3/day (when shipped) · "Mix it up" **unlimited during beta** (post-beta gating = config flip, data-informed) | Unlimited photo + voice · (post-beta, likely: unlimited Mix it up + cuisine-lean tuning) |

---

## 12. Go-to-market (organic only)

- Hero clip: lock-screen "the usual? 🍗🍚" → tap → "Logged. 1,410 left." 15s, remixable.
- Second shareable: number-reveal screenshot.
- Reddit beachheads (r/loseit, r/CICO) with the honest-accuracy angle; build-in-public founder story (ex-bodybuilder rebuilding); ASO: "calorie counter that learns you"; Goyo cross-link (separate brand).

---

## 13. Build phases & acceptance criteria

**Phase 0 — De-risk (1–2 wk)**
- ✅ Market research passes 1, 2 & 3 (this doc §0, §4). Competitor wedge verdict VERIFIED across the field; LLM-catalogue conditional-GO verified; imagery decided (text-first). Remaining research: Eat This Much post-mortem (zero verified claims after two attempts — needs a dedicated pass or hands-on app teardown).
- ⬜ Hands-on device test: YAZIO iOS Live Activities — does it truly complete a log without app handoff? (verification split 1-2; the one genuinely ambiguous competitor surface)
- ⬜ Bubble spike: RN/Expo (Skia+Reanimated) vs Flutter — 60fps with 60 bubbles on Pixel 6a = pass.
- ⬜ Notification spike: iOS actionable notification logs an event app-closed + confirmation notif; same on Android via Notifee. Both platforms = pass.
- ⬜ Recipe pipeline spike: 30 LLM recipes → schema validation → FDC mapping → computed macros → hand-verify 10 (≤5% kcal deviation on manual recompute = pass).
- ⬜ Name/icon/positioning page.
**Exit criteria:** all four spikes pass; stack locked; name chosen.

**Phase 1 — MVP core (4–6 wk)**
Onboarding complete flow · Today screen (ring/tiles/timeline/edit) · manual logging (search/barcode/recents/quick-add) · Brain v1 (event log, scoring, ladder, local notif scheduling, portion learning, nudge budget) · Menu v1 (template gen, accept/swap, recipe view) · "Mix it up" v1 · auth + sync + entitlement scaffolding · HealthKit/HC read · analytics · ED guardrails.
**Exit:** Sid full dogfood ≥7 days; median taps-per-log ≤3; zero crash-free-rate <99.5%.

**Phase 2 — Magic polish (2–3 wk)**
Widgets both platforms · notification flows bulletproof (tz changes, DND, permission-denied fallbacks) · skip/fasting · coach template pass over every string · Sunday menu ritual · streak freeze · paywall.
**Exit:** closed beta 30–50 users (Reddit + Goyo), 2 weeks; D3 ≥ 30% in beta; nudge accept ≥ 25%.

**Phase 3 — Launch (2 wk)**
Store listings + review (health-sensitivity pass) · hero clip · Reddit/PH posts · photo logging behind flag if ready.
**Phase 4 — Post-launch:** photo GA → voice → conversational coach → adaptive budget (gentle version) → catalogue to 2,000+ → regional DBs → solver v2.

---

## 14. Decisions — SIGNED OFF (Sid, 2026-07-09)

1. ✅ Standalone app, separate from Goyo. **Name TBD** (only remaining open item — needed before store listings, Phase 0).
2. ✅ Recipe format ≤6 steps "tired at 7pm" — **steps are tap-to-reveal, not inline**: meal cards show name/kcal/macros/effort; a "How to make it →" affordance opens the steps as a sheet/popup. Cooking instructions never clutter the menu or logging surfaces.
3. ✅ Images: text-first typographic cards at launch.
4. ✅ "Mix it up": **UNLIMITED during beta** (no gating). Gating decision deferred post-beta, informed by usage data (§10 `mixup_opened/picked` events). Build the entitlement check as a config flag defaulting to unlimited so gating later is a config change, not a code change.
5. ✅ Cuisines: **data-driven, never hardcoded.** The cuisine picker/filters render ONLY cuisines that actually have ≥20 live recipes in the catalogue (server-computed). Authoring target list for the catalogue team: British-everyday, Indian, Chinese, Italian, Thai, Jamaican/Caribbean, West African, Mexican + the "5-min/easy" effort tier — but the UI reads from catalogue data, so no cuisine ever appears without real recipes behind it (owner hard rule: no hallucinated/empty categories).
6. ✅ User-created recipes: fast-follow (saved meals cover v1).
7. ✅ Photo logging: fast-follow, not MVP.
8. ✅ Beta channel: TestFlight + Play Console beta; recruit from BOTH Goyo users (fast bug-finding, gym-biased) and Reddit r/loseit / r/CICO (honest non-lifter signal on whether the "usual?" magic lands).

## 15. Research status (final, 2026-07-09)
- ✅ Competitor wedge verdict — VERIFIED, merged (§0). Re-audit all six + MyNetDiary immediately pre-launch (fast-moving race).
- ✅ LLM catalogue conditional-GO + validation pipeline — VERIFIED, merged (§4.5).
- ✅ Imagery — DECIDED: text-first, no generative AI photos (§4.2).
- ❌ **Eat This Much post-mortem — UNANSWERED after two research passes** (zero surviving claims both times). Options: (a) dedicated single-topic research pass, (b) hands-on teardown: install ETM, use it for a week, read its subreddit. Until answered, §16's ETM risk mitigation stands: menu is optional scaffolding bolted to a tracker+Brain, with a beta kill-switch (accept-rate <20% → demote to premium inspiration). **This is a known unknown, not a blocker** — the wedge (Brain) is independent of it.
- Unanswered periphery (non-blocking): YAZIO Live Activity hands-on (Phase-0 task), stock-photo economics (moot while text-first), AI-nutrition legal precedent (none exists yet).

## 16. Risks (unchanged from v1 + additions)
| Risk | Mitigation |
|---|---|
| Incumbent copies proactive nudges | Ship fast; per-user compounding model; bubbles+menu+coach is a system, not a feature |
| Notif permission denied | Contextual ask at peak-intent; widget+tiles still ≤2 taps; coach re-asks after week-1 value |
| Prediction wrong-too-often / creepy | Confidence gating, nudge budget, §3.9 visible learning, never auto-log |
| Menu ignored | Menu optional scaffolding; if beta accept-rate <20% → demote to premium "inspiration", double down on Brain |
| LLM recipe quality/safety | §4.5 pipeline: whitelist, lint, human gate, no runtime generation; OECD incident is the cautionary precedent |
| ETM already does menu+swap and hasn't won | Post-mortem pending; thesis: planner without tracking loop/brain — validate before over-investing §4 |
| Recipe API licensing temptation | Verified prohibitions (Spoonacular/Edamam); never build on them |
| Solo scope creep | §1.10; phases are the contract |
| ED harm / store rejection | §7.4 |
