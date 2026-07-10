import { describe, it, expect } from 'vitest';
import { mixItUp } from '../src/mixup';
import { POOL, baseProfile } from './_pool';

const byId = (id: string) => {
  const r = POOL.find((x) => x.id === id);
  if (!r) throw new Error(`no ${id}`);
  return r;
};

describe('mix it up (isocaloric swap)', () => {
  it('offers same-slot alternatives within kcal ±10% and protein ±15%', () => {
    const salmon = byId('salmon_veg'); // 620 kcal, 42g protein, dinner
    const alts = mixItUp(salmon, 'dinner', POOL, baseProfile);
    expect(alts.length).toBeGreaterThanOrEqual(1);
    expect(alts.some((r) => r.id === 'chicken_curry')).toBe(true);
    for (const a of alts) {
      expect(a.id).not.toBe('salmon_veg');
      expect(a.slotAffinity).toContain('dinner');
      expect(Math.abs(a.perServing.kcal - 620)).toBeLessThanOrEqual(62 + 1e-9);
      expect(Math.abs(a.perServing.protein_g - 42)).toBeLessThanOrEqual(Math.max(42 * 0.15, 5) + 1e-9);
    }
  });

  it('respects allergies in swaps', () => {
    const chicken = byId('chicken_curry');
    const alts = mixItUp(chicken, 'dinner', POOL, { ...baseProfile, allergies: ['fish'] });
    expect(alts.some((r) => r.allergens.includes('fish'))).toBe(false);
  });

  it('excludes the original and never exceeds effort + 1 tier', () => {
    const yogurt = byId('greek_yogurt'); // 5min snack
    const alts = mixItUp(yogurt, 'snack', POOL, baseProfile);
    expect(alts.every((r) => r.id !== 'greek_yogurt')).toBe(true);
    // original is 5min (tier 0) → max tier 1 (15min); no 30min+ in snacks anyway
    expect(alts.every((r) => r.effort !== '30min+')).toBe(true);
  });
});
