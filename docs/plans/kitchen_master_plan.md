# The Kitchen — Master Plan (v1)

**Working name:** The Kitchen (the fridge + pantry moat)
**One-liner:** *Tell Yumo what's in your kitchen — it cooks from it, keeps you on budget, and wastes nothing.*
**Status:** SPEC — pending Sid's §15 sign-offs. Nothing here is built yet.

> **How to read this:** implementation-grade spec in the style of the calorie-app master plan. Everything is decided unless marked ⚠️ OPEN. Owner hard rules apply: no hardcoded food lists in code (shelf-life & icon data are versioned data files), design tokens only, WCAG AA, never punitive, build stays green, Sid commits.

---

## 0. Why this is a moat

Yumo already sits on the seam trackers ignore: **the menu bends to you** (Mix it up) instead of you bending to it. The Kitchen closes the last gap — *what you can actually cook right now*:

- **Trackers** don't know what's in your house. **Recipe apps** don't track calories. **Pantry apps** (SuperCook, NoWaste, KitchenPal) don't do macros, budgets, or learning — and they all die of manual-upkeep fatigue.
- Yumo is uniquely positioned to solve the upkeep problem, because **logging meals is already the core loop** — and every logged meal can silently update the pantry. Nobody else has that loop to piggyback on. That's the structural advantage, not the UI.
- The killer moment it unlocks: open the app at 6pm → **"Tonight you can make…"** — 3 dinners, all from what's inside, all on budget, one tap to log. No other app can produce that sentence honestly.

**Positioning line:** *"Your fridge, but smart: it knows what's inside, what's going off, and what's for dinner."*

---

## 1. Product principles (binding)

1. **Fuzzy, never a ledger.** Inventory states are `plenty / some / low / out` — never gram-accurate stock counts. We promise "good enough to pick tonight's dinner," not warehouse management. One-tap correction everywhere.
2. **Re-rank, never restrict.** "Cook from my kitchen" boosts cookable meals and annotates the gaps — it never empties the menu. (The SuperCook failure mode: strict filtering shows nothing or garbage.)
3. **Assume staples.** Salt, pepper, oil, basic dried spices are presumed present (user-editable set). A recipe is never "uncookable" over a pinch of paprika.
4. **Vision/OCR proposes, the human confirms.** Receipt scans and fridge photos produce a *confirm sheet*, never silent writes. Same trust rule as photo calorie logging.
5. **Waste copy is warm, never guilt.** "Your spinach wants to be dinner tonight" — never "you wasted £4." Tossing food gets a shrug ("happens to everyone"), not a red state.
6. **Decrement silently, correct loudly.** Logging a meal quietly draws down its ingredients; if we got it wrong, fixing it is one tap on the item.
7. **Everything visual is token-driven.** One accent, warm neutral ladder, serif display, AA contrast. The fridge is charming because of craft, not colour explosions.
8. **No AI-generated food photography** (existing rule). The Kitchen uses a **custom illustrated ingredient glyph set** — flat duotone SVGs in the warm palette. Illustration ≠ photography; it makes no false "this is the real dish" promise.

---

## 2. The centerpiece: the animated fridge (this is the OMG)

A new surface — **Kitchen** — reachable from Menu (header button) in v1; possibly a 4th tab later (⚠️ OPEN, §15). It is *not a list*. It is a stylised, animated cross-section of your kitchen.

### 2.1 The scene
- **Three zones, one scene:** a **Fridge** (tall, left), a **Freezer** (drawer under the fridge), and a **Cupboard** (right, warm wood-tone door). Rendered in SVG with the token palette — warm charcoals, hairline highlights, soft inner shadows. Dark-first.
- **Closed state:** you see the doors. On the fridge door: **magnets**. The magnets ARE the UI:
  - a **shopping-list note** held by a magnet (tap → shopping list sheet)
  - a **"Tonight you can make…" note** (tap → cookable dinners sheet)
  - a small **streak magnet** (the day count, just for charm)
- **Opening:** tap a door → it swings open with spring physics (~320ms, `duration.slow`, scale/rotate on the door plane) and the **interior light glows on** (a soft radial `accentFaint` wash). Haptic tick on device. This animation is the TikTok clip of this moat.
- **Inside:** shelves. Items sit on shelves as **illustrated tiles** auto-organised by familiar convention — produce drawer at the bottom, dairy shelf, door rack for bottles/condiments; freezer items get a **frost speckle** overlay; cupboard shows tins/dry goods on wooden shelves.

