# Yumo Next Wave — notifications, backfill, units, targets, saved meals, receipts, Health, debt

**Status:** approved by Sid (2026-07-17) · **Author:** Fable (plan) → Opus 4.8 (implement)
**Repo:** `~/Desktop/488/Yumo` (npm-workspaces TS monorepo; RN/Expo SDK 57 app in `app/`). **Not** the Goyo Server repo.
**Parent docs:** `calorie_app_master_plan.md` (§3.6–3.7 nudges, §5 logging surfaces) · `kitchen_master_plan.md` (§5 receipts) · `HANDOFF.md` (read first — current state).

---

## 0. How to use this document (binding)

- **This is a DELTA plan.** Everything in §2 exists and is verified working — read the file before touching it, extend it, never rebuild it. If a spec here conflicts with what you find in the code, STOP and surface it to Sid.
- **Gates at every milestone:** root `npm run typecheck` AND `cd app && npx tsc --noEmit` AND `npm test` (165 green today). The root typecheck does NOT cover the app — always run the app tsc too.
- **Verify client work in the browser pane** (`CI=1 npx expo start --web --port 8081` from `app/`), with these hard-won gotchas:
  - Kill any stale Metro on 8081 first; hard-`navigate` after edits (never trust HMR).
  - `resize_window` preset `mobile`.
  - Synthetic JS `PointerEvent` taps work on plain `Pressable`s but NOT on `AnimatedPressable` (kit buttons) — use real browser clicks (`computer.left_click` after a screenshot) for `PrimaryButton`/`OutlineButton`/`MixButton`.
  - The browser runs with `DEMO_DATA` on (`app/src/data/demo.ts`, `__DEV__`), so seed history pollutes averages — seed `localStorage` explicitly for tests and ignore demo noise; production is empty-first.
- **Owner hard rules:** no hardcoded food/cuisine/recipe lists in code (content = versioned data files); no band-aid fixes; macros always computed; tokens only (`useTheme().c(...)` — never raw hex in app code); never-punitive UI (no red overage; `danger` only for destructive affordances); ≤0 emoji in product copy; serif (`Serif` kit component) for meal names/titles only.
- **Commits:** Sid has authorized commit+push to `main` for this wave. One commit per milestone, imperative subject, body explains root causes, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, author `Siddhardh Nerusu <siddhardhnerusu@gmail.com>`. Push after each milestone.
- Numbers given here are binding. Where a library API is uncertain, the plan says exactly what to verify first — do that check, don't guess.

## 1. UI language cheat-sheet (make everything look native to the app)

From `app/src/components/kit.tsx` + `packages/tokens/tokens.json`:

| Element | Use |
|---|---|
| Colors | `const { c } = useTheme()`; ladder: `bg surface surfaceSunken sheet chipSurface mixSurface border borderStrong divider textPrimary textSecondary textMuted textLogged accent accentText accentSoft accentFaint success successFaint warning warningFaint danger ringTrack` |
| Buttons | `PrimaryButton {label, flex?|full?, disabled?}` (accent pill; `flex` in ROWS, `full` in COLUMNS — `flex` in a column collapses the pill), `OutlineButton`, `MixButton`, `TextLink {tone:'positive'|'neutral'}`, `Chip {selected}` |
| Cards/sheets | `Card {current?, logged?}` radius 20; `Sheet {visible,onClose,expanded?}` bottom sheet; full pages = `Modal animationType="slide"` + own header (see `screens/Overview.tsx` — copy its back-header pattern exactly: `‹ Today` accentSoft chevron row, kicker + 34pt serif title) |
| Type | Kicker: 11–12px w700 letterSpacing 1.2–1.4 UPPERCASE textMuted. Meal/section names: `Serif size={23} weight="medium"`. Numbers: sans w800 + `fontVariant:['tabular-nums']`. Body 15, meta 12–13 |
| Stat rows | copy the `statRow`/`cardStat` pattern (`screens/Overview.tsx`, `screens/Progress.tsx`): value 19–20 w800 tabular, 11.5–12 muted label, 1px divider columns, on `surfaceSunken` radius 14 |
| Meters | copy `Meter` in `screens/Overview.tsx` (6px track `ringTrack`, fill accent for protein / textMuted otherwise) |
| Steppers | copy `StepButton` (52px circle) in `components/WeightSheet.tsx` / `AddSheet.tsx` |
| Motion | sheets 260ms bezier(0.32,0.72,0,1); press spring via kit's `usePress`; content swaps ~220ms fade+rise; haptics via `../haptics` (`tap/select/success/impact`) |

