/**
 * §8 money — cooking from the kitchen is cheaper than eating out. Honest and
 * fuzzy: the baseline is labelled "vs eating out". (Per-recipe pricing, mealCost/
 * mealSaving, was retired with the Kitchen's Tonight/money-recap surface.)
 */
export const MEAL_OUT_BASELINE = 10; // £ — a typical meal out / takeaway (configurable §15.4)
export const TYPICAL_MEAL_COST = 2.5; // £ — fallback per-serving cost when we can't price it

/** £ formatter — "£1.85", "£12" (drops the .00). */
export function gbp(n: number): string {
  return `£${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}
