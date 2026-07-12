import { logEvents, localParts, type BrainEvent } from '@yumo/brain';

/**
 * §6.3 streak with freeze. A day "counts" if it has a food log OR a logged skip
 * ("meal off" preserves the streak). Missing today doesn't reset — it *freezes*
 * (one grace day); two missed days in a row resets to zero.
 */
export function computeStreak(events: BrainEvent[], now: number): { current: number; frozen: boolean } {
  const active = activeDays(events);
  const today = localParts(now, 0).epochDay;

  let anchor: number;
  let frozen = false;
  if (active.has(today)) {
    anchor = today;
  } else if (active.has(today - 1)) {
    anchor = today - 1; // today missed → grace freeze, streak intact
    frozen = true;
  } else {
    return { current: 0, frozen: false }; // two+ missed → reset
  }

  let count = 0;
  for (let d = anchor; active.has(d); d--) count++;
  return { current: count, frozen };
}

/** §6.3 weekly adherence strip: the last 7 calendar days, each true if a food
 * was logged (days logged, not days "under"), oldest → today, with day labels. */
export function weeklyLogged(events: BrainEvent[], now: number): { logged: boolean[]; labels: string[] } {
  const days = new Set<number>();
  for (const e of logEvents(events)) days.add(localParts(e.ts, 0).epochDay);
  const today = localParts(now, 0).epochDay;
  const L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const logged: boolean[] = [];
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = today - i;
    logged.push(days.has(d));
    labels.push(L[((d % 7) + 4) % 7] as string); // epochDay 0 = Thursday
  }
  return { logged, labels };
}

/** Days (epochDay) with a food log or a non-deleted skip_meal. */
function activeDays(events: BrainEvent[]): Set<number> {
  const set = new Set<number>();
  for (const e of logEvents(events)) set.add(localParts(e.ts, 0).epochDay);

  const deleted = new Set<string>();
  for (const e of events) {
    if (e.kind === 'delete') {
      const t = e.meta?.['targetId'];
      if (typeof t === 'string') deleted.add(t);
    }
  }
  for (const e of events) {
    if (e.kind === 'skip_meal' && !deleted.has(e.id)) set.add(localParts(e.ts, 0).epochDay);
  }
  return set;
}
