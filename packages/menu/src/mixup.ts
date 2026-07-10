import type { MealSlot } from '@usual/shared';
import type { MenuRecipe, UserProfile, Effort } from './types';
import { isAllowed } from './filter';
import { softScore } from './scoring';
import { MIXUP } from './config';

const EFFORT_ORDER: Record<Effort, number> = { '5min': 0, '15min': 1, '30min+': 2 };

/**
 * "Mix it up" isocaloric swap (§4.4): 3–4 alternatives for the same slot,
 * within kcal ±10% and protein ±15%, allergy/hate-filtered, effort ≤ original+1
 * tier. Ranked by soft preference (cuisine lean → likes → closeness).
 */
export function mixItUp(
  original: MenuRecipe,
  slot: MealSlot,
  pool: MenuRecipe[],
  profile: UserProfile,
): MenuRecipe[] {
  const kcal = original.perServing.kcal;
  const protein = original.perServing.protein_g;
  const maxEffort = EFFORT_ORDER[original.effort] + MIXUP.effortMaxStepUp;
  const proteinBand = Math.max(protein * MIXUP.proteinTolerance, 5); // floor so low-protein originals aren't over-restrictive

  const candidates = pool.filter(
    (r) =>
      r.id !== original.id &&
      r.slotAffinity.includes(slot) &&
      isAllowed(r, profile) &&
      Math.abs(r.perServing.kcal - kcal) <= kcal * MIXUP.kcalTolerance &&
      Math.abs(r.perServing.protein_g - protein) <= proteinBand &&
      EFFORT_ORDER[r.effort] <= maxEffort,
  );

  return candidates
    .map((r) => ({
      r,
      score: softScore(r, slot, profile, {
        slotTargetKcal: kcal,
        recentlyUsed: new Set<string>(),
        proteinPaceDeficit: 0,
      }).score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MIXUP.count)
    .map((x) => x.r);
}
