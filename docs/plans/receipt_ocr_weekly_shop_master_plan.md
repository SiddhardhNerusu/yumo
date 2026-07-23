# Yumo — Receipt Camera OCR + Weekly Shop: Master Implementation Plan

Destination: `docs/plans/receipt_ocr_weekly_shop_master_plan.md` in the Yumo repo (`~/Desktop/488/Yumo`).
Executor: Opus 4.8. Owner rules apply throughout: tokens only (withAlpha for tints), no hardcoded food lists (content = versioned data), root-cause fixes, never-punitive copy, macros FDC-computed, **no sim tests** (compile-only OK; owner verifies on device), **ask before pushing**; per-milestone commits allowed.

## Vision (owner's words)
Scan receipt opens the camera; the user **takes a photo or picks one from their library**; we parse it, keep only the **foods**, and **auto-sort each into the right unit** (yoghurt→fridge, rice→cupboard, frozen peas→freezer) with a one-tap confirm. Separately, a **weekly shop**: on the user's shop day a push lands — "Your shop list is ready" — opening one merged, aisle-grouped list of what to buy (flagged items + what next week's menu needs), check-off restocks the kitchen.

## What already exists (built + verified this session — do NOT rebuild)
- `packages/shared/src/receipt.ts` — `parseReceipt(lines: {text, top?}[], vocab) → {matches: {token,label,price?,variant,line}[], unmatched[]}`. Strips prices/quantities, drops non-food + structure lines (TOTAL/VISA/kitchen roll → `unmatched`), flags best-guess `variant` matches. Tested (`packages/shared/test/receipt.test.ts`).
- `app/src/data/foodVocab.ts` — `buildFoodVocab(kitchen.items)`: broad food catalog (recipe pool tokens + single foods + starter + live kitchen).
- `app/src/data/shelf-life.ts` — `defaultZone(token)` auto-routing, tuned this session: fruit/root veg → cupboard, `\bfrozen\b` → freezer (word-boundaried so "rice" never matches), chilled → fridge. Shelf-life days per category × zone.
- `app/src/components/kitchen/ReceiptSheet.tsx` — the **paste-text** front door → parse → confirm list (zone chips, variant matches start unticked, prices, per-row include/drop) → `kitchen.restock(entries)`. Browser-verified end-to-end ("5 foods found · 1 line skipped"; Bananas→Cupboard, yogurt→Fridge).
- `app/src/screens/Kitchen.tsx` — Scan-receipt pill wired to ReceiptSheet; `onManual` falls back to KitchenAddSheet; snackbar `flash()` helper exists.
- `app/src/data/shoppingList.ts` — persistent flagged list (`add/remove/removeMany/has`, one row per token, functional updaters). Used-up/Running-low actions feed it.
- `app/src/data/shopping.ts` — **orphaned on purpose** (kept as prior art): `buildShoppingList(picks: {recipe, portionScale}[], have) → ShopAisleGroup[]` — aisle-grouped menu-gap list with household quantities ("2 breasts · 400g") from `ingredient-shop.json` (versioned data). THIS plan resurrects it.
- `app/src/data/repo.ts` — `getMenu(profile)` → week plan; old Kitchen mapped `plan.days.flatMap(d => d.picks.map(p => ({recipe: p.recipe, portionScale: p.portionScale})))` for exactly this builder.
- M1 nudge-scheduling core — expo-notifications wired for meal nudges. **Locate before use**: `grep -rn "expo-notifications\|scheduleNotificationAsync" app/src` (likely `app/src/data/` or `app/src/notifications`); reuse its permission-request + schedule/cancel patterns and its response-tap listener.
- `expo-camera ~57.0.1` already in `app/package.json`.

## ⚠️ Phase 0 — environment + land the pending batch (do FIRST)
The previous session lost macOS Desktop access mid-turn (`EPERM getcwd`); the paste-flow receipt batch is **uncommitted** in the working tree.
1. Confirm shell + repo access (`git status`). If EPERM persists, the owner must re-grant Desktop/Full Disk Access to the terminal app.
2. Run the 3 gates: `npm run typecheck` · `cd app && npx tsc --noEmit` · `npm test` (last known: 373 green, app tsc 0).
3. Commit the pending batch (ReceiptSheet paste flow + shelf-life zone tuning + Kitchen wiring) with its own message before starting OCR work.
4. Reminder for the report to owner: ALL session work (Today/Overview/True burn/Kitchen/onboarding + this) is local/unpushed — ask before pushing.

## Phase 1 — OCR capture (the camera front door)

