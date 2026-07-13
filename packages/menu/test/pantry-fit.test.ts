import { describe, it, expect } from 'vitest';
import { generateWeekMenu } from '../src/generate';
import { softScore } from '../src/scoring';
import { pantryFitValue } from '../src/scoring';
import type { MenuRecipe, UserProfile, PantryFit } from '../src/types';

/** §7 near-miss as a first-class menu concept: pantry_fit scoring + annotation. */

const recipe = (id: string, tokens: string[]): MenuRecipe => ({
  id,
  name: id,
  cuisine: 'British',
  slotAffinity: ['breakfast', 'lunch', 'dinner', 'snack'],
  effort: '15min',
  perServing: { kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 15 },
  allergens: [],
  foodTokens: tokens,
});

const profile: UserProfile = {
  budgetKcal: 2000,
  targetWeightKg: 70,
  allergies: [],
  hates: [],
  needs: [],
  likes: [],
  pantry: [],
  variation: 'balanced',
};

describe('§5.7 pantry_fit value', () => {
  it('rewards ready > near-miss(1) > near-miss(2) > shop', () => {
    expect(pantryFitValue('ready', 0)).toBe(1.0);
    expect(pantryFitValue('near_miss', 1)).toBe(0.6);
    expect(pantryFitValue('near_miss', 2)).toBe(0.35);
    expect(pantryFitValue('shop', 5)).toBe(0);
  });
});

describe('§7 near-miss scoring + annotation', () => {
  const ctx = { slotTargetKcal: 500, recentlyUsed: new Set<string>(), proteinPaceDeficit: 0 };

  it('scores a ready recipe above the same recipe as a shop', () => {
    const r = recipe('r', ['eggs', 'bread']);
    const ready: PantryFit = () => ({ state: 'ready', missing: [] });
    const shop: PantryFit = () => ({ state: 'shop', missing: ['eggs', 'bread'] });
    const sReady = softScore(r, 'breakfast', profile, { ...ctx, pantryFit: ready }).score;
    const sShop = softScore(r, 'breakfast', profile, { ...ctx, pantryFit: shop }).score;
    expect(sReady).toBeGreaterThan(sShop);
  });

  it('annotates each pick with pantryState + missing when a matcher is given', () => {
    const pool = [recipe('a', ['chicken', 'rice']), recipe('b', ['tofu', 'noodles']), recipe('c', ['oats'])];
    const pantryFit: PantryFit = (rec) =>
      rec.foodTokens.includes('chicken') ? { state: 'ready', missing: [] } : { state: 'near_miss', missing: ['x'] };
    const plan = generateWeekMenu(pool, profile, { seed: 'pf', days: 2, pantryFit });
    const picks = plan.days.flatMap((d) => d.picks);
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect(p.pantryState).toBeDefined();
      expect(Array.isArray(p.missing)).toBe(true);
    }
  });

  it('leaves picks unannotated when no matcher is given (server/plain path)', () => {
    const pool = [recipe('a', ['chicken', 'rice'])];
    const plan = generateWeekMenu(pool, profile, { seed: 'pf', days: 1 });
    for (const p of plan.days.flatMap((d) => d.picks)) expect(p.pantryState).toBeUndefined();
  });
});
