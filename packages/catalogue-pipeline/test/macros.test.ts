import { describe, it, expect } from 'vitest';
import { store, byId } from './_helpers';
import { validateRecipeDraft } from '../src/schema';
import { resolveIngredient, type Resolution } from '../src/fdc/resolve';
import { computeMacros } from '../src/macros';
import type { RecipeDraft } from '../src/schema';

function resolutionsFor(draft: RecipeDraft): Map<string, Resolution> {
  const m = new Map<string, Resolution>();
  for (const ing of draft.ingredients) {
    m.set(ing.name, resolveIngredient(ing.name, ing.fdcId, store, byId));
  }
  return m;
}

describe('macro computation', () => {
  it('is exactly Σ qty_g × per-100g / 100 (deterministic)', () => {
    const draft = validateRecipeDraft({
      id: 't',
      name: 'Banana + honey',
      cuisine: 'test',
      slotAffinity: ['snack'],
      effort: '5min',
      servings: 1,
      steps: ['Mix together.'],
      ingredients: [
        { name: 'banana', qty_g: 100, fdcId: 173944 },
        { name: 'honey', qty_g: 50, fdcId: 169640 },
      ],
    }).data!;

    const macros = computeMacros(draft, resolutionsFor(draft), byId);
    const banana = byId.get(173944)!;
    const honey = byId.get(169640)!;

    const expectedKcal = banana.per100g.kcal * 1.0 + honey.per100g.kcal * 0.5;
    const expectedFat = banana.per100g.fat_g * 1.0 + honey.per100g.fat_g * 0.5;
    expect(macros.total.kcal).toBeCloseTo(expectedKcal, 6);
    expect(macros.total.fat_g).toBeCloseTo(expectedFat, 6);
    expect(macros.unresolved).toEqual([]);
  });

  it('divides total by servings for per-serving', () => {
    const draft = validateRecipeDraft({
      id: 't2',
      name: 'Shared rice',
      cuisine: 'test',
      slotAffinity: ['dinner'],
      effort: '15min',
      servings: 2,
      steps: ['Cook and split.'],
      ingredients: [{ name: 'white rice, cooked', qty_g: 300, fdcId: 168878 }],
    }).data!;
    const macros = computeMacros(draft, resolutionsFor(draft), byId);
    expect(macros.perServing.kcal).toBeCloseTo(macros.total.kcal / 2, 6);
  });

  it('applies a yield factor to the mass', () => {
    const draft = validateRecipeDraft({
      id: 't3',
      name: 'Yield check',
      cuisine: 'test',
      slotAffinity: ['snack'],
      effort: '5min',
      servings: 1,
      steps: ['Weigh it.'],
      ingredients: [{ name: 'white rice, cooked', qty_g: 100, fdcId: 168878, yieldFactor: 2 }],
    }).data!;
    const macros = computeMacros(draft, resolutionsFor(draft), byId);
    const rice = byId.get(168878)!;
    expect(macros.total.kcal).toBeCloseTo(rice.per100g.kcal * 2, 6); // 100g × yield 2 = 200g
  });
});