### 1.1 Dependency (research-backed choice)
**Primary: `@react-native-ml-kit/text-recognition`** — mature (~582★), `TextRecognition.recognize(imageUri)` → `{text, blocks[]}` where each block has `lines[]` each with `text` + `frame` — **line-level frames map 1:1 onto `ReceiptLine {text, top}`**, exactly what `receipt.ts` was designed for. Plain autolinking; `npx expo prebuild` handles the iOS pod; on-device, no network. New-architecture: runs via RN's interop layer — **verify at first dev build**; if it fights SDK 57/new-arch:
**Fallback: `expo-ocr-kit`** (Expo Modules API — new-arch native; Apple Vision on iOS = no Google pods, ML Kit on Android; `recognizeText(uri)` → blocks + bounding boxes). Young (0.1.4), and block-granularity means splitting block text on `\n` and approximating per-line `top` — acceptable.
Also add **`expo-image-picker`** (`npx expo install expo-image-picker`) for "send a photo". Use `npx expo install` for everything so versions pin to SDK 57.

**Build reality:** OCR is native → **dev build only** (Expo Go/web preview cannot run it). Owner verifies on device (no sim). The web preview keeps working via the paste path (platform gate below).

### 1.2 Adapter — `app/src/data/receiptOcr.ts`
One thin, swappable seam so the OCR vendor never leaks into UI:
```ts
import type { ReceiptLine } from '@yumo/shared';
export async function ocrReceipt(uri: string): Promise<ReceiptLine[]>
```
- ml-kit path: `recognize(uri)` → `blocks.flatMap(b => b.lines)` → `{text: l.text, top: l.frame?.top}` → sort ascending by `top` (reading order) → return.
- Lazy-import the native module inside the function (`await import(...)`) and export `export const ocrAvailable: boolean` guarded by `Platform.OS !== 'web'` + module resolution — the web bundle must not crash.
- Unit test the **mapping** (`app/test/receiptOcr.test.ts`, RN-free): mock the recognizer module, feed a fixture of blocks/lines with frames, assert flatten/sort/shape. Do not test the native lib itself.

### 1.3 ReceiptSheet: camera-first UX
Extend `ReceiptSheet.tsx` with a mode state machine: `capture → reading → confirm` (paste stays as a mode).
- **capture** (initial when `ocrAvailable`): two big actions — `📷 Photograph receipt` and `🖼 Choose a photo` — plus a quiet `Type it instead` TextLink (existing paste UI). When `!ocrAvailable` (web/preview), skip straight to paste (current behaviour, keeps browser testing alive).
- **Photograph**: full-screen `CameraView` (expo-camera) inside the sheet's modal — shutter button, `useCameraPermissions` with a friendly pre-prompt line; capture → `uri`. **Choose a photo**: `ImagePicker.launchImageLibraryAsync({mediaTypes: Images})` → `uri`.
- **reading**: `ocrReceipt(uri)` with a gentle loading state ("Reading your receipt…"). Errors/empty (`lines.length === 0` or throw): "Couldn't read that — try a flatter, brighter shot." + `Retake` / `Type it instead`. Never punitive.
- **confirm**: feed lines into the EXISTING pipeline — `parseReceipt(lines, buildFoodVocab(items))` → the existing confirm list (zones, variant opt-in, prices) → `onConfirm` → `kitchen.restock`. Zero changes to the confirm UI.
- After confirm, fire the Kitchen snackbar: `Added {n} to your kitchen`.
- Analytics: `receipt_scanned {source: 'camera'|'library'|'paste', lines, matched}`.
- Permissions strings: `app.json` → expo-camera / expo-image-picker config-plugin entries (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) — check what's already there before adding.

### 1.4 Stretch (only if Phase 1 lands clean)
- **Multi-photo long receipts**: on confirm screen, `＋ Add another photo` → OCR → append lines → re-parse. Lines concat trivially.
- **Two-column price re-pair** (the reason `top` exists): a pure function that merges a price-only line into the text line whose `top` is within a tolerance; tests in `receipt.test.ts`. Only if real receipts show split columns.

## Phase 2 — Weekly shop (merged list + shop-day push)
Owner decisions: **push on a chosen shop day** + **merged contents** (flagged items ∪ menu gaps), aisle-grouped with quantities.

### 2.1 Data — `app/src/data/weeklyShop.ts` (pure, RN-free) + refactor of `shopping.ts`
- Refactor `shopping.ts` minimally: export `aisleFor(token): Aisle` (the `SHOP[tk] ?? dry` lookup) alongside `buildShoppingList` — no behaviour change; it stops being orphaned.
- New `buildWeeklyShop(flagged: ShopItem[], picks: ShopPick[], have: Set<string>) → ShopAisleGroup[]`:
  - menu gaps via `buildShoppingList(picks, have)`;
  - flagged tokens not already present get a row in their `aisleFor` aisle (`qty: ''`, `meal: ''` → UI shows "you flagged this");
  - dedupe by token — a token both flagged and menu-needed appears ONCE, keeping the menu row's qty/meal;
  - stable `AISLE_ORDER`; alphabetical within aisle (existing behaviour).
