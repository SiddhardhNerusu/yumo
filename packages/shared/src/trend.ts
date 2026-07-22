import type { DayKg } from './weightWindows';

/**
 * Trend weight — an exponentially-weighted moving average over the raw scale
 * weigh-ins (Overview §5 / True-burn §6). The scale is noisy (water, salt, time
 * of day); the trend is the signal. EVERY delta, pace, prediction, and the whole
 * True-burn energy balance reads THIS series, never the raw scale values.
 *
 * Two steps:
 *  1. Linear gap-interpolation to a value PER DAY between the first and last
 *     weigh-in, so a sparse log (weighed Mon + Fri) still yields a smooth daily
 *     series instead of a step function.
 *  2. A forward EWMA over that daily series. Recent days are weighted more via a
 *     ~10-day half-life — responsive enough to catch a real drift within a couple
 *     of weeks, damped enough to ignore a single heavy-dinner morning.
 *
 * Pure + deterministic (server/test-usable). One weigh-in per epoch-day is
 * assumed (the weigh-in store enforces that); if duplicates slip in, the last
 * value for that day wins.
 */

/** Half-life of the trend EWMA, in days. alpha = 1 − 0.5^(1/halfLife). */
export const TREND_HALFLIFE_DAYS = 10;

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Daily trend series from `first weigh-in day … last weigh-in day` (inclusive),
 * one point per day. Empty in → empty out.
 */
export function trendSeries(entries: DayKg[]): DayKg[] {
  if (entries.length === 0) return [];
  // sort + collapse to one kg per day (last wins) so interpolation is monotone in day
  const byDay = new Map<number, number>();
  for (const e of [...entries].sort((a, b) => a.day - b.day)) byDay.set(e.day, e.kg);
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const first = days[0]!;
  const last = days[days.length - 1]!;

  // 1. linear interpolation to a value per day
  const daily: number[] = [];
  let lo = 0; // index into `days` of the weigh-in at or before the current day
  for (let day = first; day <= last; day++) {
    while (lo + 1 < days.length && days[lo + 1]! <= day) lo++;
    const loDay = days[lo]!;
    const loKg = byDay.get(loDay)!;
    if (day === loDay || lo + 1 >= days.length) {
      daily.push(loKg);
    } else {
      const hiDay = days[lo + 1]!;
      const hiKg = byDay.get(hiDay)!;
      const t = (day - loDay) / (hiDay - loDay);
      daily.push(loKg + t * (hiKg - loKg));
    }
  }

  // 2. forward EWMA (seeded at the first interpolated value)
  const alpha = 1 - Math.pow(0.5, 1 / TREND_HALFLIFE_DAYS);
  const out: DayKg[] = [];
  let ewma = daily[0]!;
  for (let i = 0; i < daily.length; i++) {
    ewma = i === 0 ? daily[0]! : alpha * daily[i]! + (1 - alpha) * ewma;
    out.push({ day: first + i, kg: round2(ewma) });
  }
  return out;
}

/**
 * Trend weight (kg) at a given epoch-day, clamped to the series domain — days
 * before the first weigh-in read the first trend value, days after the last read
 * the last. `null` only when the series is empty. The series is day-contiguous,
 * so this is an O(1) index lookup.
 */
export function trendAt(series: DayKg[], day: number): number | null {
  if (series.length === 0) return null;
  const firstP = series[0]!;
  const lastP = series[series.length - 1]!;
  if (day <= firstP.day) return firstP.kg;
  if (day >= lastP.day) return lastP.kg;
  return series[day - firstP.day]?.kg ?? lastP.kg;
}

/**
 * The largest absolute day-over-day step in the trend series within
 * `[startDay, endDay]`. A step above ~1.5 kg means a fat-fingered weigh-in
 * corrupted the interpolation — callers (True burn) reject such a window.
 */
export function maxTrendJump(series: DayKg[], startDay: number, endDay: number): number {
  let prev: DayKg | null = null;
  let max = 0;
  for (const p of series) {
    if (p.day < startDay || p.day > endDay) continue;
    if (prev) max = Math.max(max, Math.abs(p.kg - prev.kg));
    prev = p;
  }
  return max;
}
