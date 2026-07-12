import type { MenuRecipe } from '@yumo/menu';
import { freshnessOf, tokenMatch, type KitchenItem } from './kitchen-model';

/**
 * §8 waste-saver — surface what's going off and cook it before it turns.
 * "Expiring" = in-stock items the computed freshness has moved off `fresh`
 * (use-soon or use-today), never gram counts or typed dates.
 */
export function expiringItems(items: KitchenItem[], now: number): KitchenItem[] {
  return items.filter((i) => i.level !== 'out' && freshnessOf(i, now) !== 'fresh' && freshnessOf(i, now) !== 'gone')
    // most-urgent first (use-today before use-soon)
    .sort((a, b) => a.freshUntil - b.freshUntil);
}

/** The expiring items a given recipe would use up (whole-word token match). */
export function expiringUsedBy(recipe: MenuRecipe, exp: KitchenItem[]): KitchenItem[] {
  const toks = recipe.foodTokens.map((t) => t.toLowerCase());
  return exp.filter((it) => toks.some((t) => tokenMatch(t, it.token)));
}

/** Recipe ids that would use something expiring — fed to the menu boost + Tonight rank. */
export function recipesUsingExpiring(recipes: MenuRecipe[], exp: KitchenItem[]): string[] {
  return recipes.filter((r) => expiringUsedBy(r, exp).length > 0).map((r) => r.id);
}
