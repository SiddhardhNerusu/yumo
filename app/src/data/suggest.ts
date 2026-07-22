import type { MenuRecipe } from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';

/**
 * ONE smart slot ranking — no user-facing source picker (§Today-revamp §0). Every
 * meal suggestion is, in priority order: (1) within the remaining budget, (2)
 * makeable from the kitchen, (3) the best "for you" score. Over-budget and
 * shop-only dishes rank LAST but are NEVER dropped — the card surfaces the gap as
 * "{n} to buy". Pure list logic — scoring / cookability / allow / Cur-builder are
 * INJECTED so this stays RN-free and unit-testable. Recipes only; the user's own
 * quick-log foods live in the "usual" card and the Add sheet.
 */
export type CookTier = 'now' | 'oneShort' | 'shop';
export interface SuggestCur { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number }

export interface SmartCtx {
  slot: MealSlot;
  /** today's engine pick for this slot — carries the SCALED Cur (portionScale != 1). */
  planned: SuggestCur | null;
  pool: MenuRecipe[];
  /** kcal left in today's budget — over-budget dishes sink but are never hidden. */
  remaining: number;
  /** Shuffle cursor — each Shuffle advances it by 3, wrapping. */
  offset: number;
  allowed: (r: MenuRecipe) => boolean; // isAllowed(profile) AND slot-affine
  score: (r: MenuRecipe) => number; // higher = better ("for you")
  cookTier: (r: MenuRecipe) => CookTier;
  curFor: (r: MenuRecipe) => SuggestCur;
}

const TIER_RANK: Record<CookTier, number> = { now: 0, oneShort: 1, shop: 2 };

/** Up to 3 smart suggestions for the slot, rotated by the Shuffle offset. */
export function smartSuggest(ctx: SmartCtx): SuggestCur[] {
  const kcalOf = (r: MenuRecipe) => (ctx.planned && r.id === ctx.planned.recipe.id ? ctx.planned.kcal : r.perServing.kcal);
  // score + tier computed ONCE per recipe (O(n)), then a numeric sort (no scoring in the comparator).
  const ranked = ctx.pool
    .filter(ctx.allowed)
    .map((r) => ({ r, over: kcalOf(r) > ctx.remaining ? 1 : 0, tier: TIER_RANK[ctx.cookTier(r)], score: ctx.score(r) }))
    .sort((a, b) => a.over - b.over || a.tier - b.tier || b.score - a.score);
  if (!ranked.length) return [];
  const start = ((ctx.offset % ranked.length) + ranked.length) % ranked.length;
  const rotated = [...ranked.slice(start), ...ranked.slice(0, start)];
  // The planned pick already carries the menu engine's SCALED Cur (portionScale != 1);
  // reuse it so it shows/logs the same kcal/macros as every other view. All other
  // pool recipes are built at their authored serving via curFor.
  return rotated.slice(0, 3).map(({ r }) => (ctx.planned && r.id === ctx.planned.recipe.id ? ctx.planned : ctx.curFor(r)));
}

/**
 * How many recipes the engine can rank for this slot (slot-affine AND allowed).
 * Shuffle only makes sense when this exceeds the 3 rows shown — at ≤3 the rows
 * already surface everything, so the caller hides the Shuffle affordance.
 */
export function suggestableCount(ctx: SmartCtx): number {
  return ctx.pool.filter(ctx.allowed).length;
}
