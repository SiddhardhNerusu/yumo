import { describe, it, expect } from 'vitest';
import { store, byId } from './_helpers';
import { resolveIngredient, tokenize } from '../src/fdc/resolve';

describe('ingredient resolver', () => {
  it('singularizes for matching (banana → Bananas)', () => {
    expect(tokenize('bananas, raw')).toEqual(tokenize('banana raw'));
  });

  it('prefers the food itself over a composite that merely contains it', () => {
    const r = resolveIngredient('olive oil', undefined, store, byId);
    const food = r.fdcId != null ? byId.get(r.fdcId) : null;
    // Should be an oil (~fat only), not mayonnaise/dressing.
    expect(food?.per100g.fat_g ?? 0).toBeGreaterThan(80);
    expect(food?.description.toLowerCase()).not.toMatch(/mayonnaise|dressing|sausage/);
  });

  it('resolves a plain whole food with high confidence', () => {
    const r = resolveIngredient('banana, raw', undefined, store, byId);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(byId.get(r.fdcId as number)?.description.toLowerCase()).toMatch(/banana/);
  });

  it('honours a valid pin deterministically', () => {
    const r = resolveIngredient('anything at all', 168878, store, byId);
    expect(r.method).toBe('pinned');
    expect(r.fdcId).toBe(168878);
    expect(r.confidence).toBe(1);
    expect(r.needsReview).toBe(false);
  });

  it('flags an invalid pin for review instead of trusting it', () => {
    const r = resolveIngredient('white rice, cooked', 999999999, store, byId);
    expect(r.needsReview).toBe(true);
  });
});
