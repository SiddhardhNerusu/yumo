import type { EnergyMacros } from '@yumo/shared';
import { atwaterKcal } from '@yumo/shared';

export interface Verification {
  /** Energy summed from FDC per-food energy values. */
  kcalComputed: number;
  /** Energy re-derived from the summed macros via Atwater 4/4/9. */
  kcalAtwater: number;
  /** |computed − atwater| / computed. */
  deviationPct: number;
  passes: boolean;
  tolerance: number;
}

/**
 * Independent cross-check of a recipe's computed energy: the summed FDC energy
 * should agree with Atwater-from-macros within tolerance. This is the spike's
 * acceptance gate (≤5% kcal deviation) and the outlier lint's internal check —
 * it catches unit errors, bad nutrient extraction, and mis-summation. It does
 * NOT validate that the resolver picked the right food (that is the human
 * gate's job); it validates the arithmetic is self-consistent.
 */
export function verifyEnergyConsistency(total: EnergyMacros, tolerance = 0.05): Verification {
  const kcalAtwater = atwaterKcal(total);
  const denom = Math.max(total.kcal, 1);
  const deviationPct = Math.abs(total.kcal - kcalAtwater) / denom;
  return {
    kcalComputed: total.kcal,
    kcalAtwater,
    deviationPct,
    passes: deviationPct <= tolerance,
    tolerance,
  };
}
