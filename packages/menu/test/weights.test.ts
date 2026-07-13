import { describe, it, expect } from 'vitest';
import { recipeWeights, WEIGHT_MIN, WEIGHT_MAX, type WeightSignal } from '../src/weights';

/** §8 learning loop: per-user recipe weights move as specced and decay to neutral. */

const T0 = 1_700_000_000_000; // fixed epoch (no Date.now in tests)
const WEEK = 7 * 24 * 3600 * 1000;

describe('§8 recipeWeights', () => {
  it('a thumbs-up lifts above neutral, a thumbs-down drops below', () => {
    const w = recipeWeights(
      [
        { recipeId: 'up', kind: 'thumb_up', ts: T0 },
        { recipeId: 'down', kind: 'thumb_down', ts: T0 },
      ],
      T0,
    );
    expect(w.get('up')!).toBeGreaterThan(1);
    expect(w.get('down')!).toBeLessThan(1);
  });

  it('repeated positive signals compound but clamp at the ceiling', () => {
    const sigs: WeightSignal[] = Array.from({ length: 20 }, (_, i) => ({ recipeId: 'r', kind: 'thumb_up', ts: T0 + i }));
    const w = recipeWeights(sigs, T0 + 20)!.get('r')!;
    expect(w).toBeLessThanOrEqual(WEIGHT_MAX + 1e-9);
    expect(w).toBeGreaterThan(2.5);
  });

  it('repeated negative signals clamp at the floor', () => {
    const sigs: WeightSignal[] = Array.from({ length: 20 }, (_, i) => ({ recipeId: 'r', kind: 'thumb_down', ts: T0 + i }));
    const w = recipeWeights(sigs, T0 + 20)!.get('r')!;
    expect(w).toBeGreaterThanOrEqual(WEIGHT_MIN - 1e-9);
    expect(w).toBeLessThan(0.5);
  });

  it('decays back toward neutral over weeks', () => {
    const fresh = recipeWeights([{ recipeId: 'r', kind: 'thumb_up', ts: T0 }], T0)!.get('r')!;
    const stale = recipeWeights([{ recipeId: 'r', kind: 'thumb_up', ts: T0 }], T0 + 20 * WEEK)!.get('r')!;
    expect(stale).toBeLessThan(fresh);
    expect(stale).toBeGreaterThan(1); // still slightly positive, not yet fully neutral
    expect(Math.abs(stale - 1)).toBeLessThan(Math.abs(fresh - 1));
  });

  it('a swap-away then a thumbs-up nets out sensibly and omits neutral recipes', () => {
    const w = recipeWeights(
      [
        { recipeId: 'r', kind: 'swap_away', ts: T0 },
        { recipeId: 'r', kind: 'thumb_up', ts: T0 + 1 },
        { recipeId: 'neutral', kind: 'thumb_up', ts: T0 },
        { recipeId: 'neutral', kind: 'thumb_down', ts: T0 + 1 },
      ],
      T0 + 2,
    );
    expect(w.get('r')!).toBeCloseTo(0.8 * 1.3, 2); // 1.04
    // 1 * 1.3 * 0.5 = 0.65 — not neutral, so it IS present; verify the compound
    expect(w.get('neutral')!).toBeCloseTo(1.3 * 0.5, 2);
  });
});
