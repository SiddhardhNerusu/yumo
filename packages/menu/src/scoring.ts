import type { MealSlot } from '@yumo/shared';
import type { MenuRecipe, UserProfile } from './types';
import { containsToken } from './filter';
import { SOFT_WEIGHTS, NOVELTY_WEIGHT } from './config';

export interface ScoreContext {
  slotTargetKcal: number;
  /** recipe ids already used earlier this week. */
  recentlyUsed: Set<string>;
  /** 0..1, how far behind the protein floor the day currently is. */
  proteinPaceDeficit: number;
  /** recipe ids the user has swapped/picked before → up-weight (§4.3.3). */
  boostIds?: Set<string>;
}

export interface SoftScore {
  score: number;
  reasons: string[];
}

/** Soft, weighted preference score for a candidate in a slot (§4.3). Positive
 * signals only add reasons; novelty is a multiplicative penalty. */
export function softScore(
  recipe: MenuRecipe,
  _slot: MealSlot,
  profile: UserProfile,
  ctx: ScoreContext,
): SoftScore {
  const reasons: string[] = [];
  let score = 1;

  const likeHits = profile.likes.filter((t) => containsToken(recipe, t)).length;
  if (likeHits > 0) {
    score += SOFT_WEIGHTS.likes * Math.min(1, likeHits / 2);
    reasons.push('a food you like');
  }

  const pantryHits = profile.pantry.filter((t) => containsToken(recipe, t)).length;
  if (pantryHits > 0) {
    score += SOFT_WEIGHTS.pantry * Math.min(1, pantryHits / 3);
    reasons.push('pantry-friendly');
  }

  const lean = profile.cuisineLean?.[recipe.cuisine] ?? 1;
  score *= lean;
  if (lean > 1) reasons.push(`${recipe.cuisine}`);

  // learned preference: recipes the user has swapped/picked before (§4.3.3)
  if (ctx.boostIds?.has(recipe.id)) {
    score += SOFT_WEIGHTS.preference;
    reasons.push('you picked this before');
  }

  // closeness of natural serving to the slot target → less portion stretching
  const closeness = 1 - Math.min(1, Math.abs(recipe.perServing.kcal - ctx.slotTargetKcal) / ctx.slotTargetKcal);
  score += SOFT_WEIGHTS.closeness * closeness;

  if (ctx.proteinPaceDeficit > 0) {
    const proteinPer100kcal = (recipe.perServing.protein_g / Math.max(1, recipe.perServing.kcal)) * 100;
    score += SOFT_WEIGHTS.protein * Math.min(1, proteinPer100kcal / 10) * ctx.proteinPaceDeficit;
    if (proteinPer100kcal >= 8) reasons.push('protein-rich');
  }

  // novelty: penalise repeats; strength set by the variation dial
  if (ctx.recentlyUsed.has(recipe.id)) {
    score *= 1 - NOVELTY_WEIGHT[profile.variation];
  }

  return { score: Math.max(0, score), reasons };
}