## 2. Current state (verified 2026-07-17 — do NOT rebuild)

| System | Where | Notes |
|---|---|---|
| Merged home | `app/src/screens/Day.tsx` | ring+glow (`BudgetRing`), `MacroBar`, Overview entry, day strip (planning on non-today), Brain ladder (usual chips/tiles), logged tiles (full anatomy + ✓ Logged pill at end), swipe-delete (`SwipeRow`) with exact pantry reversal (`meta.decrementedIds` → `kitchen.restoreDecrement`) |
| Overview page | `app/src/screens/Overview.tsx` | full-page Modal: Today / This Week (bars + stats) / This Month (+ weight cross-read) |
| Brain | `packages/brain/src` + `app/src/useToday.ts` | `nextNudge` (fire/framing), `rankSlot`, `portionChips`, nudge-budget config in `app/src/data/brainConfig.ts`; `useToday` returns `usual/tiles/learned/signpost/slots` |
| Events | `app/src/data/eventStore.tsx` | append-only, soft-delete, `logFood(foodId, opts)` — `opts` has slot/kcal/macros/portionG/name/source/meta; ts is ALWAYS `Date.now()` today (M2 changes this) |
| Weights | `app/src/data/weightStore.ts`, `components/WeightSheet.tsx`, `screens/Progress.tsx` | kg-only entries `{day,kg,photoUri?,ts}`, one/day, photos via expo-image-picker + `persistPhoto` (expo-file-system/legacy) |
| Macros | `app/src/data/macros.ts` (`macroTargets(profile)`) | derived: protein 1.6×targetWeightKg, fat 30% budget, carbs remainder |
| Kitchen | `screens/Kitchen.tsx`, `components/kitchen/*`, `data/kitchenStore.tsx` | tab (onClose optional); big full-height cupboard scene + crisp FocusedUnit zoom; counter zone retired (auto-migration on load); `restock(entries)` + fly-in via `recentlyAdded`; demo "scan" is `DEMO_DATA`-gated, production tile = "Add groceries" opening `KitchenAddSheet` |
| Add sheet | `components/AddSheet.tsx` | full-screen on type, local FDC search (`data/fdc-foods.ts`, 8092 foods), portion stepper, barcode → `BarcodeScanner` (expo-camera) → server OFF route (kJ fallback, server `app.ts:132`) |
| Settings | `components/Settings.tsx` | budget stepper, variety segment, pantry/allergy chips, confirm-gated Start over; opened by animated `CogButton` (Progress) |
| Native deps installed | `expo-camera`, `expo-image-picker`, `expo-file-system` (+ plugins in `app/app.json`) | anything else native must be added via `npx expo install` + config plugin + noted for the EAS build |
| Widget stub | `app/src/widget/payload.ts` | `widgetPayload()` exists, consumed by nothing — M1 gives it a consumer |

---

## M1 — Actionable nudges + iOS widget (the moat's delivery) — L

**Goal (§3.6–3.7):** the app asks *"the usual?"* from the lock screen; one tap logs it without opening the app (or with a single auto-logging open as fallback).

### Phase A — local actionable notifications (expo-notifications)

