import type { MealSlot } from '@yumo/shared';
import type { BrainEvent } from './events';
import { scoreCandidates, type ScoreInput, type ScoreBreakdown, type ScoreContext } from './scoring';
import { tierForScore, actionForTier, type ConfidenceTier, type LadderAction } from './confidence';
import { learnedPortion } from './portion';
import { canNudge, type NudgeDecision } from './nudge';
import { localParts, daysBetween } from './time';
import { firstEventTs } from './events';
import type { WeekMenu } from './menu';
import { DEFAULT_CONFIG, type BrainConfig } from './config';

export interface PredictInput {
  events: BrainEvent[];
  candidates: string[];
  slot: MealSlot;
  now: number;
  tzOffsetMin: number;
  menu?: WeekMenu;
  context?: ScoreContext;
  /** resolved config (use resolveConfig for partial overrides). */
  config?: BrainConfig;
  /** food-graph default portions, used before a food has any logs. */
  portionFallback?: Record<string, number>;
}

export interface Prediction {
  foodId: string;
  slot: MealSlot;
  score: number;
  tier: ConfidenceTier;
  action: LadderAction;
  portionG: number;
  breakdown: ScoreBreakdown;
}

/** Ranked predictions for a slot: score → confidence tier → action → learned portion. */
export function rankSlot(input: PredictInput): Prediction[] {
  const config = input.config ?? DEFAULT_CONFIG;
  const scoreInput: ScoreInput = {
    events: input.events,
    candidates: input.candidates,
    slot: input.slot,
    now: input.now,
    tzOffsetMin: input.tzOffsetMin,
    menu: input.menu,
    context: input.context,
    config,
  };
  const dow = localParts(input.now, input.tzOffsetMin).dayOfWeek;

  return scoreCandidates(scoreInput).map((s) => {
    const tier = tierForScore(s.score, config.ladder);
    const portionG = learnedPortion(input.events, s.foodId, {
      menu: input.menu,
      dayOfWeek: dow,
      slot: input.slot,
      fallbackG: input.portionFallback?.[s.foodId],
    });
    return {
      foodId: s.foodId,
      slot: input.slot,
      score: s.score,
      tier,
      action: actionForTier(tier),
      portionG,
      breakdown: s.breakdown,
    };
  });
}

export function topPrediction(input: PredictInput): Prediction | null {
  return rankSlot(input)[0] ?? null;
}

export interface NudgePlan {
  fire: boolean;
  prediction: Prediction | null;
  /** how a fired nudge is framed: confident ("the usual?") vs cold-start menu
   * confirmation ("your menu says … — did you have it?", §3.8). */
  framing: 'confident' | 'menu' | null;
  decision: NudgeDecision;
}

/**
 * Decide whether to fire a proactive nudge right now (§3.6, §3.8). Two paths:
 *  - confident: top candidate clears the high-confidence ladder;
 *  - cold-start menu: before ~7 days of history, a menu item for this slot is
 *    offered as a "did you have it?" confirmation even below the ladder.
 * Both are gated by the nudge budget.
 */
export function nextNudge(input: PredictInput): NudgePlan {
  const config = input.config ?? DEFAULT_CONFIG;
  const top = topPrediction(input);

  if (!top) {
    return { fire: false, prediction: null, framing: null, decision: { allowed: false, reasons: ['no candidates'] } };
  }

  const daysActive = daysBetween(input.now, firstEventTs(input.events, input.now));
  const coldStart = daysActive < config.coldStartDays;

  let framing: 'confident' | 'menu' | null = null;
  if (top.tier === 'high') framing = 'confident';
  else if (coldStart && top.breakdown.menuPrior > 0) framing = 'menu';

  if (framing === null) {
    return {
      fire: false,
      prediction: top,
      framing: null,
      decision: { allowed: false, reasons: ['top candidate below nudge threshold'] },
    };
  }

  const decision = canNudge(input.events, top.foodId, input.slot, input.now, input.tzOffsetMin, config);
  return { fire: decision.allowed, prediction: top, framing, decision };
}

/** Default meal-time windows for inferring the current slot when not given. */
export function inferSlot(now: number, tzOffsetMin: number): MealSlot {
  const m = localParts(now, tzOffsetMin).minutesOfDay;
  if (m >= 5 * 60 && m < 10.5 * 60) return 'breakfast';
  if (m >= 10.5 * 60 && m < 15 * 60) return 'lunch';
  if (m >= 15 * 60 && m < 21 * 60) return 'dinner';
  return 'snack';
}
