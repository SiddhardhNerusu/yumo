import type { LadderConfig } from './config';

/** §3.4 confidence ladder. */
export type ConfidenceTier = 'high' | 'medium' | 'low';
export type LadderAction = 'nudge' | 'tiles' | 'silent';

export function tierForScore(score: number, ladder: LadderConfig): ConfidenceTier {
  if (score >= ladder.nudge) return 'high';
  if (score >= ladder.tiles) return 'medium';
  return 'low';
}

export function actionForTier(tier: ConfidenceTier): LadderAction {
  if (tier === 'high') return 'nudge'; // proactive notification + one-tap widget
  if (tier === 'medium') return 'tiles'; // app/widget opens to top-3 tiles
  return 'silent'; // quiet quick-log surface
}
