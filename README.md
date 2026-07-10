# Usual (working name)

Prediction-first calorie tracker. Separate product from Goyo.

> **Working name only.** The brand is the last open item in the master plan
> (§14.1). `usual` is a placeholder used for folders/package names; rename in
> one pass once the brand is chosen.

## What's the edge

Two moats (see `calorie_app_master_plan.md`):

1. **The Brain** — a per-user, on-device habit model → proactive one-tap
   logging ("the usual?" from the lock screen). Compounds per user.
2. **The Catalogue + "Mix it up"** — our own food graph + recipes with
   **deterministically computed** macros (never AI-guessed) + isocaloric swaps.

## Repo layout

```
packages/
  tokens/              @yumo/tokens   — stack-agnostic design tokens (JSON SoT + TS accessor)
  shared/              @yumo/shared   — cross-cutting types (nutrition, ids, allergens)
  catalogue-pipeline/  @yumo/catalogue-pipeline — offline recipe authoring/validation
                       pipeline (§4.5). Deterministic FDC macro computation.
```

The **client app** (React Native or Flutter) and the **server** are added as
their own workspaces once the Phase-0 spikes lock the stack.

## Nutrient data

Macros are computed from **USDA FoodData Central** (public domain / CC0),
hosted locally as a normalized store. The raw bulk JSON (~217 MB) is
git-ignored; regenerate with:

```
npm run fetch:fdc     # download + normalize FDC → data/fdc-cache/foods.json
```

## Common commands

```
npm install
npm run typecheck     # tsc across all packages (strict)
npm test              # vitest across all packages
npm run spike         # run the recipe pipeline over data/recipes-draft + report
```

## Non-negotiables (owner hard rules)

- No hardcoded food/recipe lists in **code** — all catalogue content is
  versioned **data** (JSON/DB), never inline constants.
- Macros are **computed**, never authored or AI-guessed.
- No runtime AI generation of user-facing catalogue content.
- Design tokens only — no ad-hoc styling. WCAG AA on all text (enforced by a
  token test).
- Build stays green. Sid commits; Claude does not.
