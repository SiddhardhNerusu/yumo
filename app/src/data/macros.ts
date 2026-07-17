import type { UserProfile } from '@yumo/menu';
import { PROTEIN_FLOOR_PER_KG } from '@yumo/menu';

export interface MacroTargets { proteinG: number; carbsG: number; fatG: number }
export interface MacrosEaten { proteinG: number; carbsG: number; fatG: number }

/**
 * Daily macro targets. Each honors the user's explicit goal
 * (profile.proteinTargetG / carbTargetG / fatTargetG, set in Settings) when
 * present, else derives one — never authored per-food:
 *  - protein: the engine's own 1.6 g/kg-target-weight floor (§5.1), promoted to
 *    the user-visible goal. Reading proteinTargetG here is what keeps the macro
 *    bar / overview honest: generate.ts already plans to it, so before this the
 *    bar showed 1.6×kg while the menu was built to the user's real target.
 *  - fat: 30% of the calorie budget (standard dietary guidance midpoint);
 *  - carbs: whatever calories remain, as grams.
 */
export function macroTargets(profile: UserProfile): MacroTargets {
  const proteinG = Math.max(1, Math.round(profile.proteinTargetG ?? PROTEIN_FLOOR_PER_KG * profile.targetWeightKg));
  const fatG = Math.max(1, Math.round(profile.fatTargetG ?? (profile.budgetKcal * 0.3) / 9));
  const carbsG = Math.max(1, Math.round(profile.carbTargetG ?? (profile.budgetKcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, carbsG, fatG };
}
