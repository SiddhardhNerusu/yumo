/**
 * All Brain tunables live here as config-with-defaults. Per the plan (§3.3)
 * these are server-tunable via remote config; the engine never hardcodes a
 * threshold inline.
 */

export interface ScoreWeights {
  freq: number;
  recency: number;
  dow: number;
  tod: number;
  menuPrior: number;
  seq: number;
  declinePenalty: number;
}

/** §3.3 defaults. */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  freq: 0.3,
  recency: 0.2,
  dow: 0.15,
  tod: 0.1,
  menuPrior: 0.15,
  seq: 0.1,
  declinePenalty: 0.25,
};

/** §3.4 confidence ladder — score thresholds. */
export interface LadderConfig {
  /** ≥ this → proactive nudge (actionable notification / one-tap widget). */
  nudge: number;
  /** ≥ this (and < nudge) → open to top-3 tiles. Below → silent. */
  tiles: number;
}
export const DEFAULT_LADDER: LadderConfig = { nudge: 0.75, tiles: 0.4 };

/** §3.6 nudge budget. */
export interface NudgeBudgetConfig {
  maxPerSlotPerDay: number;
  maxPerDay: number;
  /** consecutive declines in a slot → that slot goes quiet. */
  slotQuietAfterDeclines: number;
  slotQuietHours: number;
  /** declines of the same food in a slot → suppress that food's nudges. */
  foodSuppressAfterDeclines: number;
  foodSuppressDays: number;
  /** nudge fires at (median log time of slot − leadTimeMin). */
  leadTimeMin: number;
}
export const DEFAULT_NUDGE_BUDGET: NudgeBudgetConfig = {
  maxPerSlotPerDay: 1,
  maxPerDay: 3,
  slotQuietAfterDeclines: 2,
  slotQuietHours: 48,
  foodSuppressAfterDeclines: 3,
  foodSuppressDays: 14,
  leadTimeMin: 10,
};

export interface BrainConfig {
  weights: ScoreWeights;
  ladder: LadderConfig;
  recencyHalfLifeDays: number;
  todSigmaMin: number;
  freqWindowDays: number;
  declineDecayHours: number;
  /** below this many days of history, data-driven terms scale up linearly (§3.8). */
  coldStartDays: number;
  nudge: NudgeBudgetConfig;
}

export const DEFAULT_CONFIG: BrainConfig = {
  weights: DEFAULT_WEIGHTS,
  ladder: DEFAULT_LADDER,
  recencyHalfLifeDays: 10,
  todSigmaMin: 45,
  freqWindowDays: 28,
  declineDecayHours: 48,
  coldStartDays: 7,
  nudge: DEFAULT_NUDGE_BUDGET,
};

/** Merge a partial override onto the defaults (shallow, with nested weights/nudge). */
export function resolveConfig(override?: DeepPartial<BrainConfig>): BrainConfig {
  if (!override) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...override,
    weights: { ...DEFAULT_CONFIG.weights, ...override.weights },
    ladder: { ...DEFAULT_CONFIG.ladder, ...override.ladder },
    nudge: { ...DEFAULT_CONFIG.nudge, ...override.nudge },
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };
