import { describe, it, expect } from 'vitest';
import { validateRecipeDraft } from '../src/schema';

const valid = {
  id: 'r1',
  name: 'Test bowl',
  cuisine: 'test',
  slotAffinity: ['lunch'],
  effort: '15min',
  servings: 1,
  steps: ['Cook the thing.', 'Serve it.'],
  ingredients: [{ name: 'white rice, cooked', qty_g: 150 }],
};

describe('recipe schema', () => {
  it('accepts a well-formed recipe and applies defaults', () => {
    const r = validateRecipeDraft(valid);
    expect(r.ok).toBe(true);
    expect(r.data?.methodTags).toEqual([]); // default
  });

  it('rejects an authored macro field (macros are computed, never authored)', () => {
    const r = validateRecipeDraft({ ...valid, kcal: 500 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/unrecognized|kcal/i);
  });

  it('rejects a 7th step (≤6 steps rule)', () => {
    const r = validateRecipeDraft({
      ...valid,
      steps: ['a b c', 'd e f', 'g h i', 'j k l', 'm n o', 'p q r', 's t u'],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an ingredient without a quantity', () => {
    const r = validateRecipeDraft({ ...valid, ingredients: [{ name: 'rice' }] });
    expect(r.ok).toBe(false);
  });

  it('rejects a non-positive quantity', () => {
    const r = validateRecipeDraft({ ...valid, ingredients: [{ name: 'rice', qty_g: 0 }] });
    expect(r.ok).toBe(false);
  });
});
