import type { MenuRecipe } from '@yumo/menu';
import { tokenMatch } from './kitchen-model';

/**
 * §7 cookability — how much of a recipe you can make right now. Re-rank, never
 * restrict (principle 2). Staples are assumed present (principle 3).
 */
export type CookTier = 'now' | 'oneShort' | 'shop';

export interface Cookability {
  tier: CookTier;
  have: number;
  total: number;
  /** ingredient tokens you're missing (excludes staples). */
  missing: string[];
}

/** Assumed always-on-hand (principle 3) — a recipe is never blocked over these.
 * Whole-token names (matched on the head noun) so "red bell pepper" or "sesame
 * oil" is NOT silently treated as a staple. */
const STAPLES = new Set([
  'salt', 'pepper', 'black pepper', 'white pepper', 'oil', 'olive oil', 'vegetable oil',
  'sunflower oil', 'cooking oil', 'butter', 'water', 'flour', 'plain flour', 'sugar',
  'stock', 'stock cube', 'spices', 'seasoning',
]);

const isStaple = (token: string) => STAPLES.has(token.split(',')[0]!.trim());

/** Whole-word match: pantry "chicken" satisfies recipe "chicken breast", but
 * "egg" does NOT satisfy "eggplant". */
function satisfied(recipeToken: string, have: Set<string>): boolean {
  if (have.has(recipeToken)) return true;
  for (const h of have) if (tokenMatch(recipeToken, h)) return true;
  return false;
}

export function cookability(recipe: MenuRecipe, haveTokens: Set<string>): Cookability {
  const tokens = recipe.foodTokens.map((t) => t.toLowerCase());
  const missing: string[] = [];
  let have = 0;
  for (const t of tokens) {
    if (isStaple(t) || satisfied(t, haveTokens)) have++;
    else missing.push(t);
  }
  const tier: CookTier = missing.length === 0 ? 'now' : missing.length <= 2 ? 'oneShort' : 'shop';
  return { tier, have, total: tokens.length, missing };
}

/** §6 shopping list = what the given recipes need that isn't in stock, deduped. */
export function shoppingGaps(recipes: MenuRecipe[], haveTokens: Set<string>): string[] {
  const gaps = new Set<string>();
  for (const r of recipes) {
    for (const t of cookability(r, haveTokens).missing) gaps.add(t);
  }
  return [...gaps];
}

export const TIER_LABEL: Record<CookTier, string> = { now: 'All in', oneShort: 'Almost', shop: 'To buy' };
