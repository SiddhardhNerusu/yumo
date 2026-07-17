import { describe, it, expect } from 'vitest';
import { macroTargets } from '../src/data/macros';
import type { UserProfile } from '@yumo/menu';

const base: UserProfile = {
  budgetKcal: 2000,
  targetWeightKg: 72,
  allergies: [],
  hates: [],
  needs: [],
  likes: [],
  pantry: [],
  variation: 'balanced',
};

describe('macroTargets', () => {
  it('derives from weight+budget when no explicit targets (1.6 g/kg, 30% fat, remainder carbs)', () => {
    // protein 1.6*72=115.2→115; fat 2000*0.3/9=66.7→67; carbs (2000-460-603)/4=234.25→234
    expect(macroTargets(base)).toEqual({ proteinG: 115, carbsG: 234, fatG: 67 });
  });

  it('honors an explicit protein target (the M4 bug: display used to ignore it)', () => {
    expect(macroTargets({ ...base, proteinTargetG: 150 }).proteinG).toBe(150);
    // carbs re-derive from the higher protein, fat unchanged
    expect(macroTargets({ ...base, proteinTargetG: 150 })).toEqual({ proteinG: 150, carbsG: 199, fatG: 67 });
  });

  it('honors explicit carb and fat targets', () => {
    const t = macroTargets({ ...base, carbTargetG: 300, fatTargetG: 55 });
    expect(t.carbsG).toBe(300);
    expect(t.fatG).toBe(55);
  });

  it('floors carbs at 1 when protein+fat already exceed the budget (never negative)', () => {
    // protein 300 (1200 kcal) + fat 200 (1800 kcal) on a 1400 budget → remainder negative
    expect(macroTargets({ ...base, budgetKcal: 1400, proteinTargetG: 300, fatTargetG: 200 }).carbsG).toBe(1);
  });
});
