# Yumo — changelog

## 1.0 build 2026-10-17 (handoff rev 4 — first-run guided tour)
- **Guided tour** (`Tour/Tour.swift`, `Tour/TourOverlay.swift`): runs once right after onboarding on the live Today screen, in its own window above every sheet. Ten stops per README §15 with the final copy; explain stops advance on Got it or a scrim tap, act stops pass only the lit control through (Breakfast +, Type it tile, the sheet's ✕, the Progress tab) and advance 520 ms after the real action (1,000 ms when the keyboard rises). Spotlight = scrim with a rounded cutout that glides 600 ms; bubble = ink, arrow, "n of 10", Skip tour, Got it / cue, dots, enters 380 ms after the stop. Progress scrolls each target into view. Stop 3 opens Type it with "oats 80 banana 1" pre-typed. Step persists across a kill and resumes; Skip marks done. Replay from Settings › Help › "Show me around". Weekly check-in is suppressed while the tour runs.
- **"Good luck!" finish**: sand cover, 96 pt app tile pop, 14-dot accent burst, title and target line, auto-dismiss at 3.4 s, success haptic.
- **First-run rules** (README §1): no "Yesterday's …" rows and no "Balance the day" row until a food has been logged on a previous day.
- Catalogue 2026-10-17: SR Legacy default servings now prefer a piece ("1 medium · 118 g") over a measure ("1 cup, mashed · 225 g"), so "banana 1" means one banana.

## 1.0 build 2026-10-16 (handoff rev 3 — Type it, Balance the day, stall check-in)
- **Type it** replaces the Search tile (keyboard glyph, "chicken 180 rice 150"). A line with numbers becomes type-to-log rows: deterministic parser (`Domain/TypeToLog.swift` — amounts attach to the preceding word-group, else the following; g/ml → grams, scoop/pot/tbsp/slice/x → servings; bare n ≤ 5 on a piece-serving food → pieces; comma closes a group), seeded alias table (pb, whey, egg(s), yoghurt, oil, rice…) plus user aliases, resolution single match → learned {word|meal} n ≥ 3 → learned {word|*} n ≥ 3 → ask. Ask UI shows the two most-logged candidates, "N more ›", "Search all X ›"; reasons under resolved rows; "Change" forces the ask; "Log N foods" is 45 % until every row resolves. Learning: +1 per confirm, reset to 1 on a different pick, never silent between two branded products. First-time hint line.
- **Balance the day**: hero row when > 150 kcal left and a meal is empty → sheet with outcome card, From what I prepped / From what I've eaten, prepped InputRows (live-resolved, persisted per day), PlanRows (`150 g → 270 g`, prepped / kept tags, tap to keep), Log it / Another way. Solver per README §1a in `Domain/Balance.swift` (classify veg/protein/fat/carb, fixed = prepped − eaten + veg + kept, flexible by dominant macro protein → fat → carb, round 5, cap 3× usual + 100, absorber = largest carb else fat never protein and never past its cap; OK when |Δ| ≤ 40 kcal and P ≥ target − 5). Prepped foods go only to an empty meal.
- **Stall check-in variant** (`Expenditure.stallCheck`): fires only when 3 consecutive weekly estimates have |trend Δ| < 0.1 kg, ≥ 85 % of days logged with mean intake within 5 % of target, goal = cut for ≥ 8 weeks; never on bulk/maintain; never twice in a week. Three OptionTiles (Diet break 2 weeks at measured maintenance · Hold 1 more week · Lower by 100), button label follows the selection, Decide later, "Why these three". A diet break pins the target to measured maintenance until its end date. Nothing auto-applies.
- New components AskList/AskOption/AskFooter, PlanRow, InputRow, OptionTile, KeyboardGlyph. New models LearnedPattern, UserAlias, PrepDay.
- Search now also matches the state words ("rice boiled", "chicken grilled").
- Catalogue 4,160 rows: first curation pass (`tools/curation.csv`) drops 11 SR Legacy rows that duplicated a Foundation/CoFID food (chicken breast raw, flours, lettuces, pineapple…). One generic row per food.

## 1.0 build 2026-10-16 (UK chains)
- Branded results now expand inline automatically when the query contains a brand word; otherwise a one-line "Show branded" link replaces the button.
- Tier 1 generic catalogue now 4,170 canonical rows: USDA SR Legacy 2,603 + USDA Foundation 306 + UK CoFID 2021 1,261 (`tools/cofid.csv` exported from the official spreadsheet). Every row carries servings and the full micronutrient panel where the source has it.
- Tier 2a chains, each from the chain's own published data with a dated source line: Greggs 266 (nutrition guide Sept 2026), Nando's 107 (website, kcal only), Pret 219 (product pages), McDonald's 180 (nutrition data service), Starbucks 1,142 (food + beverage guides, every size), Costa 938 (in-store guide Autumn 2026, every milk/size), Subway 192 (Sept 2026 sheet), KFC 130 (nutrition page). 3,174 chain items.
- Parked: Burger King (their guide is an image-only PDF; no text layer to parse safely).
- `tools/chains/REVIEW.md` lists auto-flagged rows (odd names, Atwater mismatch) for the curation pass.

## 1.0 build 2026-10-16 (one source of truth)
- Text search is local only. Live Open Food Facts no longer appears in text results; it is reachable only by barcode (scan or typed) or the explicit "Search branded products" button.
- Tier 1 generic catalogue rebuilt from the bulk datasets: USDA SR Legacy (2,603), USDA Foundation (306) and UK CoFID 2021 (1,261) → 4,170 canonical rows, one per food + state, with servings and the full micronutrient panel. `tools/build-catalogue.py`; curation overrides in `tools/curation.csv` (source_id, display_name, state, aliases, approved).
- Tier 2a chains: `tools/build-chains.py` → `chains.json` from each chain's own published data. Chains so far: Greggs (266 items, full macros, from the official September 2026 nutrition guide) and Nando's UK (107 items, kcal only — the website doesn't publish macros, so they show "—" and are not counted). Catalogue versions are content-hashed so every rebuild re-syncs on launch.
- Results: YOUR FOODS → GENERIC → CHAINS → SCANNED PRODUCTS; "No generic match" copy; "Create a food" is the last resort.

## 1.0 build 2026-10-15 (handoff rev 2)
- Theme: Sand & ink (bg #EBE2D2, surface #FFFBF3, ink #1F1C17, muted #8C8578, danger #C8353F = accent triad). Values from the rev 2 prototype.
- Today: hero Add button removed; AddChip in every meal header ("Breakfast · 513 kcal"); P · C · F under every food row; Training/Rest tag on the day stepper when training-day targets are on; optional pinned-nutrients row.
- Add: full-screen scanner (plain ✕, flashlight icon, corner brackets that go green on read); search grouped Your foods → Generic → Branded (collapsed); Open Food Facts then USDA Branded fallback for barcodes (needs an api.data.gov key in `Networking/Catalogue.swift`).
- Catalogue: Tier 1 generic foods bundled from USDA FoodData Central Foundation Foods (321 canonical entries with the full micronutrient panel, `Resources/Catalogue/generic.json`, rebuilt by `tools/build-catalogue.py`) plus a few UK/cooked staples. One row per generic food; raw and cooked are separate entries.
- Food page: typed grams (InsetField) and a ½-step Servings stepper kept in sync; no Meal row; collapsed Nutrients section; source line under the name.
- Progress: EMA trend line (α 0.1) once ≥ 7 weigh-ins; Expenditure card (measured maintenance, sparkline, Estimate / Low data) → How this works; Nutrients link → Progress › Nutrients (7/30-day averages vs NIH DRI, pin to Today); weekly check-in sheet with Apply / Keep.
- Settings: "Adjust automatically each week" switch; Training days card (two targets, weekday picker, weekly-average footer); Settings › Nutrients (targets, UL, pins, Show on Today).
- Adaptive target implemented per PRODUCT_BRIEF §3 (`Domain/Expenditure.swift`): weekly TDEE estimate, 0.6/0.4 then 0.75/0.25 smoothing, ±150 kcal clamp, safety floors, manual override wins.
- `isPlus` flag on the profile, everything unlocked.

## 1.0 build 2026-10-15 (12:42)
- Apple Health day totals, reminder time picker, 7-day average line, offline barcode retry.

## 1.0 build 2026-10-15 (12:00)
- First TestFlight build from the 12 Oct handoff.
