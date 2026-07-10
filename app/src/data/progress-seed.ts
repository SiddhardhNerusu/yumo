/**
 * DEMO SEED for Progress — replaced by HealthKit/weight logs + the synced event
 * log. Placeholder only.
 */
export const WEIGHTS: number[] = [
  80.6, 80.7, 80.4, 80.5, 80.2, 80.3, 80.0, 80.1, 79.9, 80.0, 79.7, 79.8, 79.6,
  79.7, 79.5, 79.4, 79.5, 79.3, 79.2, 79.3, 79.1,
]; // oldest → newest, ~3 weeks

export const LOGGED_LAST_7: boolean[] = [true, true, false, true, true, true, true]; // Mon → Sun
export const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A single missed day is frozen, not reset (§6.3 streak freeze). */
export const STREAK = { current: 4, frozen: true };