1. `npx expo install expo-notifications expo-task-manager expo-device` (from `app/`). Add `expo-notifications` plugin to `app.json` (icon/color optional; no push credentials needed — LOCAL only).
2. **New `app/src/notifications/nudges.ts`** — the whole subsystem in one module:
   - `ensurePermission(): Promise<boolean>` — `getPermissionsAsync` → if undetermined, DON'T prompt here (see contextual ask below); return granted.
   - `setupCategories()` — iOS category id `USUAL_NUDGE` with actions: `LOG_NOW` ("Log it", `opensAppToForeground: false`) and `SOMETHING_ELSE` ("Something else…", `opensAppToForeground: true`). **Verify against the installed expo-notifications types** that `opensAppToForeground` is the option name; if the SDK 57 types differ, use the typed equivalent — do not invent fields.
   - `rescheduleNudges(input)` — cancel all scheduled (`cancelAllScheduledNotificationsAsync`), then schedule ≤3 for the next 24h: for each meal slot, compute fire time = user's median log time for that slot **minus 10 min** (derive median from `logEvents` timestamps per slot; fallback defaults 08:00 / 12:30 / 19:00 / 16:00), skip past times and already-logged slots; content: title `The usual?`, body `⟨name⟩ · ⟨kcal⟩ kcal — one tap to log`, `categoryIdentifier: USUAL_NUDGE`, and **`data: { foodId, name, kcal, portionG, slot, epochDay, nonce }`** where nonce = `${slot}-${epochDay}`. Respect the §3.6 budget: max 1/slot/day, skip a slot with 2+ recent `nudge_decline` events in 48h (events exist in the store).
   - `handleResponse(response, log, decline)` — if action `LOG_NOW`: call `log(data)`; if `SOMETHING_ELSE` or default tap: navigate intent (see 4). **Idempotency is mandatory:** before logging, check the event log for an existing event with `meta.nonce === data.nonce`; pass `meta: { nonce }` into `logFood`. The same response can be delivered again on cold start — the nonce makes double-logging impossible.
