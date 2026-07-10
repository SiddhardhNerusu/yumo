import type { MealSlot } from '@yumo/shared';
import { SLOT_ENVELOPE } from '@yumo/shared';

export interface OutlierResult {
  flagged: boolean;
  reason: string | null;
  expectedKcal: number;
  band: [number, number];
}

/**
 * Flag a recipe whose per-serving energy falls outside its slot envelope
 * ±tolerance of a reference daily budget (§4.5 step 3). Catches gross
 * computation/resolution errors (e.g. a "breakfast" that computes to 1,800
 * kcal). Uses a fixed reference budget for catalogue QA — real per-user budgets
 * live elsewhere.
 */
export function checkOutlier(
  perServingKcal: number,
  slots: MealSlot[],
  referenceBudget = 2200,
  tolerance = 0.4,
): OutlierResult {
  const envelope = Math.max(...slots.map((s) => SLOT_ENVELOPE[s]));
  const expected = referenceBudget * envelope;
  const low = expected * (1 - tolerance);
  const high = expected * (1 + tolerance);
  const flagged = perServingKcal < low || perServingKcal > high;
  return {
    flagged,
    reason: flagged
      ? `per-serving ${Math.round(perServingKcal)} kcal outside ${Math.round(low)}–${Math.round(high)} kcal band`
      : null,
    expectedKcal: expected,
    band: [low, high],
  };
}
