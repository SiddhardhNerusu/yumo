import type { MealSlot } from '@yumo/shared';
import type { BrainEvent } from './events';
import { logEvents, eventsInWindow, firstEventTs } from './events';
import { localParts, daysBetween, hoursBetween, minuteOfDayDistance, median } from './time';
import { onMenu, type WeekMenu } from './menu';
import type { BrainConfig } from './config';

export interface ScoreContext {
  /** HealthKit says the user worked out today (§3.3 seq term, v1). */
  isWorkoutDay?: boolean;
  /** foodId → [0,1] affinity with workout days. Supplied by the caller in v1. */
  workoutAffinity?: Record<string, number>;
}

export interface ScoreBreakdown {
  freq: number;
  recency: number;
  dow: number;
  tod: number;
  menuPrior: number;
  seq: number;
  declinePenalty: number;
  /** cold-start scaling applied to the data-driven terms (§3.8). */
  dataFactor: number;
}

export interface ScoredCandidate {
  foodId: string;
  score: number; // clamped [0,1]
  breakdown: ScoreBreakdown;
}

export interface ScoreInput {
  events: BrainEvent[];
  candidates: string[];
  slot: MealSlot;
  now: number;
  tzOffsetMin: number;
  menu?: WeekMenu;
  context?: ScoreContext;
  config: BrainConfig;
}

/** Aggregates computed once per prediction, shared across candidates. */
interface Precomputed {
  effectiveLogs: BrainEvent[];
  slotWindowLogs: BrainEvent[];
  dowLogs: BrainEvent[];
  nowMinutes: number;
  nowDow: number;
  dataFactor: number;
  numCandidates: number;
}

function precompute(input: ScoreInput): Precomputed {
  const { events, now, tzOffsetMin, slot, config, candidates } = input;
  const effectiveLogs = logEvents(events);
  const windowLogs = eventsInWindow(effectiveLogs, now, config.freqWindowDays);
  const nowParts = localParts(now, tzOffsetMin);
  const dowLogs = effectiveLogs.filter((e) => localParts(e.ts, e.tzOffsetMin).dayOfWeek === nowParts.dayOfWeek);
  const daysActive = Math.max(0, daysBetween(now, firstEventTs(events, now)));
  return {
    effectiveLogs,
    slotWindowLogs: windowLogs.filter((e) => e.slot === slot),
    dowLogs,
    nowMinutes: nowParts.minutesOfDay,
    nowDow: nowParts.dayOfWeek,
    dataFactor: Math.min(1, config.coldStartDays > 0 ? daysActive / config.coldStartDays : 1),
    numCandidates: Math.max(1, candidates.length),
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// share of this slot's trailing-window logs that are food F
function freqTerm(foodId: string, pc: Precomputed): number {
  if (pc.slotWindowLogs.length === 0) return 0;
  const f = pc.slotWindowLogs.filter((e) => e.foodId === foodId).length;
  return f / pc.slotWindowLogs.length;
}

// exponential decay on days since F was last logged
function recencyTerm(foodId: string, pc: Precomputed, now: number, halfLifeDays: number): number {
  let last = -Infinity;
  for (const e of pc.effectiveLogs) if (e.foodId === foodId && e.ts > last) last = e.ts;
  if (last === -Infinity) return 0;
  const days = Math.max(0, daysBetween(now, last));
  return Math.pow(0.5, days / halfLifeDays);
}

// P(F | day-of-week), Laplace-smoothed over the candidate vocabulary
function dowTerm(foodId: string, pc: Precomputed): number {
  const countF = pc.dowLogs.filter((e) => e.foodId === foodId).length;
  return (countF + 1) / (pc.dowLogs.length + pc.numCandidates);
}

// gaussian around F's median log time-of-day
function todTerm(foodId: string, pc: Precomputed, sigmaMin: number): number {
  const mins: number[] = [];
  for (const e of pc.effectiveLogs) {
    if (e.foodId === foodId) mins.push(localParts(e.ts, e.tzOffsetMin).minutesOfDay);
  }
  if (mins.length === 0) return 0;
  const med = median(mins);
  const dist = minuteOfDayDistance(pc.nowMinutes, med);
  return Math.exp(-0.5 * (dist / sigmaMin) ** 2);
}

// linear-decaying penalty if F's last offer in this slot was declined recently
function declineTerm(
  foodId: string,
  slot: MealSlot,
  events: BrainEvent[],
  now: number,
  decayHours: number,
): number {
  let lastDeclineTs = -Infinity;
  for (const e of events) {
    if (e.kind === 'nudge_decline' && e.foodId === foodId && e.slot === slot && e.ts > lastDeclineTs) {
      lastDeclineTs = e.ts;
    }
  }
  if (lastDeclineTs === -Infinity) return 0;
  const hrs = hoursBetween(now, lastDeclineTs);
  if (hrs >= decayHours) return 0;
  return 1 - hrs / decayHours;
}

export function scoreCandidate(foodId: string, input: ScoreInput, pc: Precomputed): ScoredCandidate {
  const { config, menu, slot, now, context } = input;
  const w = config.weights;

  const freq = freqTerm(foodId, pc);
  const recency = recencyTerm(foodId, pc, now, config.recencyHalfLifeDays);
  const dow = dowTerm(foodId, pc);
  const tod = todTerm(foodId, pc, config.todSigmaMin);
  const menuPrior = onMenu(menu, pc.nowDow, slot, foodId) ? 1 : 0;
  const seq = context?.isWorkoutDay ? (context.workoutAffinity?.[foodId] ?? 0) : 0;
  const declinePenalty = declineTerm(foodId, slot, input.events, now, config.declineDecayHours);

  // Data-driven terms scale up over the cold-start window; menuPrior always
  // full weight (so it dominates on day 0), and declines are always respected.
  const dataDriven =
    w.freq * freq + w.recency * recency + w.dow * dow + w.tod * tod + w.seq * seq;
  const score = clamp01(
    pc.dataFactor * dataDriven + w.menuPrior * menuPrior - w.declinePenalty * declinePenalty,
  );

  return {
    foodId,
    score,
    breakdown: { freq, recency, dow, tod, menuPrior, seq, declinePenalty, dataFactor: pc.dataFactor },
  };
}

/** Score every candidate for a slot, ranked high→low. */
export function scoreCandidates(input: ScoreInput): ScoredCandidate[] {
  const pc = precompute(input);
  return input.candidates
    .map((f) => scoreCandidate(f, input, pc))
    .sort((a, b) => b.score - a.score);
}
