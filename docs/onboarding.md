# Onboarding (§2)

**Status: BUILT & verified.** The 0–5 minute setup funnel — the retention-
critical stretch (research: days 1–3 decide everything). Produces a
`UserProfile` that feeds the menu engine and seeds the Brain.

## The budget math (`@usual/shared/budget.ts`, 6 tests)

Deterministic, server-usable, ED-safe:
- `mifflinStJeorBMR` + `tdee` (activity ×1.2 / 1.375 / 1.55 / 1.725);
- `dailyBudget` → BMR × activity − (rate × 7700 / 7), with a **hard floor**
  (1,500 kcal M / 1,200 F) and an `edSignpost` flag when the requested target
  would fall below it (§7.4). Verified: man 80/180/30 desk lose-0.5 → 1,586;
  aggressive small-frame loss clamps to 1,200 and raises the signpost.

## The flow (`app/src/onboarding/OnboardingFlow.tsx`)

`Welcome → Goal → Body → Activity → Rate → NUMBER REVEAL → Needs → Likes →
Hates → Allergies → Variation → Cuisine → Menu reveal → Notification/Health
asks → done`. (Rate is skipped for "maintain".)

- **Number reveal** — the "screenshot moment": the big target with a "how did
  we get this?" expander (BMR → ×activity → −deficit → target) and the ED
  signpost when floored.
- **Bubble picker** (`Bubbles.tsx`) — selectable food chips; needs capped at 3,
  likes at 12, hates uncapped (§2.2). v1 is a chip grid; the physics-floating
  version is a later Reanimated/Skia pass.
- **Menu reveal** — a plain-language summary ("Chicken worked in most days. No
  tuna, ever. Around 1,786 kcal a day."), matching the §2.1 copy.
- **Finish** builds a `UserProfile` (budget from the reveal, needs/likes/hates
  lowercased to tokens, allergies, variation, cuisine lean) → the app switches
  to Today, and the onboarding budget flows straight into the ring.

UI primitives live in `app/src/ui/primitives.tsx` (Screen, PrimaryButton,
Choice, Chip, NumberField, ProgressDots), all token-driven + light/dark aware.

## Verified

- `@usual/shared` budget: 6 unit tests.
- App typecheck clean; web bundle clean (249 modules).
- Number-reveal math confirmed against `dailyBudget` for the default profile.

## Not done yet / follow-ups

- **Bubble data is a client seed** (`data/onboarding-seed.ts`) — swap to
  `GET /api/onboarding/bubbles` (already data-driven server-side) + related-food
  spawning on tap (§2.2).
- Physics bubbles (60fps spike), unit selection (kg/lb, cm/ft), "I used to be
  in shape" copy toggle, account-creation-on-first-sync, the real notification /
  HealthKit permission prompts (native modules).
- Onboarding writes to the server profile (`PATCH /api/profile`) once the app is
  server-wired.
