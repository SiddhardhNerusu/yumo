/** The three macronutrients we track, in grams. */
export interface Macros {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Macros plus energy. */
export interface EnergyMacros extends Macros {
  kcal: number;
}

/** Per-100g nutrient profile (the shape a food-graph node / FDC row exposes). */
export interface NutrientProfilePer100g extends EnergyMacros {}

/** Meal slots. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Atwater energy factors (kcal per gram). General factors — protein/carb/fat
 * plus fiber (a carb subtype metabolized at ~2 kcal/g) and alcohol. Used only
 * as an independent cross-check against a food's measured energy, never as the
 * primary source (macros are computed from FDC, §1.5).
 */
export const ATWATER = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 2,
  alcohol: 7,
} as const;

/**
 * Atwater kcal from macros. `fiber_g`, if given, is treated as part of
 * `carbs_g` (carbohydrate-by-difference includes fiber) and re-priced at the
 * fiber factor, matching how FDC "carbohydrate, by difference" is reported.
 */
export function atwaterKcal(m: Macros, fiber_g = 0): number {
  const nonFiberCarbs = Math.max(0, m.carbs_g - fiber_g);
  return (
    m.protein_g * ATWATER.protein +
    nonFiberCarbs * ATWATER.carbs +
    fiber_g * ATWATER.fiber +
    m.fat_g * ATWATER.fat
  );
}

/** Zero-init energy+macros accumulator. */
export function zeroEnergyMacros(): EnergyMacros {
  return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

/** Add `b` into `a` (returns a new object). */
export function addEnergyMacros(a: EnergyMacros, b: EnergyMacros): EnergyMacros {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
  };
}

/** Round energy+macros for display / storage. kcal → int, macros → 1 dp. */
export function roundEnergyMacros(m: EnergyMacros): EnergyMacros {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(m.kcal),
    protein_g: r1(m.protein_g),
    carbs_g: r1(m.carbs_g),
    fat_g: r1(m.fat_g),
  };
}

/**
 * Default slot energy envelopes as a share of the daily budget (§4.3).
 * Config-with-defaults — the menu engine and outlier lint read these.
 */
export const SLOT_ENVELOPE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.325,
  dinner: 0.325,
  snack: 0.1,
};
