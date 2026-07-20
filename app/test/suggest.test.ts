import { describe, it, expect } from 'vitest';
import { suggestFor, budgetIsTight, type SuggestCtx, type SuggestCur, type SuggestTile } from '../src/data/suggest';
import type { MenuRecipe } from '@yumo/menu';

const recipe = (id: string, kcal: number, slots: string[] = ['lunch']): MenuRecipe => ({
  id, name: id, cuisine: 'x', slotAffinity: slots as MenuRecipe['slotAffinity'], effort: '15min',
  perServing: { kcal, protein_g: Math.round(kcal / 20), carbs_g: 0, fat_g: 0 }, allergens: [], foodTokens: [id],
});
const curOf = (r: MenuRecipe): SuggestCur => ({ recipe: r, kcal: r.perServing.kcal, protein: 0, carbs: 0, fat: 0, portionScale: 1 });
const tile = (foodId: string, kcal = 300): SuggestTile => ({ foodId, name: foodId, kcal, portionG: 100 });

const POOL = [recipe('a', 700), recipe('b', 500), recipe('c', 300), recipe('d', 900), recipe('bfast', 400, ['breakfast'])];

const ctx = (over: Partial<SuggestCtx> = {}): SuggestCtx => ({
  slot: 'lunch', tiles: [], planned: null, pool: POOL, remaining: 2000, offset: 0,
  allowed: (r) => r.slotAffinity.includes('lunch'),
  score: (r) => r.perServing.protein_g, // protein-forward
  cookTier: () => 'shop',
  curFor: curOf,
  ...over,
});

describe('suggestFor', () => {
  it('returns at most 3', () => {
    expect(suggestFor('foryou', ctx()).length).toBe(3);
    expect(suggestFor('budget', ctx()).length).toBe(3);
  });

  it('foryou leads with tiles, then planned, then pool; deduped', () => {
    const planned = curOf(recipe('b', 500));
    const out = suggestFor('foryou', ctx({ tiles: [tile('t1'), tile('t2')], planned }));
    expect(out[0]).toEqual({ kind: 'tile', tile: tile('t1') });
    expect(out[1]).toEqual({ kind: 'tile', tile: tile('t2') });
    expect(out[2]).toEqual({ kind: 'recipe', cur: planned });
  });

  it('foryou dedupes a planned recipe that also appears in the pool', () => {
    const planned = curOf(recipe('a', 700)); // 'a' is in POOL
    const out = suggestFor('foryou', ctx({ planned }));
    const recipeIds = out.filter((s) => s.kind === 'recipe').map((s) => (s.kind === 'recipe' ? s.cur.recipe.id : ''));
    expect(new Set(recipeIds).size).toBe(recipeIds.length); // no duplicate ids
  });

  it('cold start (no tiles, no plan) still fills from the pool', () => {
    const out = suggestFor('foryou', ctx());
    expect(out.length).toBe(3);
    expect(out.every((s) => s.kind === 'recipe')).toBe(true);
  });

  it('budget only offers picks that fit the remaining kcal', () => {
    const out = suggestFor('budget', ctx({ remaining: 550 }));
    const kcals = out.map((s) => (s.kind === 'recipe' ? s.cur.kcal : 0));
    expect(kcals.every((k) => k <= 550)).toBe(true); // 500 and 300 fit; 700/900 excluded
    expect(budgetIsTight(ctx({ remaining: 550 }))).toBe(false);
  });

  it('budget falls back to lightest picks when nothing fits (never empty), flagged tight', () => {
    const c = ctx({ remaining: 100 });
    const out = suggestFor('budget', c);
    expect(out.length).toBeGreaterThan(0);
    expect((out[0] as { cur: SuggestCur }).cur.kcal).toBe(300); // lightest lunch pick first
    expect(budgetIsTight(c)).toBe(true);
  });

  it('kitchen ranks cookable-now first and drops shop-only', () => {
    const cookTier = (r: MenuRecipe): 'now' | 'oneShort' | 'shop' => (r.id === 'a' ? 'now' : r.id === 'b' ? 'oneShort' : 'shop');
    const out = suggestFor('kitchen', ctx({ cookTier }));
    const ids = out.map((s) => (s.kind === 'recipe' ? s.cur.recipe.id : ''));
    expect(ids).toEqual(['a', 'b']); // only now + oneShort; c/d/bfast dropped (shop or wrong slot)
  });

  it('Mix offset rotates the list and wraps', () => {
    const base = suggestFor('budget', ctx({ offset: 0 }));
    const mixed = suggestFor('budget', ctx({ offset: 3 }));
    expect(base).not.toEqual(mixed);
    const full = ctx().pool.filter((r) => r.slotAffinity.includes('lunch')).length; // 4 lunch recipes
    const wrapped = suggestFor('budget', ctx({ offset: full }));
    expect(wrapped).toEqual(suggestFor('budget', ctx({ offset: 0 }))); // full wrap == offset 0
  });
});
