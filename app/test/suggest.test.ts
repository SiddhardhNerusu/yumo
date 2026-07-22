import { describe, it, expect } from 'vitest';
import { smartSuggest, type SmartCtx, type SuggestCur, type CookTier } from '../src/data/suggest';
import type { MenuRecipe } from '@yumo/menu';

const recipe = (id: string, kcal: number, slots: string[] = ['lunch']): MenuRecipe => ({
  id, name: id, cuisine: 'x', slotAffinity: slots as MenuRecipe['slotAffinity'], effort: '15min',
  perServing: { kcal, protein_g: Math.round(kcal / 20), carbs_g: 0, fat_g: 0 }, allergens: [], foodTokens: [id],
});
const curOf = (r: MenuRecipe): SuggestCur => ({ recipe: r, kcal: r.perServing.kcal, protein: 0, carbs: 0, fat: 0, portionScale: 1 });

const POOL = [recipe('a', 700), recipe('b', 500), recipe('c', 300), recipe('d', 900), recipe('bfast', 400, ['breakfast'])];

const ctx = (over: Partial<SmartCtx> = {}): SmartCtx => ({
  slot: 'lunch', planned: null, pool: POOL, remaining: 2000, offset: 0,
  allowed: (r) => r.slotAffinity.includes('lunch'),
  score: (r) => r.perServing.protein_g, // protein-forward
  cookTier: () => 'shop',
  curFor: curOf,
  ...over,
});
const ids = (out: SuggestCur[]) => out.map((s) => s.recipe.id);

describe('smartSuggest', () => {
  it('returns at most 3, recipes only, slot-affine', () => {
    const out = smartSuggest(ctx());
    expect(out.length).toBe(3);
    expect(out.every((s) => s.recipe.slotAffinity.includes('lunch'))).toBe(true);
    expect(ids(out)).not.toContain('bfast');
  });

  it('within-budget dishes rank BEFORE over-budget ones (but over-budget is never dropped)', () => {
    // remaining 550: a(700)/d(900) are over; b(500)/c(300) fit. tie-break by protein score (b>c).
    const out = smartSuggest(ctx({ remaining: 550 }));
    expect(ids(out).slice(0, 2)).toEqual(['b', 'c']); // both in-budget first (b protein>c)
    // 3rd slot = the best over-budget dish by score: d(900→45) beats a(700→35)
    expect(ids(out)[2]).toBe('d');
    // 'a' still exists in the ranking (never hidden) — just pushed past the top 3
    const all = smartSuggest(ctx({ remaining: 550, offset: 3 }));
    expect(ids(all)).toContain('a');
  });

  it('kitchen: cookable-now ranks first, shop-only LAST but never dropped', () => {
    const cookTier = (r: MenuRecipe): CookTier => (r.id === 'c' ? 'now' : r.id === 'b' ? 'oneShort' : 'shop');
    const out = smartSuggest(ctx({ cookTier }));
    expect(ids(out).slice(0, 2)).toEqual(['c', 'b']); // now, then oneShort
    // a and d are shop-tier — present in the full ranking, not filtered out
    const rest = smartSuggest(ctx({ cookTier, offset: 3 }));
    expect([...ids(out), ...ids(rest)]).toEqual(expect.arrayContaining(['a', 'd']));
  });

  it('budget-fit OUTRANKS kitchen-tier (priority 1 beats priority 2)', () => {
    // remaining 550: b(500)/c(300) fit budget; a(700)/d(900) are over.
    // Make the keys DISAGREE — the over-budget a is cookable-now, the fits-budget b/c are shop.
    const cookTier = (r: MenuRecipe): CookTier => (r.id === 'a' ? 'now' : 'shop');
    const out = smartSuggest(ctx({ remaining: 550, cookTier }));
    // `over` dominates `tier`: the fits-budget shop dishes rank ahead of the cookable-now over-budget one.
    expect(ids(out)).toEqual(['b', 'c', 'a']);
    expect(ids(out)[0]).not.toBe('a'); // a swap to tier-first would surface 'a' here — guard against it
  });

  it('surfaces the planned pick with its SCALED Cur, not rebuilt at raw serving', () => {
    const scaledPlanned: SuggestCur = { recipe: recipe('b', 500), kcal: 750, protein: 40, carbs: 0, fat: 0, portionScale: 1.5 };
    const out = smartSuggest(ctx({ planned: scaledPlanned }));
    const b = out.find((s) => s.recipe.id === 'b');
    expect(b).toBeDefined();
    expect(b!.kcal).toBe(750); // scaled, NOT curFor's raw 500
    expect(b!.portionScale).toBe(1.5);
  });

  it('cold start (empty budget/kitchen signals) still fills 3 from the pool', () => {
    const out = smartSuggest(ctx());
    expect(out.length).toBe(3);
  });

  it('Shuffle offset rotates the list and wraps at the pool count', () => {
    const base = smartSuggest(ctx({ offset: 0 }));
    const shuffled = smartSuggest(ctx({ offset: 3 }));
    expect(ids(base)).not.toEqual(ids(shuffled));
    const lunchCount = POOL.filter((r) => r.slotAffinity.includes('lunch')).length; // 4
    expect(ids(smartSuggest(ctx({ offset: lunchCount })))).toEqual(ids(base)); // full wrap == offset 0
  });
});
