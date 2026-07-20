import type { MenuRecipe } from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';

/**
 * Slot suggestion selection (§R2). Replaces the fixed "quick log + on the menu"
 * block with three interchangeable sources the user picks between, plus a Mix
 * re-roll. Pure list logic — all scoring/cookability/allow predicates and the
 * recipe→Cur builder are INJECTED, so this stays RN-free and unit-testable.
 */
export type SuggestSource = 'foryou' | 'budget' | 'kitchen';
export type CookTier = 'now' | 'oneShort' | 'shop';

export interface SuggestTile { foodId: string; name: string; kcal: number; portionG: number }
export interface SuggestCur { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number }
export type Suggestion = { kind: 'tile'; tile: SuggestTile } | { kind: 'recipe'; cur: SuggestCur };

export interface SuggestCtx {
  slot: MealSlot;
  /** the Brain's quick-log tiles (the user's own foods) — only for the current slot. */
  tiles: SuggestTile[];
  /** today's planned pick for this slot (the menu engine's choice). */
  planned: SuggestCur | null;
  pool: MenuRecipe[];
  /** kcal left in today's budget (for the "In budget" source). */
  remaining: number;
  /** re-roll cursor — Mix advances it by 3, wrapping. */
  offset: number;
  allowed: (r: MenuRecipe) => boolean; // isAllowed(profile) AND slot-affine
  score: (r: MenuRecipe) => number; // higher = better
  cookTier: (r: MenuRecipe) => CookTier;
  curFor: (r: MenuRecipe) => SuggestCur;
}

type Raw = { kind: 'tile'; tile: SuggestTile } | { kind: 'recipe'; recipe: MenuRecipe };

const TIER_RANK: Record<CookTier, number> = { now: 0, oneShort: 1, shop: 2 };

/** The full ranked candidate list for a source (raw — Curs are built later, only
 * for the ≤3 that survive, so we never scale the whole pool). */
function rankedRaw(source: SuggestSource, ctx: SuggestCtx): Raw[] {
  const pool = ctx.pool.filter(ctx.allowed);
  if (source === 'foryou') {
    const seen = new Set<string>();
    const out: Raw[] = [];
    for (const t of ctx.tiles) if (!seen.has(t.foodId)) { seen.add(t.foodId); out.push({ kind: 'tile', tile: t }); }
    if (ctx.planned && !seen.has(ctx.planned.recipe.id)) { seen.add(ctx.planned.recipe.id); out.push({ kind: 'recipe', recipe: ctx.planned.recipe }); }
    for (const r of [...pool].sort((a, b) => ctx.score(b) - ctx.score(a))) if (!seen.has(r.id)) { seen.add(r.id); out.push({ kind: 'recipe', recipe: r }); }
    return out;
  }
  if (source === 'budget') {
    const fits = pool.filter((r) => r.perServing.kcal <= ctx.remaining).sort((a, b) => b.perServing.kcal - a.perServing.kcal);
    // nothing fits → the lightest picks (never punitive — the caller adds a calm note)
    const base = fits.length ? fits : [...pool].sort((a, b) => a.perServing.kcal - b.perServing.kcal);
    return base.map((r) => ({ kind: 'recipe', recipe: r }));
  }
  // kitchen: cookable-now first, then near-miss; drop shop-only
  const cookable = pool.filter((r) => ctx.cookTier(r) !== 'shop').sort((a, b) => (TIER_RANK[ctx.cookTier(a)] - TIER_RANK[ctx.cookTier(b)]) || (ctx.score(b) - ctx.score(a)));
  return cookable.map((r) => ({ kind: 'recipe', recipe: r }));
}

/** Up to 3 suggestions for the source, rotated by the Mix offset. */
export function suggestFor(source: SuggestSource, ctx: SuggestCtx): Suggestion[] {
  const list = rankedRaw(source, ctx);
  if (list.length === 0) return [];
  const start = ((ctx.offset % list.length) + list.length) % list.length;
  const rotated = [...list.slice(start), ...list.slice(0, start)];
  return rotated.slice(0, 3).map((rc) => (rc.kind === 'tile' ? { kind: 'tile', tile: rc.tile } : { kind: 'recipe', cur: ctx.curFor(rc.recipe) }));
}

/** true when the "In budget" source had to fall back to lightest picks (nothing
 * actually fit) — the block shows a calm "lighter picks" note. */
export function budgetIsTight(ctx: SuggestCtx): boolean {
  return !ctx.pool.some((r) => ctx.allowed(r) && r.perServing.kcal <= ctx.remaining);
}
