import { mifflinStJeorBMR, KCAL_PER_KG, type BodyStats } from './budget';
import { trendSeries, trendAt, maxTrendJump } from './trend';
import type { DayKg } from './weightWindows';

/**
 * True burn — adaptive TDEE from energy balance (Overview §6). We don't guess
 * your burn from a formula; we MEASURE it: over a trailing window we know what
 * you ate (logged intake) and how your weight trend moved, and physics does the
 * rest. If you averaged 1,846 kcal and the trend fell ~0.45 kg/week, you burned
 * more than you ate — the gap IS your real maintenance.
 *
 * Reads the smoothed weight trend (never raw scale values — water swings would
 * corrupt the balance). Blended week-to-week for stability and clamped to a
 * physiological band so a bad window can't throw the budget. Until there's
 * enough steady data it stays in `learning` and callers show the formula TDEE.
 *
 * Pure + deterministic. Both the True-burn card and the Settings budget derive
 * from this one function.
 */

/** Logged intake for a single day (unlogged days are simply absent — an unlogged
 * day is missing data, not a zero, per the house rule). */
export interface DayKcal {
  day: number;
  kcal: number;
}

export type TrueBurnState = 'learning' | 'learned';

export interface TrueBurnInput {
  /** logged-day intake totals (kcal). Unlogged days omitted. */
  intake: DayKcal[];
  /** raw scale weigh-ins (the trend is computed internally). */
  weighIns: DayKg[];
  todayEpoch: number;
  /** body stats for the BMR clamp (weightKg = current weight). */
  body: BodyStats;
  /** the Mifflin-St Jeor TDEE — shown while learning and as "the formula guessed X". */
  formulaTdee: number;
  /** last week's accepted estimate, for the 0.7/0.3 stability blend. */
  previousEstimate?: number | null;
  /** trailing window length in days (default 28). */
  windowDays?: number;
}

export interface TrueBurnResult {
  state: TrueBurnState;
  /** the number to show and to feed the budget (formulaTdee while learning). */
  burn: number;
  /** echo of the formula estimate, for the "the formula guessed X" sub-line. */
  formulaTdee: number;
  /** mean logged intake over the window (learned only, else null). */
  intakeAvg: number | null;
  /** kcal/day the balance moved — negative is a deficit (learned only). */
  dailyBalance: number | null;
  /** trend-weight change over the window in kg (learned only). */
  trendDelta: number | null;
  /** measured pace in kg/week from the trend (learned only). */
  paceKgPerWeek: number | null;
  /** logged days found in the window. */
  loggedDays: number;
  /** weigh-ins found in the window. */
  weighInsUsed: number;
  /** true when the raw estimate hit the 1.2×–2.5× BMR clamp. */
  clamped: boolean;
}

/** ≥ this many logged days AND weigh-ins in the window to leave `learning`. */
export const MIN_LOGGED_DAYS = 10;
export const MIN_WEIGH_INS = 8;
/** blend weight on the current window vs the previous estimate (stability). */
export const BLEND_CURRENT = 0.7;
/** physiological clamp band, as multiples of BMR. */
export const BURN_CLAMP_LO = 1.2;
export const BURN_CLAMP_HI = 2.5;
/** a trend step larger than this (kg/day) means a corrupt weigh-in → reject window. */
export const MAX_TREND_JUMP_KG = 1.5;
const DEFAULT_WINDOW_DAYS = 28;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function learning(input: TrueBurnInput, loggedDays: number, weighInsUsed: number): TrueBurnResult {
  return {
    state: 'learning',
    burn: input.formulaTdee,
    formulaTdee: input.formulaTdee,
    intakeAvg: null,
    dailyBalance: null,
    trendDelta: null,
    paceKgPerWeek: null,
    loggedDays,
    weighInsUsed,
    clamped: false,
  };
}

export function trueBurn(input: TrueBurnInput): TrueBurnResult {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const start = input.todayEpoch - windowDays + 1;

  const loggedInWindow = input.intake.filter((d) => d.day >= start && d.day <= input.todayEpoch && d.kcal > 0);
  const weighInsInWindow = input.weighIns.filter((w) => w.day >= start && w.day <= input.todayEpoch);
  const loggedDays = loggedInWindow.length;
  const weighInsUsed = weighInsInWindow.length;

  if (loggedDays < MIN_LOGGED_DAYS || weighInsUsed < MIN_WEIGH_INS) {
    return learning(input, loggedDays, weighInsUsed);
  }

  // Trend over ALL weigh-ins (stable EWMA seeding), sampled at the window edges.
  const series = trendSeries(input.weighIns);
  const trendStartDay = Math.max(start, series[0]!.day);
  const trendEndDay = Math.min(input.todayEpoch, series[series.length - 1]!.day);
  const spanDays = trendEndDay - trendStartDay;
  const startKg = trendAt(series, trendStartDay);
  const endKg = trendAt(series, trendEndDay);
  if (spanDays < 1 || startKg == null || endKg == null) {
    return learning(input, loggedDays, weighInsUsed);
  }

  // A corrupt weigh-in (huge single-day trend jump) invalidates the whole window.
  if (maxTrendJump(series, trendStartDay, trendEndDay) > MAX_TREND_JUMP_KG) {
    return learning(input, loggedDays, weighInsUsed);
  }

  const intakeAvg = Math.round(loggedInWindow.reduce((a, d) => a + d.kcal, 0) / loggedDays);
  const trendDelta = endKg - startKg; // kg over the measured span
  // kcal/day the balance moved. Denominator is the ACTUAL measured span (not the
  // nominal window) so a partly-covered window still reads the right daily rate.
  const dailyBalance = Math.round((trendDelta * KCAL_PER_KG) / spanDays);
  const rawBurn = intakeAvg - dailyBalance;

  // Stability blend with last week's estimate, so the budget never lurches.
  const blended =
    input.previousEstimate != null
      ? Math.round(BLEND_CURRENT * rawBurn + (1 - BLEND_CURRENT) * input.previousEstimate)
      : Math.round(rawBurn);

  // Physiological guardrail: clamp to 1.2×–2.5× BMR.
  const bmr = mifflinStJeorBMR(input.body);
  const lo = Math.round(BURN_CLAMP_LO * bmr);
  const hi = Math.round(BURN_CLAMP_HI * bmr);
  const burn = clamp(blended, lo, hi);

  return {
    state: 'learned',
    burn,
    formulaTdee: input.formulaTdee,
    intakeAvg,
    dailyBalance,
    trendDelta,
    paceKgPerWeek: (trendDelta / spanDays) * 7,
    loggedDays,
    weighInsUsed,
    clamped: burn !== blended,
  };
}
