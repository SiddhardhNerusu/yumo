import { describe, it, expect } from 'vitest';
import { config } from './_helpers';
import { screenHazards } from '../src/lints/whitelist';
import { checkFoodSafety } from '../src/lints/foodSafety';
import { checkOutlier } from '../src/lints/outlier';
import { extractAllergens } from '../src/lints/allergens';

describe('hazard / non-food gate', () => {
  it('flags a hazardous non-food ingredient', () => {
    const flags = screenHazards(['2 cups bleach', 'white rice, cooked'], config.hazardDenylist);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.token).toBe('bleach');
  });

  it('does not false-flag real foods', () => {
    const flags = screenHazards(
      ['chicken breast, cooked', 'olive oil', 'cheddar cheese'],
      config.hazardDenylist,
    );
    expect(flags).toHaveLength(0);
  });
});

describe('food-safety cook-step check', () => {
  it('flags raw high-risk protein with no cooking step', () => {
    const r = checkFoodSafety(['chicken breast'], ['Plate the chicken and serve.']);
    expect(r.flagged).toBe(true);
  });

  it('passes when a heat step is present', () => {
    const r = checkFoodSafety(['chicken breast'], ['Fry until cooked through and no longer pink.']);
    expect(r.flagged).toBe(false);
  });

  it('does not flag non-raw derivatives (stock/broth)', () => {
    const r = checkFoodSafety(['chicken stock'], ['Warm gently and serve.']);
    expect(r.flagged).toBe(false);
  });
});

describe('outlier lint', () => {
  it('flags a breakfast that is wildly over its envelope', () => {
    expect(checkOutlier(3000, ['breakfast']).flagged).toBe(true);
  });
  it('passes a plausible breakfast', () => {
    expect(checkOutlier(520, ['breakfast']).flagged).toBe(false);
  });
});

describe('allergen extraction', () => {
  it('extracts allergens from ingredient names', () => {
    const found = extractAllergens(
      ['peanut butter', 'greek yogurt', 'rolled oats'],
      config.allergenKeywords,
    );
    expect(found).toContain('peanuts');
    expect(found).toContain('milk');
    expect(found).toContain('gluten');
  });
  it('returns nothing for allergen-free foods', () => {
    const found = extractAllergens(['white rice, cooked', 'olive oil'], config.allergenKeywords);
    expect(found).toEqual([]);
  });
});
