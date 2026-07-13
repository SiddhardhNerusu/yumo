import { describe, it, expect } from 'vitest';
import { generateWeekMenu, resolveProteinTargetG } from '../src/generate';
import type { MenuRecipe, UserProfile } from '../src/types';
import type { MealSlot } from '@yumo/shared';

const rec = (id: string, kcal: number, protein: number, slots: MealSlot[]): MenuRecipe => ({
  id, name: id, cuisine: 'British', slotAffinity: slots, effort: '15min',
  perServing: { kcal, protein_g: protein, carbs_g: Math.round(kcal / 8), fat_g: Math.round(kcal / 30) },
  allergens: [], foodTokens: [id],
});

// a pool with both protein-dense and protein-light options in every slot
const POOL: MenuRecipe[] = [
  rec('b-hi', 350, 30, ['breakfast']), rec('b-lo', 350, 9, ['breakfast']),
  rec('l-hi', 560, 52, ['lunch']), rec('l-lo', 560, 16, ['lunch']),
  rec('d-hi', 620, 56, ['dinner']), rec('d-lo', 620, 18, ['dinner']),
  rec('s-hi', 200, 22, ['snack']), rec('s-lo', 200, 4, ['snack']),
];

const base: UserProfile = { budgetKcal: 2500, targetWeightKg: 80, allergies: [], hates: [], needs: [], likes: [], pantry: [], variation: 'balanced' };
const weekProtein = (p: ReturnType<typeof generateWeekMenu>) => p.days.reduce((s, d) => s + d.totalProtein_g, 0);
const avgDayProtein = (p: ReturnType<typeof generateWeekMenu>) => weekProtein(p) / p.days.length;

describe('macro targeting (§5)', () => {
  it('resolves the protein target: explicit goal wins, else 1.6 g/kg', () => {
    expect(resolveProteinTargetG({ ...base, proteinTargetG: 200 })).toBe(200);
    expect(resolveProteinTargetG(base)).toBe(Math.round(1.6 * 80)); // 128
  });

  it('a higher protein goal pulls the whole week toward more protein', () => {
    const low = generateWeekMenu(POOL, { ...base, proteinTargetG: 110 }, { seed: 's' });
    const high = generateWeekMenu(POOL, { ...base, proteinTargetG: 200 }, { seed: 's' });
    expect(weekProtein(high)).toBeGreaterThan(weekProtein(low));
  });

  it('lifts protein well above the default floor when the pool allows (~200g on 2500)', () => {
    const plan = generateWeekMenu(POOL, { ...base, proteinTargetG: 200 }, { seed: 'x' });
    // won't perfectly hit 200 from a tiny pool, but should clear the 128g default floor comfortably
    expect(avgDayProtein(plan)).toBeGreaterThanOrEqual(160);
  });

  it('keeps day kcal within the relaxed ceiling even while chasing protein', () => {
    const plan = generateWeekMenu(POOL, { ...base, proteinTargetG: 200 }, { seed: 'y' });
    for (const day of plan.days) {
      expect(day.totalKcal).toBeLessThanOrEqual(2500 * 1.08); // ≤ +7.5% relaxed cap (+rounding)
      expect(day.totalKcal).toBeGreaterThanOrEqual(2500 * 0.9);
    }
  });
});
