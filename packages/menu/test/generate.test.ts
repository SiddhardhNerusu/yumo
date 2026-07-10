import { describe, it, expect } from 'vitest';
import { generateWeekMenu } from '../src/generate';
import type { WeekMenuPlan } from '../src/types';
import { POOL, baseProfile } from './_pool';

const allRecipes = (plan: WeekMenuPlan) => plan.days.flatMap((d) => d.picks.map((p) => p.recipe));
const serialize = (plan: WeekMenuPlan) =>
  plan.days.map((d) => d.picks.map((p) => p.recipe.id).join(',')).join('|');

describe('menu generation — hard constraints', () => {
  it('never suggests a recipe carrying a user allergen', () => {
    const plan = generateWeekMenu(POOL, { ...baseProfile, allergies: ['fish'] }, { seed: 's' });
    expect(allRecipes(plan).some((r) => r.allergens.includes('fish'))).toBe(false);
  });

  it('never suggests a hated ingredient', () => {
    const plan = generateWeekMenu(POOL, { ...baseProfile, hates: ['beef'] }, { seed: 's' });
    expect(allRecipes(plan).some((r) => r.foodTokens.some((t) => t.includes('beef')))).toBe(false);
  });

  it('pins each need at least once per day', () => {
    const plan = generateWeekMenu(POOL, { ...baseProfile, needs: ['chicken'] }, { seed: 's' });
    for (const day of plan.days) {
      const hasChicken = day.picks.some((p) => p.recipe.foodTokens.some((t) => t.includes('chicken')));
      expect(hasChicken, `day ${day.dayOfWeek + 1}`).toBe(true);
    }
  });
});

describe('menu generation — envelopes, budget, effort', () => {
  it('keeps each day within ±5% of the budget', () => {
    const plan = generateWeekMenu(POOL, baseProfile, { seed: 's' });
    for (const day of plan.days) {
      const off = Math.abs(day.totalKcal - baseProfile.budgetKcal) / baseProfile.budgetKcal;
      expect(off, `day ${day.dayOfWeek + 1} = ${Math.round(day.totalKcal)}kcal`).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it('fills all four slots each day', () => {
    const plan = generateWeekMenu(POOL, baseProfile, { seed: 's' });
    for (const day of plan.days) expect(day.picks.length).toBe(4);
  });

  it('caps 30min+ dinners at 2 per week', () => {
    const plan = generateWeekMenu(POOL, baseProfile, { seed: 's', days: 7 });
    const hard = plan.days
      .flatMap((d) => d.picks)
      .filter((p) => p.slot === 'dinner' && p.recipe.effort === '30min+').length;
    expect(hard).toBeLessThanOrEqual(2);
  });

  it('never repeats a recipe within one day', () => {
    const plan = generateWeekMenu(POOL, baseProfile, { seed: 's' });
    for (const day of plan.days) {
      const ids = day.picks.map((p) => p.recipe.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('menu generation — determinism', () => {
  it('same seed → identical menu', () => {
    const a = generateWeekMenu(POOL, baseProfile, { seed: 'abc' });
    const b = generateWeekMenu(POOL, baseProfile, { seed: 'abc' });
    expect(serialize(a)).toBe(serialize(b));
  });

  it('cuisine lean shifts the mix toward the leaned cuisine', () => {
    const neutral = generateWeekMenu(POOL, baseProfile, { seed: 'x' });
    const leaned = generateWeekMenu(
      POOL,
      { ...baseProfile, cuisineLean: { Indian: 3 } },
      { seed: 'x' },
    );
    const indianCount = (plan: WeekMenuPlan) =>
      plan.days.flatMap((d) => d.picks).filter((p) => p.recipe.cuisine === 'Indian').length;
    expect(indianCount(leaned)).toBeGreaterThanOrEqual(indianCount(neutral));
  });
});