3. **Wire into the app** (`app/App.tsx` + `AppShell.tsx`):
   - On mount: `setupCategories()`, add `addNotificationResponseReceivedListener` → `handleResponse` (log via the EventStore's `logFood` with `source:'usual', taps:1`), and check `getLastNotificationResponseAsync` for a cold-start response (same idempotent path).
   - Recompute hook: after every `logFood`/`skipMeal` and on every foreground (`AppState` → `active`), call `rescheduleNudges` (debounce 2s).
   - After a background `LOG_NOW`, immediately present a confirmation notification: `Logged ⟨name⟩ — ⟨remaining⟩ kcal left today.` (compute remaining from the store).
4. **Contextual permission ask (§2.1 — never the cold OS prompt):** on Today, after the user's 2nd-ever log, show a one-time card (style: `accentFaint` bg radius 16, serif 17 title "One tap from your lock screen", body 13.5 textSecondary "Yumo can ask 'the usual?' when it's time to eat — logging becomes one tap, app closed.", `PrimaryButton full` "Turn on nudges" + centered `TextLink` neutral "Not now"). Persist seen-flag `yumo.nudgeAsk.v1`. Button → OS prompt → on grant, `rescheduleNudges`.
5. **Device-truth caveat (tell Sid in the milestone summary, don't silently decide):** if `opensAppToForeground:false` handling proves NOT to fire the JS listener in background on a real device, flip `LOG_NOW` to `opensAppToForeground:true` — the response listener then auto-logs on open before first paint. Still one tap; note it.

### Phase B — iOS lock-screen/home widget

Display + deep-link first; interactive logging is a stretch goal.

1. Add `@bacons/apple-targets` (config plugin for native targets). Create a `widgets` target (Swift, WidgetKit): small + accessory(rectangular) families. Visual: ring arc (accent #FF6A3D on #17130F, matching tokens) + `⟨kcal left⟩ left` + line 2 `The usual? ⟨name⟩`. Keep the Swift minimal and static-layout.
2. **Data bridge:** App Group `group.com.sidnerusu.yumo` (add to both targets via the plugin config + EAS entitlements). Create a ~40-line local Expo module `app/modules/shared-defaults` (Swift: `set(key, json)` / `get(key)` on `UserDefaults(suiteName:)`; `npx create-expo-module --local` scaffold). From JS, after every `rescheduleNudges`, write `widgetPayload()` (already computed in `app/src/widget/payload.ts`) under key `yumo.widget.v1` and call the module's `reloadWidgets()` (`WidgetCenter.shared.reloadAllTimelines()`).
3. Widget tap → `yumo://today` (scheme `yumo` already in app.json) — app opens on Today where the usual-card is one tap. (Interactive AppIntent logging = follow-up, out of scope this wave.)
4. Android: **out of scope** (TestFlight-only right now) — say so in the commit.

**Acceptance M1:** with permission granted and ≥1 prediction available, a scheduled nudge fires at the right slot time with two actions; LOG_NOW logs exactly once (nonce-idempotent, verified by simulating a duplicate response in a unit test of the handler's pure part); decline path records `nudge_decline`; permission card appears once, never before the 2nd log; widget shows ring + prediction after a build and deep-links to Today. Browser can only verify the card/copy — notification + widget behavior is device-verify (add both to the smoke-test artifact list in M8).

---

## M2 — Backfill logging (log yesterday) — S/M

**Goal:** a forgotten meal can be logged onto any PAST day of the current week. Future days stay planning-only. This is the earlier "isn't every day a logging day?" answer: past = yes, future = no.

1. **`eventStore.logFood`** gains `opts.ts?: number` — when present, use it for the event `ts` (keep id uniqueness from `Date.now()`); default unchanged.
2. **`screens/Day.tsx`:** you already have `isToday`. Add `isPast = dayEpochOf(selected) < todayEpoch` (compute each plan-day's epochDay from `now` + dayOfWeek offset within the current week — derive, don't guess: `todayEpoch - (todayDow - d.dayOfWeek)` adjusting for week wrap).
   - Past-day cards render like today's planning card **with `Log it`** (and `＋ Add`), but NO Brain ladder, NO skip link. `logMeal`/AddSheet `onLog` pass `ts` = that epochDay at a slot-appropriate hour (B 08:30 / L 12:30 / D 19:00 / S 16:00, local) via a helper `tsFor(epochDay, slot)`.
   - Past-day cards show that day's LOGGED items (generalize: extract the `loggedToday` set + per-day items to `loggedOn(epochDay)` / items filtered by `localParts(e.ts,0).epochDay === selectedEpoch` — `useToday` only covers today, so for past days filter `logEvents(events)` directly in Day; reuse the same logged-tile JSX by parameterizing the items source).
   - Under the day strip when a past day is selected, show a quiet notice pill: `accentFaint` bg, 12.5 w600 accentSoft text — `Logging for ⟨Tue 3⟩ — counts toward that day.`
   - Ring/coach stay today-only (unchanged); the summary line on a past day shows `⟨eaten⟩ eaten · ⟨planned⟩ planned`.
3. Streak/Progress/Overview need **zero changes** — they derive from event timestamps.
4. **Acceptance:** browser-verify: select yesterday → Log it on a slot → summary updates, Overview's week bars grow yesterday's bar, today's ring does NOT move; swipe-delete works on the backfilled row; double-log guard holds per that day; future days still have no Log it.

---

## M3 — Weight units (kg · lbs · st) — S

1. **New `app/src/data/units.ts`:** `type WeightUnit = 'kg'|'lb'|'st'`; hook `useWeightUnit()` (AsyncStorage `yumo.units.v1`, default `'kg'`) returning `{unit, setUnit}`; pure helpers `kgToDisplay(kg, unit): string` (`74.2 kg` / `163.6 lb` / `11 st 9.6 lb` — lb = kg×2.2046226218, st = floor(lb/14) + remainder lb 1dp) and `displayToKg(value, unit)`. Round-trip stays canonical: **storage is ALWAYS kg** (weightStore untouched).
2. **Settings** (`components/Settings.tsx`): new section kicker `WEIGHT UNIT` directly under DAILY BUDGET — segmented pill track exactly like VARIETY (`surfaceSunken` track, accent selected pill): `kg · lb · st`. Persists immediately via the hook (not part of Save).
3. **WeightSheet:** input + steppers operate in the chosen unit — kg: ±0.1; lb: ±0.2; st: show as `st` + `lb` pair of inputs? NO — keep ONE input: for `st`, the text field takes decimal stones? That's unnatural. Binding design: for `st`, the big number shows `11 st 9.6`, editing happens in **lb-granularity steppers only** (±0.2 lb) and tapping the number opens the same decimal field in **lb** with a small `st` conversion caption below (`= 11 st 9.6 lb`). Simple, no double-field. Save converts to kg.
4. **Format every user-facing weight** through `kgToDisplay`: Progress hero + chip + "kg this week" recap cell + serif recap line, photo captions/viewer, Overview month `kg change` cell (label becomes `weight change`), WeightSheet validation copy. Chart stays raw kg internally (shape identical in any unit).
5. **Acceptance:** switch to lb → every surface reads lb consistently; log 163.6 lb → stored kg ≈ 74.2 (assert in a small unit test for the converters — put it in `app/src/data/__tests__`? NO — app tests aren't wired into vitest; put converter tests in `packages/shared/test/units.test.ts` by moving the pure converters into `packages/shared/src/units.ts` and re-exporting from the app hook. Pure logic in packages = tested; hook stays app-side).

---

## M4 — Editable macro targets — S

1. **Persistence:** the saved profile JSON (`usual.profile.v1`, shape `{profile, goal}` in `app/App.tsx`) gains optional `targets?: { proteinG?: number; carbsG?: number; fatG?: number }`. Thread it: `App.tsx` state → `AppShell` → `Day`/`Overview` alongside profile (simplest: extend the in-app profile object with a non-engine field before passing down — check `UserProfile` typing; if strict, carry `targets` as a separate prop from App).
2. **`data/macros.ts`:** `macroTargets(profile, overrides?)` — overrides win field-by-field; keep derivation as the default. Update both call sites (Day, Overview).
3. **Settings UI:** new section `DAILY TARGETS` under the budget stepper:
   - Protein: same stepper row anatomy as budget (52→38px round ± buttons, value 22 w800 tabular + `g protein`), ±5g, clamp 60–300, default = current derived value (shown, not blank).
   - A quiet `TextLink` "Advanced: carbs & fat" toggling two more steppers (±10g; carbs clamp 50–600, fat 20–200). Collapsed by default — most users should never touch them (research: over-configuring macros is a known drop-off).
   - Under the steppers, one 12px muted line: `Protein drives your menu; carbs and fat are guides.`
   - "Save changes" writes them into the stored profile JSON.
4. **Engine wiring (check, don't assume):** open `packages/menu/src/types.ts` — if `UserProfile` has a `proteinG` (or similar) field consumed by `generateWeekMenu`, pass the protein override through `Day.tsx`'s profile so menus honor it. If no such field is consumed, targets stay display-layer and you write that in the commit body. Do not modify the engine in this milestone.
5. **Acceptance:** set protein 150g → MacroBar + Overview meters read `/150g` immediately after Save; reset path (Start over) clears overrides; gates green.

---

## M5 — Saved meals ("My meals") — M

**Goal:** the homemade thing you log daily becomes one tap, without search.

1. **New `app/src/data/myMeals.ts`:** AsyncStorage `yumo.mymeals.v1`; `SavedMeal { id: string; name: string; kcal: number; proteinG?: number; carbsG?: number; fatG?: number; portion?: string; createdAt: number }`; id = `my-${Date.now().toString(36)}`; hook `useMyMeals()` → `{meals, save(meal), remove(id)}`; dedupe on save by case-insensitive name (replace existing).
2. **Save affordance** (in `Day.tsx` logged tiles): for a logged item that does **NOT** resolve via `recipeFor` (custom/barcode/portioned foods — catalogue recipes are already one-tap elsewhere), render under its macro line a quiet `TextLink` `Save to my meals` (tone positive, 13px). On tap → `save({name, kcal, macros, portion from event portionG ? `${portionG} g` : undefined})`, haptic `success`, and the link becomes plain muted text `Saved ✓` (derive state by checking `useMyMeals().meals` for the name — no local flag).
3. **AddSheet section:** new `MY MEALS` section rendered ABOVE `FOODS` (and below `FROM YOUR MENU`), only when `meals.length > 0` and the row matches the current search/band filters. Row anatomy = the existing meal `Row` (name 15 w500, macro line `45P · 78C · 21F` when macros exist, kcal, ＋; one tap logs with `source:'mymeal'`, `taps:2`). Wrap each row in the existing `SwipeRow` with `onDelete={() => remove(id)}` — swipe-left to delete a saved meal, same gesture language as everywhere else.
4. **Brain:** nothing to wire — saved meals enter the event log with stable `my-*` foodIds and `meta.name`, so `useToday`'s resolver and the prediction candidates pick them up exactly like any repeated food. Verify a saved meal logged 3 days running appears as a quick-log tile (browser: seed events with the same `my-*` id across days).
5. **eventStore:** add `'mymeal': 'log'` to `SOURCE_KIND`.
6. **Acceptance:** log a portioned FDC food → `Save to my meals` appears → saved → appears in AddSheet MY MEALS → one tap logs it with identical macros → swipe deletes it. All browser-verifiable.

---

## M6 — Real receipt capture (on-device OCR, no server) — L

**Deviation from kitchen plan §5.1 (server OCR) — deliberate, tell Sid in the summary:** on-device text recognition is free, offline-first, and the receipt image never leaves the phone (privacy §5.1's own rule). No new server surface.

1. **Library:** `@react-native-ml-kit/text-recognition` (Google ML Kit, on-device, iOS+Android). `npm install` in `app/`, confirm it needs no config plugin (autolinked pod) — if the current version requires one, add per its README. **This is a native dep → new build required; note it.**
2. **Flow (production, replaces the demo-gated fake):** Kitchen tile "Add groceries" gains a second action row when pressed — small chooser sheet (reuse `Sheet`): `Scan a receipt` (PrimaryButton full) / `Type it in` (OutlineButton full → existing `KitchenAddSheet`) / cancel. Scan → `ImagePicker.launchCameraAsync({ quality: 0.8 })` (fallback `launchImageLibraryAsync` via a `TextLink` "choose a photo") → `TextRecognition.recognize(uri)`.
3. **New `app/src/data/receiptParse.ts` (pure, unit-testable in `packages/shared`? NO — it depends on app vocab; keep app-side pure module):**
   - Input: ML Kit lines (strings). Output: `{ matches: Array<{token, label, price?}>, unmatched: string[] }`.
   - Normalize each line (lowercase, strip qty prefixes `2x`/weights `0.454kg`, collapse spaces). Extract trailing price via `/([£$€]?\d+[.,]\d{2})\s*$/`.
   - Match against the kitchen vocabulary: build the candidate token set from `buildFoodVocab(kitchen.items)` + the shelf-life dataset's category tokens (`data/shelf-life.ts` — it exports the category list; check the actual export name) + `POOL` recipes' `foodTokens`. Match = whole-word containment either direction on the normalized line (reuse `tokenMatch` from `data/kitchen-model.ts` — do NOT write a new matcher).
   - Drop obvious non-food lines: no letters, or containing any of TOTAL/CARD/CASH/CHANGE/VAT/BALANCE/POINTS (case-insensitive) — keep this tiny stop-list as a `const` in the module with a comment that it's receipt STRUCTURE vocabulary, not food content (doesn't violate the food-list rule).
4. **Confirm sheet — `components/kitchen/ReceiptConfirmSheet.tsx` (§5.1 "vision proposes, the human confirms"):** `Sheet` with title serif 24 `Check the shopping`, subtitle muted 13 `⟨n⟩ items matched · tap to untick`. Matched rows: checkbox-style rows (row anatomy from `ShoppingListSheet` — read it and mirror), each pre-ticked: label 15, price 13 muted right when parsed. Unmatched lines collapsed under a muted disclosure `⟨m⟩ lines we couldn't read` (12.5, expandable, greyed italic — honest, not hidden). Footer `PrimaryButton full` `Add ⟨k⟩ to kitchen` → `kitchen.restock(ticked.map(m => ({token, label: titleCase(label), price})))` — the existing fly-in choreography fires automatically via `recentlyAdded`; close; haptic success; `track('receipt_scanned', {lines, matched})` with REAL numbers (this analytics event exists — it finally becomes true).
5. **Web:** ML Kit is native-only — on web the chooser's Scan button shows the same pattern as `BarcodeScanner`'s web branch (serif "Scanning needs the app" + Got it). Guard with `Platform.OS === 'web'`.
6. **Acceptance:** unit-test `receiptParse` with 3 fixture receipts (a UK supermarket shape: item lines + prices + TOTAL/CARD noise) — put fixtures + the pure parser in `packages/shared/src/receipt.ts` + `packages/shared/test/receipt.test.ts` so vitest covers them (move the pure part there; the app module re-exports and adds vocab). ≥80% of the food lines in fixtures must match (§12 Phase C bar). Device: end-to-end scan is a smoke-test item.

---

## M7 — Apple Health — M

1. **Library:** `@kingstinct/react-native-healthkit` (Expo config plugin support). Install, add its plugin to `app.json`, and add `NSHealthShareUsageDescription` ("Yumo reads your weight so weigh-ins from your scale appear automatically.") + `NSHealthUpdateUsageDescription` ("Yumo saves your weigh-ins and logged calories to Health."). **Verify the plugin's exact app.json shape from the package README in node_modules — do not guess key names.** Native dep → build.
2. **New `app/src/data/health.ts`:** thin wrapper, all no-ops on web/Android:
   - `isAvailable()`, `requestAuth()` (read: bodyMass; write: bodyMass, dietaryEnergyConsumed),
   - `readWeightsSince(ts)` → `[{kg, ts}]` (bodyMass samples, unit kg),
   - `writeWeight(kg, ts)`, `writeEnergy(kcal, ts)`.
3. **Settings toggle:** section `APPLE HEALTH` (iOS only): row styled like "From your kitchen" toggle pill — `Sync with Apple Health`. On enable → `requestAuth()`; persist `yumo.health.v1` = '1'.
4. **Sync rules (simple, deterministic):**
   - On Progress mount + app foreground (when enabled): `readWeightsSince(lastSyncTs)`; for each sample, if no entry exists for that epochDay, `logWeight`-equivalent write into weightStore with the sample's day (extend `useWeights` with `importEntries(samples)` that never overwrites a manual same-day entry); store `lastSyncTs`.
   - On manual `logWeight` (when enabled): `writeWeight`.
   - On `logFood` (when enabled): `writeEnergy(kcal, ts)`. Deleting a log does NOT claw back Health (note this in a comment; Health is append-only in v1).
5. **Acceptance:** typecheck + web no-op safety (app runs in browser with the toggle hidden); device flows are smoke-test items. Unit-test `importEntries` merge rules in the same pattern as other pure logic.

---

## M8 — Debt: seasoning list → data, smoke-test refresh — S

1. **`FIXED_WHEN_SCALED` regex (`app/src/data/repo.ts:161` area) violates the no-food-lists-in-code rule.** Fix: new versioned data file `app/src/data/scaling-fixed.json` — `{"$description": "...", "fixedTokens": ["salt","pepper","oil", ...exact current regex vocabulary...]}` (transcribe every alternative from the regex, nothing more). `repo.ts` builds ONE `RegExp` from the file at module load (word-boundary joined, escaped) and uses it in both `scaleIngredient` and `scaleStepText`. Behavior must be byte-identical: add a vitest in `packages/shared`? — no: the scaling helpers live in the app. Move `formatQty/scaleIngredient/scaleStepText/portionLabel` + the JSON into `packages/shared/src/scaling.ts` (they're pure; `repo.ts` re-exports) and port the existing behavior with a test asserting the old regex and the data-built regex accept/reject the same 20-sample token list.
2. **Smoke-test artifact:** tell Sid it needs regenerating with new sections (nudges incl. background LOG_NOW, widget, backfill, units, targets, my meals, receipt scan, Health) — Fable owns the artifact; just list the device-verify items you accumulated in `HANDOFF.md`.
3. **HANDOFF.md:** update per milestone (one table row each), keep the gates line current.

---

## Build order & definition of done

| Order | Milestone | DoD |
|---|---|---|
| 1 | M3 units | converters tested in packages/shared; all weight surfaces formatted; gates green |
| 2 | M4 targets | Settings steppers live; MacroBar/Overview honor overrides; gates green |
| 3 | M2 backfill | browser-verified past-day log + delete + guards; gates green |
| 4 | M5 my meals | browser-verified save→add→log→delete loop; tile prediction check; gates green |
| 5 | M1 nudges+widget | handler nonce-idempotency unit-tested; card/copy browser-verified; device items listed |
| 6 | M6 receipts | parser ≥80% on fixtures (vitest); chooser+confirm sheet browser-verified (web branch) |
| 7 | M7 Health | wrapper + toggle + merge rules tested; web-safe |
| 8 | M8 debt | regex→data equivalence test green; HANDOFF updated |
| 9 | EAS build | `cd app && eas build -p ios --profile production && eas submit -p ios --latest` (no `#` comment lines in the shell). ONLY after Sid says go. |

Small-first ordering is deliberate: M3/M4/M2/M5 are pure-JS and land in TestFlight the moment the (already-pending) native build ships; M1/M6/M7 add native deps and define the build after which the full smoke test runs.

## Out of scope (do not build in this wave)

Android widget/Glance · interactive widget AppIntent logging · push (remote) notifications · Health workouts/steps · receipt SERVER endpoint · price analytics beyond the existing money recap · photo food logging · RevenueCat · server sync of weights/kitchen · backfill beyond the current week (a date-picker history editor is a later feature).

## Device-verify list (accumulate for the smoke test)

Background LOG_NOW · nudge timing/budget · widget render + deep link · receipt scan e2e (real supermarket receipt, ≥80% matched) · Health read/write both directions · lb/st display on Progress · camera/photos permission strings.
