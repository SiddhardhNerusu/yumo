// Config
export {
  DEFAULT_CONFIG,
  DEFAULT_WEIGHTS,
  DEFAULT_LADDER,
  DEFAULT_NUDGE_BUDGET,
  resolveConfig,
  type BrainConfig,
  type ScoreWeights,
  type LadderConfig,
  type NudgeBudgetConfig,
} from './config';

// Event log
export {
  isLogKind,
  logEvents,
  eventsOfFood,
  eventsInSlot,
  eventsInWindow,
  loggedFoodIds,
  firstEventTs,
  LOG_KINDS,
  type BrainEvent,
  type EventKind,
} from './events';

// Time
export { localParts, daysBetween, hoursBetween, minuteOfDayDistance, median, type LocalParts } from './time';

// Menu
export { onMenu, menuFoodsForSlot, menuPortion, type MenuEntry, type WeekMenu } from './menu';

// Scoring
export {
  scoreCandidates,
  scoreCandidate,
  type ScoredCandidate,
  type ScoreBreakdown,
  type ScoreInput,
  type ScoreContext,
} from './scoring';

// Confidence ladder
export {
  tierForScore,
  actionForTier,
  type ConfidenceTier,
  type LadderAction,
} from './confidence';

// Portion learning
export { learnedPortion, portionChips, type PortionOptions, type PortionChips } from './portion';

// Nudge budget
export {
  canNudge,
  slotIsQuiet,
  foodSuppressed,
  nudgeOutcomesToday,
  NUDGE_OUTCOME_KINDS,
  type NudgeDecision,
} from './nudge';

// Prediction (top-level API)
export {
  rankSlot,
  topPrediction,
  nextNudge,
  inferSlot,
  type PredictInput,
  type Prediction,
  type NudgePlan,
} from './predict';
