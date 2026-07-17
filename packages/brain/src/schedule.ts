import type { MealSlot } from '@yumo/shared';
import { logEvents, type BrainEvent } from './events';
import { localParts, median } from './time';

/**
 * Nudge scheduling primitives (§M1, pure core). The notification firing itself
 * is device-only (expo-notifications), but WHEN to fire is derived here and
 * unit-tested: the median time-of-day the user logs a given slot, then the next
 * absolute fire timestamp `leadTimeMin` before it.
 *
 * ⚠️ Two traps the plan flags, handled here:
 *  - `median([])` returns 0 (= midnight), NOT a sensible default — so
 *    medianLogMinute returns null on no history and the caller supplies the slot
 *    fallback; never schedule at 0.
 *  - median of raw minutes has no circular wrap (a snack at 23:50 + 00:10 medians
 *    to noon). Accepted for v1; documented so it isn't mistaken for a bug.
 */

/** Median minute-of-day the user logs `slot`, from history — null if none. */
export function medianLogMinute(events: BrainEvent[], slot: MealSlot): number | null {
  const mins = logEvents(events)
    .filter((e) => e.slot === slot)
    .map((e) => localParts(e.ts, e.tzOffsetMin).minutesOfDay);
  if (!mins.length) return null;
  return Math.round(median(mins));
}

/**
 * Next absolute fire timestamp for a nudge, `leadMin` minutes before the target
 * minute-of-day. If that moment already passed today, schedule tomorrow. UTC
 * frame (tzOffsetMin, matching the app's day model), so the epoch-ms round-trips
 * localParts — the caller must not re-localise it against device time.
 */
export function nextFireTs(now: number, targetMinuteOfDay: number, leadMin: number, tzOffsetMin: number): number {
  const p = localParts(now, tzOffsetMin);
  const fireMin = ((targetMinuteOfDay - leadMin) % 1440 + 1440) % 1440; // wrap into [0,1440)
  const dayStartMs = (p.epochDay * 1440 - tzOffsetMin) * 60_000; // UTC ms at local midnight
  let ts = dayStartMs + fireMin * 60_000;
  if (ts <= now) ts += 86_400_000; // already passed → tomorrow
  return ts;
}
