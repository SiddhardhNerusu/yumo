# Yumo — project instructions

**Yumo is a standalone project.** It is *not* Goyo (Sid's workout app). Nothing about SwiftUI, Xcode, or the Goyo voice system applies here.

**Read `HANDOFF.md` first** for current state, then `docs/plans/README.md` for the specs.

---

## What this is
A prediction-first calorie app. The moat is **anticipating what you'll eat**, not logging speed.

- npm-workspaces **TypeScript monorepo, no build step** (tsx/vitest run straight from source).
- Packages: `tokens`, `shared`, `brain`, `menu`, `catalogue-pipeline`, `server`, `app` (all `@yumo/*`).
- App: **React Native / Expo SDK 57**, **offline-first** — the server is optional and everything falls back to local data.
- Server: Render, `usual-server.onrender.com` (legacy name — **do not rename**, `app/eas.json` points at it).

## Gates — run BOTH, every time
```bash
npm run typecheck   # root: per-package, has noUncheckedIndexedAccess
npm test            # 158 green
```
The **app-only** `tsc` is NOT sufficient — it silently misses errors the root typecheck catches. And **wait for `npm test`**; don't pipe it to `tail` and lose the exit code.

⚠️ **App tests are not in the runner.** `vitest.config.ts` only includes `packages/*/test` and `server/test`. Client features must be verified in the **browser**, not by tests.

## Hard rules (owner-locked)
1. **No hardcoded food / cuisine / recipe / ingredient lists in code.** Content is versioned **data**. Cuisines derive from live catalogue counts. (Linguistic/scoring heuristics — stopwords, stemming, descriptor penalties — are fine; they aren't food catalogues.)
2. **Root cause only. No band-aids.**
3. **Macros are ALWAYS FDC-computed, never authored.** LLMs may write *text* (names, steps) offline; they must never produce a macro number. Every recipe passes Atwater verification (≤5%).
4. **Zero runtime LLM.** All authoring happens offline, human-gated.
5. **Ask when unsure** — Sid: *"if u ever have questions always ask dont blindly do something."*
6. **Design tokens only** (`packages/tokens`) — no raw hex. WCAG contrast is test-enforced in both themes.
7. **Never a punitive or shaming tone** in user-facing copy. It's a calorie app; this matters.
8. **Commits:** Sid commits himself by default. He granted commit+push for the meal-engine program specifically — a new unrelated task needs fresh confirmation.

## Gotchas that have already cost real time
- **Browser: hard-reload, never trust HMR.** After edits, `navigate` to `http://localhost:8081`. Fast Refresh throws stale `"X is not defined"` errors that are **not real bugs**. Use `resize_window` preset `mobile` (stable 375-coord space) and click via `javascript_tool` PointerEvent dispatch — raw coordinate clicks are unreliable on RN-web.
- **`app/src/data/catalogue.generated.ts` — the `[` trap.** It's `export const GENERATED_POOL: MenuSeedRecipe[] = [...]`. The **type** contains a `[`, so `indexOf('[')` finds the wrong bracket. Slice on `'= ['` and **include** the bracket, or you'll silently corrupt the file.
- **Never do a naive full pipeline regen.** The re-authored steps (inline amounts + time/temp) and the `methods` field live **only** in `catalogue.generated.ts` — they were never written back to the drafts, so `npm run spike` + naive regen **destroys them**. To add recipes, follow `packages/catalogue-pipeline/scripts/run-snacks.ts` (runs only new drafts). To correct macros, sync `perServing`/`allergens` **by id** while preserving `steps`/`methods`/`ingredients`.
- **Render cold start is by design.** The free tier sleeps; `app/src/api/client.ts` has a 4s abort timeout so a cold server falls back to local. Don't "fix" a slow first load by removing the fallback.

## ⚠️ Known error in the spec
`docs/plans/meal_engine_master_plan.md` **§6.3 is wrong** — it says to add FNDDS yield/retention factors for raw→cooked macros. **Do not implement it.** USDA retention factors cover only vitamins/minerals/alcohol (never protein/carb/fat), and yield factors are unnecessary because FDC already ships separately lab-measured raw *and* cooked entries. The real bug was **state-aware entry selection**, already fixed in `packages/catalogue-pipeline/src/fdc/resolve.ts`. See `HANDOFF.md` §3.

## Ship
From `app/` (no `#` comment lines — zsh chokes on them):
```bash
eas build -p ios --profile production
eas submit -p ios --latest
```
Server changes deploy on `git push` (Render). **App JS changes need a new EAS build to reach the phone.**
