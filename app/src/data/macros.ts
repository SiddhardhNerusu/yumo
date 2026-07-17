import type { UserProfile } from '@yumo/menu';

export interface MacroTargets { proteinG: number; carbsG: number; fatG: number }
export interface MacrosEaten { proteinG: number; carbsG: number; fatG: number }

/**
 * Daily macro targets, derived — never authored per-food:
 *  - protein: the engine's own 1.6 g/kg-target-weight floor (§5.1), promoted to
 *    the user-visible goal;
 *  - fat: 30% of the calorie budget (standard dietary guidance midpoint);
 *  - carbs: whatever calories remain, as grams.
 * These become editable per-user targets when §5.1's carb/fat fields ship; until
 * then this gives the macro bar + overview honest, defensible numbers.
 */
export function macroTargets(profile: UserProfile): MacroTargets {
  const proteinG = Math.max(1, Math.round(1.6 * profile.targetWeightKg));
  const fatG = Math.max(1, Math.round((profile.budgetKcal * 0.3) / 9));
  const carbsG = Math.max(1, Math.round((profile.budgetKcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, carbsG, fatG };
}
