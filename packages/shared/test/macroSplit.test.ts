import { describe, it, expect } from 'vitest';
import { defaultMacroPct, rebalanceMacroPct, pctToGrams, MACRO_PCT_CLAMP, type MacroPct } from '../src/macroSplit';

const sum = (m: MacroPct) => m.protein + m.carbs + m.fat;
const inClamp = (m: MacroPct) =>
  m.protein >= MACRO_PCT_CLAMP.protein[0] && m.protein <= MACRO_PCT_CLAMP.protein[1] &&
  m.carbs >= MACRO_PCT_CLAMP.carbs[0] && m.carbs <= MACRO_PCT_CLAMP.carbs[1] &&
  m.fat >= MACRO_PCT_CLAMP.fat[0] && m.fat <= MACRO_PCT_CLAMP.fat[1];
const isInts = (m: MacroPct) => Number.isInteger(m.protein) && Number.isInteger(m.carbs) && Number.isInteger(m.fat);

describe('defaultMacroPct', () => {
  it('derives the standard split for a normal profile (2000 kcal / 72 kg)', () => {
    // pG 115 → 460 kcal (23%), fG 67 → 603 kcal (30%), carbs 47%
    const m = defaultMacroPct(2000, 72);
    expect(m).toEqual({ protein: 23, carbs: 47, fat: 30 });
    expect(sum(m)).toBe(100);
  });
  it('honors explicit gram targets', () => {
    const m = defaultMacroPct(2000, 72, 150, 55); // 600 kcal P (30%), 495 kcal F (~25%), carbs 45%
    expect(sum(m)).toBe(100);
    expect(m.protein).toBe(30);
  });
  it('always returns ints in-clamp summing to 100 across a sweep', () => {
    for (let b = 1200; b <= 4000; b += 100) {
      for (let w = 45; w <= 160; w += 5) {
        const m = defaultMacroPct(b, w);
        expect(sum(m)).toBe(100);
        expect(inClamp(m)).toBe(true);
        expect(isInts(m)).toBe(true);
      }
    }
  });
});

describe('rebalanceMacroPct', () => {
  const base: MacroPct = { protein: 30, carbs: 40, fat: 30 };

  it('is idempotent when the value does not change', () => {
    expect(rebalanceMacroPct(base, 'protein', 30)).toEqual(base);
  });

  it('absorbs the delta across the other two, keeping sum 100', () => {
    const m = rebalanceMacroPct(base, 'protein', 40); // +10 protein
    expect(m.protein).toBe(40);
    expect(sum(m)).toBe(100);
    expect(m.carbs).toBeLessThan(base.carbs);
    expect(m.fat).toBeLessThan(base.fat);
  });

  it('clamps the moved key to its own range', () => {
    expect(rebalanceMacroPct(base, 'protein', 99).protein).toBe(45); // protein ceiling
    expect(rebalanceMacroPct(base, 'fat', 0).fat).toBe(15); // fat floor
  });

  it('keeps the other two within their clamps even at extremes', () => {
    for (const key of ['protein', 'carbs', 'fat'] as const) {
      for (let v = -10; v <= 110; v += 1) {
        const m = rebalanceMacroPct(base, key, v);
        expect(sum(m)).toBe(100);
        expect(inClamp(m)).toBe(true);
        expect(isInts(m)).toBe(true);
      }
    }
  });

  it('the larger of the other two absorbs the rounding remainder', () => {
    // protein 33 leaves 67 to split over carbs(40)+fat(27); the larger (carbs) takes the remainder
    const m = rebalanceMacroPct({ protein: 33, carbs: 40, fat: 27 }, 'protein', 34);
    expect(sum(m)).toBe(100);
    expect(m.protein).toBe(34);
  });
});

describe('pctToGrams', () => {
  it('converts % to grams at a budget (P/C ×4, F ×9)', () => {
    expect(pctToGrams({ protein: 30, carbs: 40, fat: 30 }, 2000)).toEqual({ proteinG: 150, carbsG: 200, fatG: 67 });
  });
  it('floors each gram at 1', () => {
    const g = pctToGrams({ protein: 10, carbs: 5, fat: 15 }, 1);
    expect(g.proteinG).toBeGreaterThanOrEqual(1);
    expect(g.carbsG).toBeGreaterThanOrEqual(1);
    expect(g.fatG).toBeGreaterThanOrEqual(1);
  });
});