### 2.2 Item tiles (the atoms)
Each item = rounded tile (radius `md`), illustrated glyph + name (13 sans) + state:
- **Quantity** as a fill level / small stack (2 eggs vs a full box) — mapping the fuzzy `plenty/some/low/out` states, not numbers.
- **Freshness** as a *visual arc*, computed (see §4):
  - `fresh` — normal
  - `use soon` — a small **amber leaf tag** (`warning` token) + the tile gets a gentle warm glow
  - `use today` — tag pulses softly (one subtle loop, then rests; never nagging)
  - `probably gone` — tile desaturates and *wilts* (2–3° tilt); tap → "Still good / Toss it"
- **Interactions:** tap → item sheet (adjust quantity chips, freshness override, move zone, remove). **Drag to the bin** (bottom corner) = waste log with forgiving microcopy. **Drag between zones** (fridge→freezer) updates shelf-life. Long-press → wiggle mode for bulk tidy (familiar iOS metaphor).
- **Adding:** a `＋` on each zone opens the Add sheet (§5). New items **drop onto the shelf** with a small bounce + settle.

### 2.3 Signature micro-moments (chase these, they're the "cool")
- Door-open light bloom + haptic.
- Restock day: confirming a receipt makes the items **fly into the fridge** one by one (staggered 40ms) — the "putting the shopping away" feeling, weirdly satisfying.
- Logging a meal from the Kitchen: its ingredients **dim/shrink slightly** on the shelf — you *see* the meal come out of the fridge.
- **Empty-fridge mode** (§9): the fridge visibly empties across the week — a satisfying countdown.
- The glyph set itself: ~60 hand-drawn-feel duotone SVG ingredients (chicken, broccoli, milk, tins…) in charcoal + accent. **Fallback tile** for unknown foods: same tile shape with a typographic monogram (serif initial) — so nothing ever breaks the aesthetic. Glyphs are **versioned data** (id → svg), not hardcoded UI.

### 2.4 Tech
- `react-native-svg` + RN `Animated` (already proven in the app: ring, charts, bubble cloud). Door swing = rotateY-style skew transform on web/native; spring via `Animated.spring`. No new native deps → **works in Expo Go and the browser preview**.
- Scene is one component (`KitchenScene`) with a layout engine that bins items into shelf rows; zero physics needed (bubble-cloud d3-force is overkill here — shelf bins are deterministic and calmer).
- Performance guard: cap visible tiles per shelf, "＋4 more" stack tile expands a zone sheet.

---

## 3. Inventory model (data)

Client-authoritative (synced like the event log), server never needs to parse in v1.

```
kitchen_items(
  id,                    -- uuid
  foodToken TEXT,        -- food-graph token, same vocabulary as recipes' foodTokens
  label TEXT,            -- display name ("Chicken thighs")
  zone TEXT,             -- 'fridge' | 'freezer' | 'cupboard'
  level TEXT,            -- 'plenty' | 'some' | 'low' | 'out'   (fuzzy)
  addedAt INTEGER,       -- epoch ms (purchase date if from receipt)
  freshUntil INTEGER,    -- computed: addedAt + shelfLife(category, zone); user-overridable
  price REAL NULL,       -- from receipt line, if known (→ §8 money)
  source TEXT            -- 'receipt' | 'manual' | 'photo' | 'barcode' | 'decrement'
)
```