- Tests `app/test/weeklyShop.test.ts`: merge/dedupe, flagged-only aisles, empty inputs, flagged+menu overlap keeps qty.

### 2.2 UI — upgrade the Kitchen shopping sheet
The local `ShoppingListSheet` in `Kitchen.tsx` currently renders only the flagged store. Upgrade to the weekly shop:
- Kitchen fetches the week's picks once (`getMenu(profile)` → `picks`, memoized; the old pre-revamp Kitchen did exactly this — pattern is in git history at `075fca4:app/src/screens/Kitchen.tsx`).
- Sheet renders `buildWeeklyShop(shopping.items, picks, have)`: aisle kickers (11/700/1.3 uppercase textMuted), rows = label + qty (12.5 tabular textMuted) + check-off; flagged rows keep the × remove; menu-derived rows get no × (they'd re-derive) — their row sub-line reads `for {meal}`.
- Check-off + `Bought — add to kitchen` keeps the EXISTING semantics: one `kitchen.restock(tokens)` (zones via `defaultZone`) + `shopping.removeMany(flagged ∩ bought)`. The checked/×-desync intersect guard stays.
- Footer count = merged list length (footer link already exists).

### 2.3 Shop-day reminder
- **Settings**: a "Weekly shop" row — day-of-week pills (Mon…Sun) + an Off state. Persist in a small AsyncStorage key (`yumo.shopday.v1`) colocated with however M1 stores nudge prefs (match the existing pattern — VERIFY first).
- **Scheduling**: via the M1 core / expo-notifications weekly calendar trigger (`weekday`, ~09:00, `repeats: true`). Content: "Your shop list is ready 🛒 — open Yumo to see it." (counts are stale in static notifications — refresh the scheduled notification's body on app foreground if cheap, else omit the count). Cancel + reschedule on day change / Off. Request notification permission **when the user enables the shop day**, never at boot.
- **Tap-through**: reuse M1's notification-response listener → navigate Kitchen tab + open the shop sheet (a simple pending-intent flag read on mount is fine).
- Web preview: scheduling no-ops behind `Platform.OS === 'web'` guard.
- Analytics: `shop_day_set {weekday}`, `weekly_shop_opened`, `weekly_shop_bought {n}`.

## Phase 3 — review + report
1. Run all 3 gates (typecheck ×2 + `npm test`).
2. Browser-verify what the preview can reach: paste path still works, weekly-shop sheet renders merged aisles, Settings shop-day picker.
3. Adversarial self-review of the diff (wiring of restock/removeMany, permission flows, web guards, no new raw hex, no punitive copy, no hardcoded food lists — aisle/unit data stays in `ingredient-shop.json`).
4. Commit per milestone. **Ask the owner before any push.** Remind: device verification needed for camera OCR + notifications (dev build: `npx expo prebuild` + run on device / EAS dev client — owner runs it; no simulator).

## Risks & mitigations
- **ml-kit vs new-arch (SDK 57)**: interop usually suffices; verified at first prebuild. Fallback `expo-ocr-kit` sits behind the same `ocrReceipt()` seam — a one-file swap.
- **Expo Go/web can't run OCR**: by design — `ocrAvailable` gate keeps paste as the universal fallback; preview stays fully testable.
- **OCR quality (crumpled/thermal receipts)**: friendly retry copy + paste fallback; parser already tolerates noise (drops unmatched).
- **Static notification counts**: omit count or refresh-on-foreground; never show a wrong number.
- **`getMenu` cost in Kitchen**: memoize once per mount (old Kitchen did this without issue).

## Acceptance checklist
- [ ] Scan receipt (device): camera opens → photo or library pick → foods extracted, non-food lines skipped, each food pre-routed to the right unit → one-tap add → items appear in the correct units with shelf-life clocks.
- [ ] Variant guesses start unticked; prices carried; paste path still works everywhere (incl. web preview).
- [ ] Weekly shop sheet: one merged aisle-grouped list (flagged + menu gaps, deduped, quantities); check-off restocks kitchen + clears flagged rows.
- [ ] Shop-day push arrives on the chosen morning; tapping opens the shop list; Off cancels it; permission asked only on enable.
- [ ] All 3 gates green; no new raw hex; no hardcoded food lists; copy never punitive; nothing pushed without the owner's say-so.
