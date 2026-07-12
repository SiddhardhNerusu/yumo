import type { VariationDial } from './types';

/** §4.3 protein floor. */
export const PROTEIN_FLOOR_PER_KG = 1.6;

/** §4.3 day total must land within ±5% of budget. */
export const DAY_BUDGET_TOLERANCE = 0.05;

/** Novelty weight per variation dial (§2.1: 0.2 / 0.5 / 0.8). Higher → stronger
 * penalty on recently-used recipes → more variety. */
export const NOVELTY_WEIGHT: Record<VariationDial, number> = {
  habit: 0.2,
  balanced: 0.5,
  mixup: 0.8,
};

/** ≤2 "30min+" dinners per week (§4.3 effort mix). */
export const MAX_HARD_DINNERS_PER_WEEK = 2;

/** Clamp portion scaling so a recipe is never stretched absurdly to hit a slot. */
export const PORTION_SCALE_RANGE: readonly [number, number] = [0.6, 1.6];

/** Soft-score term weights. */
export const SOFT_WEIGHTS = {
  likes: 0.5,
  pantry: 0.3,
  closeness: 0.7, // how near the recipe's natural kcal is to the slot target
  protein: 0.25,
  preference: 0.6, // §4.3.3 re-weight toward recipes the user swapped/picked before
};

/** §4.4 Mix it up. */
export const MIXUP = {
  kcalTolerance: 0.1, // ±10%
  proteinTolerance: 0.15, // ±15%
  count: 4,
  effortMaxStepUp: 1, // effort ≤ original + 1 tier
} as const;
