import type { MenuRecipe } from '@yumo/menu';
import { tokenMatch, type KitchenItem } from './kitchen-model';

/**
 * §8 money — cooking from the kitchen is cheaper than eating out. Honest and
 * fuzzy: prices come from receipts (some items won't have one), a bought item
 * feeds several meals, and the baseline is labelled "vs eating out".
 */
export const MEAL_OUT_BASELINE = 10; // £ — a typical meal out / takeaway (configurable §15.4)
export const TYPICAL_MEAL_COST = 2.5; // £ — fallback per-serving cost when we can't price it
const MEALS_PER_ITEM = 4; // a bought item stretches across ~this many meals

/** Rough per-serving cost from the priced in-stock items a recipe draws on, or
 * null when we don't have prices for any of them (money stays hidden, not faked). */
export function mealCost(recipe: MenuRecipe, items: KitchenItem[]): number | null {
  const toks = recipe.foodTokens.map((t) => t.toLowerCase());
  let cost = 0;
  let matched = 0;
  for (const t of toks) {
    const it = items.find((i) => i.level !== 'out' && i.price != null && tokenMatch(t, i.token));
    if (it && it.price != null) { cost += it.price / MEALS_PER_ITEM; matched += 1; }
  }
  return matched ? cost : null;
}

/** What cooking this instead of eating out saves (never negative). */
export function mealSaving(recipe: MenuRecipe, items: KitchenItem[]): number | null {
  const c = mealCost(recipe, items);
  return c == null ? null : Math.max(0, MEAL_OUT_BASELINE - c);
}

/** £ formatter — "£1.85", "£12" (drops the .00). */
export function gbp(n: number): string {
  return `£${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}
