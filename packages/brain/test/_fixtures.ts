import type { MealSlot } from '@yumo/shared';
import type { BrainEvent, EventKind } from '../src/events';

export const DAY = 86_400_000;
const HOUR = 3_600_000;

// A fixed "today": epoch day 19723 at 12:00 UTC. With tzOffsetMin 0 that is a
// Monday noon (epoch day 0 = Thursday), which the tests rely on for day-of-week.
export const TODAY_DAY = 19723;
export const NOW = TODAY_DAY * DAY + 12 * HOUR;

let seq = 0;
export function resetIds(): void {
  seq = 0;
}

/** A timestamp `daysAgo` before today, at local `hour:min` (tz 0). */
export function tsAt(daysAgo: number, hour: number, min = 0): number {
  return (TODAY_DAY - daysAgo) * DAY + hour * HOUR + min * 60_000;
}

export function ev(partial: Partial<BrainEvent> & { kind: EventKind }): BrainEvent {
  return {
    id: `e${seq++}`,
    ts: NOW,
    tzOffsetMin: 0,
    ...partial,
  };
}

/** A food-log event `daysAgo` at `hour`. */
export function log(
  foodId: string,
  slot: MealSlot,
  daysAgo: number,
  hour: number,
  portionG?: number,
): BrainEvent {
  return ev({ kind: 'log', foodId, slot, portionG, ts: tsAt(daysAgo, hour) });
}

export function decline(foodId: string, slot: MealSlot, daysAgo: number, hour: number): BrainEvent {
  return ev({ kind: 'nudge_decline', foodId, slot, ts: tsAt(daysAgo, hour) });
}

export function accept(foodId: string, slot: MealSlot, daysAgo: number, hour: number): BrainEvent {
  return ev({ kind: 'nudge_accept', foodId, slot, ts: tsAt(daysAgo, hour) });
}

/** N days of the same food at the same slot/time — a strong habit. */
export function habit(
  foodId: string,
  slot: MealSlot,
  days: number,
  hour: number,
  portionG?: number,
): BrainEvent[] {
  const out: BrainEvent[] = [];
  for (let d = 1; d <= days; d++) out.push(log(foodId, slot, d, hour, portionG));
  return out;
}
