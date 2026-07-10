# Client (React Native / Expo)

**Stack LOCKED: React Native + Expo** (Sid, 2026-07-10). Decisive factor: the
whole engine layer is TypeScript, so the app imports `@yumo/brain`,
`@yumo/menu`, `@yumo/shared`, `@yumo/tokens` **straight from source** — no
build step, no Dart port. Metro bundles them cleanly (verified: 244 modules, 0
resolution errors).

## Run it

```
cd ~/Desktop/usual/app
npm run ios       # or: npm run android  (needs Xcode / Android Studio)
npm run web       # opens in a browser (react-native-web)
```

## What's built — the Today screen (§6.1)

`app/App.tsx → src/screens/Today.tsx`, wired to the engines with local seed
data (offline-first; replaced by the server/sync layer later):

- **Budget ring** (`components/BudgetRing.tsx`) — SVG, eaten vs remaining.
- **"The usual?" card** (`components/UsualCard.tsx`) — when the Brain fires a
  high-confidence nudge, shows the predicted meal + learned portion + one-tap
  "Log it"; otherwise falls back to top-3 quick-log tiles.
- **Coach line** + **timeline** of today's logs.
- `useToday.ts` runs the real Brain (`nextNudge`/`rankSlot`) over seed events →
  the screen state. Verified headlessly: at a 12:30 lunch it produces a
  confident "Chicken & rice · 400g" (Brain score 0.76), ring 280/2200, top-3
  tiles, breakfast in the timeline.

## Design system bridge

`src/theme.ts` bridges `@yumo/tokens` into RN and follows the device
light/dark scheme (`useColorScheme`). No ad-hoc colors — every surface/text
pulls from the token set.

## Monorepo wiring (the setup that makes TS reuse work)

- `app/` is an npm workspace; `metro.config.js` sets `watchFolders` to the repo
  root + `nodeModulesPaths` to app + root, so Metro resolves the `@yumo/*`
  symlinks and transpiles their TS source.
- Repo-wide change: internal imports are now **extensionless** (`./x`, not
  `./x.ts`) so any consumer's `tsc` (the app included) type-checks the engine
  packages without special flags — resolves identically under tsc/tsx/vitest/
  Metro. `allowImportingTsExtensions` removed.

## Verified

- Metro web bundle: clean (App smoke-test 195 modules; Today screen 244).
- `app` typecheck (`tsc --noEmit`): clean.
- Screen data: verified against the engines headlessly (see above).
- Pixel render: not screenshotted here (no connected browser in this env); run
  `npm run web`/`npm run ios` to see it live.

## Screens built

- **Onboarding** (§2) — `src/onboarding/` (see `docs/onboarding.md`).
- **Today** (§6.1) — `src/screens/Today.tsx`.
- **Menu** (§6.2) — `src/screens/Menu.tsx`: day selector, generated week from the
  onboarding profile via `@yumo/menu`, per-meal "Mix it up" (inline swap) and a
  tap-to-reveal "Recipe" steps sheet (`components/RecipeSheet.tsx`, §14.2).
- **Progress** (§6.3) — placeholder tab.
- **Tab shell** — `src/AppShell.tsx` (Today / Menu / Progress).

## Not built yet (the rest of the app)

- Server wiring (the app still uses local seed data — swap to `/api/*` + the
  encrypted event sync).
- Progress screen content (weight trend, adherence, streak-with-freeze).
- Native modules: WidgetKit + App Intents (Swift), Notifee actionable
  notifications + background log handler, HealthKit — these need a dev build
  (not Expo Go) and on-device testing.
- The bubble 60fps spike is now informational (RN is locked) but still worth
  running on-device before leaning hard on the physics bubbles.
