import { describe, it, expect } from 'vitest';
import type { MenuRecipe } from '@yumo/menu';
import { buildWeeklyShop, weeklyShopCount } from '../src/data/weeklyShop';
import type { ShopPick } from '../src/data/shopping';
import type { ShopItem } from '../src/data/shoppingList';

const recipe = (id: string, foodTokens: string[]): MenuRecipe => ({
  id, name: id, cuisine: 'x', slotAffinity: ['dinner'] as MenuRecipe['slotAffinity'], effort: '15min',
  perServing: { kcal: 400, protein_g: 20, carbs_g: 0, fat_g: 0 }, allergens: [], foodTokens,
});
const flag = (token: string, label: string): ShopItem => ({ token, label, addedAt: 0 });
const all = (groups: ReturnType<typeof buildWeeklyShop>) => groups.flatMap((g) => g.items);

// salmon is a clearly non-staple token → it surfaces as a menu gap when not in stock.
const PICKS: ShopPick[] = [{ recipe: recipe('r1', ['salmon']), portionScale: 1 }];

describe('buildWeeklyShop', () => {
  it('adds a self-flagged item the menu did not cover, marked flagged', () => {
    const groups = buildWeeklyShop([flag('butter', 'Butter')], PICKS, new Set());
    const butter = all(groups).find((l) => l.token === 'butter');
    expect(butter).toBeDefined();
    expect(butter!.flagged).toBe(true);
    expect(butter!.qty).toBe(''); // flagged rows carry no quantity
  });

  it('surfaces the menu gap and marks it NOT flagged', () => {
    const groups = buildWeeklyShop([], PICKS, new Set());
    const salmon = all(groups).find((l) => l.token === 'salmon');
    expect(salmon).toBeDefined();
    expect(salmon!.flagged).toBeFalsy();
    expect(salmon!.meal).toBe('r1'); // menu rows keep the meal that needs them
  });

  it('dedupes a token that is both flagged AND menu-needed — once, menu row wins', () => {
    const groups = buildWeeklyShop([flag('salmon', 'Salmon')], PICKS, new Set());
    const salmons = all(groups).filter((l) => l.token === 'salmon');
    expect(salmons).toHaveLength(1);
    expect(salmons[0]!.flagged).toBeFalsy(); // kept the menu row, not the flagged one
    expect(salmons[0]!.meal).toBe('r1');
  });

  it('drops a flagged item you already have in stock', () => {
    const groups = buildWeeklyShop([flag('butter', 'Butter')], PICKS, new Set(['butter']));
    expect(all(groups).find((l) => l.token === 'butter')).toBeUndefined();
  });

  it('alphabetizes within an aisle', () => {
    const groups = buildWeeklyShop([flag('avocado', 'Avocado'), flag('apple', 'Apple')], [], new Set());
    const produce = groups.find((g) => g.aisle === 'produce');
    expect(produce).toBeDefined();
    const labels = produce!.items.map((i) => i.label);
    expect(labels).toEqual(['Apple', 'Avocado']); // sorted despite reverse input order
  });

  it('orders aisle GROUPS by AISLE_ORDER regardless of input order', () => {
    // butter=dairy, apple=produce — flagged dairy-first, but produce precedes dairy.
    const groups = buildWeeklyShop([flag('butter', 'Butter'), flag('apple', 'Apple')], [], new Set());
    expect(groups.map((g) => g.aisle)).toEqual(['produce', 'dairy']);
  });

  it('weeklyShopCount totals every line', () => {
    const groups = buildWeeklyShop([flag('butter', 'Butter'), flag('apple', 'Apple')], PICKS, new Set());
    expect(weeklyShopCount(groups)).toBe(all(groups).length);
    expect(weeklyShopCount(groups)).toBeGreaterThanOrEqual(3); // salmon + butter + apple
  });

  it('empty everything → empty list', () => {
    expect(buildWeeklyShop([], [], new Set())).toEqual([]);
    expect(weeklyShopCount([])).toBe(0);
  });
});