- **Matching** reuses the existing catalogue resolver (category-head scoring) so pantry "chicken" ↔ recipe "chicken breast, cooked" — this is mostly plumbing we already own.
- **Events, not silent state:** every change appends a `pantry_edit` BrainEvent (kind already exists in §3.2 of the main plan) — so kitchen history is replayable and syncs through the existing opaque event pipe.
- `profile.pantry` (today's token list) becomes a **derived view** of kitchen_items where `level != 'out'` — the menu engine keeps working unchanged, just with live data.

---

## 4. Freshness & expiry (answering "how do we know?")

**We never ask users to type use-by dates.** Freshness is computed:

1. **Shelf-life dataset** (versioned data file, human-reviewed like the catalogue): `category × zone → typical days`. ~80 categories covers the food graph: raw chicken (fridge 2d / freezer 90d), milk (7d), leafy greens (5d), eggs (21d), tins (720d), frozen veg (240d)…
2. **Clock starts** at receipt date (best), else the day added.
3. **Freshness arc** = position between addedAt and freshUntil → the visual states in §2.2. Deliberately fuzzy: we say "use soon", not "expires Thursday 18:43".
4. **Corrections:** item sheet has 4 chips — `Fresh / Use soon / Use today / Gone` — one tap re-anchors the arc. Moving zones (fridge→freezer) re-computes.
5. **Later (Phase E):** photograph the printed use-by label → OCR the date → exact anchor. Nice, not foundational.
6. **Guardrail copy** (once, on first "use soon"): "These are estimates from typical shelf life — trust your nose and the label, not us." Same honesty posture as allergy copy.

---

## 5. Getting food IN (input methods, priority order)

1. **Receipt scan — the hero.** Photo or screenshot of a receipt → OCR line items → map to food tokens (resolver) → **confirm sheet** (ticked list, unmatched lines greyed with "?") → items fly into the fridge (§2.3). Receipts give us the three golden fields at once: **item + price + date**. Non-food lines (toothpaste) are dropped by the same ingredient-whitelist philosophy as the recipe pipeline.
   - MVP implementation: server endpoint `POST /api/kitchen/receipt` (image → parsed lines). ⚠️ OPEN §15: OCR provider (platform-native vision on device later; server-side to start). **Privacy rule:** parse and discard the image; store only matched food lines; strip store/payment metadata.
2. **Manual add — fast and pretty.** Zone `＋` → Add sheet: search field + categorised chip cloud (top ~40 per zone from catalogue frequency, server-served like bubbles — no hardcoded lists) + "my usuals" row (your historical items, one tap to re-add).
3. **Fridge/shelf photo.** Vision model proposes items ("I can see: milk, eggs, broccoli…") → same confirm sheet. Framed as estimate. (Phase D — after receipt proves the confirm-flow UX.)
4. **Barcode while unpacking.** Reuses the existing OFF barcode path; scan-scan-scan → batch confirm.
5. **Voice** ("add chicken, rice and a bag of spinach") — parses to tokens; fast-follow, Goyo voice DNA.

**First-run:** onboarding's pantry step (already built) seeds the kitchen; the Kitchen's empty state says "Scan your next receipt and watch it fill up."

---

## 6. The loop (the self-maintaining kitchen — and the *better* restock answer)

This is the system diagram; each arrow already half-exists:

```
log a meal ──► ingredients auto-decrement (level steps down one notch)
     ▲                              │
     │                              ▼
"Tonight you can make…" ◄── projected stock per token
     │                              │
     ▼                              ▼
menu picks / Mix it up ──► shopping list = next-week menu needs − projected stock
     ▲                              │
     └────────── receipt scan ◄─────┘   (buy it → scan it → shelves refill)
```

- **Auto-decrement:** each recipe's ingredient list (already structured, with qty_g) maps to tokens; a logged meal steps matching items down one fuzzy level (`plenty→some→low→out` over a few uses, scaled by qty class). Silent; item sheet shows "adjusted after Chicken & rice — undo".
- **Restock prediction, the right way:** *not* frequency guessing. `projected stock` (from decrements) + `menu lookahead` (next 7 days' planned ingredients) → **the shopping list writes itself**: "Your week needs chicken ×3, rice ×2 — you're low on chicken." Deterministic, explainable, in keeping with the whole app's no-black-box ethos. Receipt cadence is used only as a tie-breaker prior ("you usually rebuy milk weekly") — a whisper, not the engine.
- **Shopping list surface:** the magnet-note on the fridge door. Grouped by zone, checkable, "add the gaps from this week's menu" one-tap. Post-shop: "scan the receipt to tick everything off at once." (Grocery-API integration = far-future, not v1.)

---

## 7. Cookability & menu integration

- **Cookability score** per recipe = fraction of its foodTokens in stock (staples assumed): → three tiers: **Cook now** (all in) · **One short** (missing 1–2 → "grab: coriander") · **Bigger shop**.
- **Menu tab:** a "**From your kitchen**" toggle pill next to `↻ New week`. On = generation passes stronger pantry weighting + cookability re-rank; each meal card gets a small tier badge ("✓ all in" in success / "1 to buy" muted). Never filters to empty (principle 2).
- **Mix it up:** reason chips gain precision — "Everything's in your fridge" beats generic "Uses your pantry"; a "uses your expiring spinach" reason ranks top (§8).
- **Today:** the featured meal shows the tier badge; the computed coach line learns kitchen phrases: "Tonight's dinner is all in your fridge."
- **"Tonight you can make…"** — fridge-door note + sheet: top 3 *cook-now* dinners fitting the remaining budget; each is one-tap loggable. This is the moment; instrument it hard.

---

## 8. Waste-saver & money

**Waste-saver**
- Items entering `use soon` inject an **expiring boost** into menu/mixup ranking + a single gentle Today line ("Your spinach wants to be dinner — Spinach curry fits your budget"). Max 1 waste nudge/day (respect the nudge-budget philosophy).
- **Drag-to-bin waste log** → monthly recap: "You used 92% of what you bought." Frame as *used*, never *wasted* — celebrate the save, don't mourn the loss.

**Money (needs receipts, free otherwise degraded)**
- Receipt lines carry prices → per-item cost → **estimated cost per meal** ("Chicken & rice · ~£1.85") and the counter: "**Cooked from your kitchen: £23 saved this month**" (vs a configurable takeaway/meal-out baseline, default £10 — honest label: "vs eating out").
- Weekly recap card on Progress gains a 4th stat: `£ saved`. ⚠️ Keep it out of Today (calorie focus stays primary).

---

## 9. Household & modes

- **Shared kitchen (Phase E):** invite via link; kitchen_items sync through the server per-household; edits merge last-write-wins on item level (fuzzy states make conflicts harmless). Two people, one fridge — inherently viral ("join my kitchen").
- **Empty-fridge mode:** a toggle ("using things up") — generation weights hard toward in-stock + expiring, shopping suggestions pause, the fridge scene visibly empties. Perfect before holidays. Auto-suggests itself if the user hasn't scanned a receipt in ~10 days.

---

## 10. Free vs Premium

| Free | Premium |
|---|---|
| Kitchen scene, manual add, fuzzy inventory, auto-decrement | — (the Kitchen itself is free: it's a retention engine, like the Brain) |
| Receipt scan **3/month** | Unlimited receipt scans |
| "Tonight you can make" (top 1) | Top 3 + expiring-first planning |
| Shopping list (manual) | Auto list from menu-lookahead + money insights + household sharing |

(⚠️ OPEN §15 — gating levels are a guess; build all checks as remote-config flags like mixup, decide from beta data.)

---

## 11. Analytics (privacy-clean, no food content — same rule as §10 main plan)

`kitchen_opened`, `receipt_scanned{lines, matched}`, `receipt_confirmed{added}`, `item_added{source, zone}`, `item_wasted`, `tonight_viewed/accepted`, `cooknow_share_of_logs` (**north star: % of logged dinners that were cook-now suggestions**), `shopping_list_generated/checked`, `empty_mode_on`.

---

## 12. Build phases

**Phase A — Cookability + list (1 wk, pure reuse, DE-RISKS EVERYTHING)**
Inventory model + fuzzy levels (data only, no fridge visual yet) · cookability score → Menu toggle + tier badges + Mix-it-up kitchen reasons · shopping list = menu − stock (plain sheet) · manual add v1.
*Exit: Sid plans a real week from his actual kitchen; list matches reality.*

**Phase B — THE FRIDGE (1–2 wk, the OMG)**
KitchenScene: doors, spring-open, light bloom, shelves, item tiles, glyph set v1 (~60), freshness visuals, drag-to-bin, magnets (list + tonight notes) · "Tonight you can make…" sheet · auto-decrement on log.
*Exit: opening the fridge makes someone say "oh that's sick" unprompted. (Real exit criterion.)*

**Phase C — Receipts (1 wk + provider spike)**
Receipt OCR endpoint + confirm sheet + fly-in restock animation + prices captured → money counter + cost-per-meal.
*Exit: one real supermarket receipt → ≥80% of food lines matched with ≤3 corrections.*

**Phase D — Waste + photo input**
Freshness dataset tuned · expiring boosts + the 1/day waste nudge · monthly used-% recap · fridge-photo vision with confirm sheet.

**Phase E — Household + polish**
Shared kitchen · empty-fridge mode · use-by-label OCR · voice add · barcode batch mode.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Inventory drift → distrust | Fuzzy levels + silent decrement + 1-tap correction; never display false precision |
| OCR mismatch embarrassment | Confirm sheet always; unmatched lines shown honestly as "?" |
| The fridge is cute but unused | Phase A ships the *value* first; the fridge is the wrapping. North-star = cook-now share of logs, not scene opens |
| Scope monster | Phases are the contract; A before any pixels of fridge |
| Shelf-life liability | Estimates-only copy + "trust the label" guardrail (§4.6); conservative defaults |
| Icon set cost | 60 glyphs + monogram fallback; versioned data, grows over time |

---

## 14. What this makes the app (the pitch paragraph)

Yumo becomes the only app where the sentence *"what should I eat tonight?"* is answered with something you can actually cook, from food you actually have, at a calorie number that actually fits — and logging it is one tap that also keeps the fridge honest. The Brain learns *you*; the Kitchen knows *your house*. Together: "the usual?" in the morning, "tonight you can make…" in the evening. That's a daily-ritual product, not a tracker.

---

## 15. Decisions needed from Sid (⚠️ OPEN)

1. **Kitchen placement:** button on Menu (v1 recommendation) vs 4th tab (breaks "three tabs" hard rule — needs an explicit owner override).
2. **OCR provider** for receipts (server-side to start; which service) — needs a Phase-C spike.
3. **Premium split** (§10 table) — accept as beta defaults?
4. **Money baseline** for "£ saved" (default £10/meal-out?) and whether it appears anywhere besides the weekly recap.
5. **Glyph art direction:** commission/generate the 60-glyph duotone set — one style sample to approve before batch production.
6. Phase order confirmation: **A → B → C** (value → fridge → receipts) vs jumping straight to the fridge visual.
