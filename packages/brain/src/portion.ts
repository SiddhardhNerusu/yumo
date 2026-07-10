import type { MealSlot } from '@usual/shared';
import type { BrainEvent } from './events';
import { logEvents } from './events';
import { median } from './time';
import { menuPortion, type WeekMenu } from './menu';

export interface PortionOptions {
  /** food-graph default portion, used before any logs exist. */
  fallbackG?: number;
  menu?: WeekMenu;
  dayOfWeek?: number;
  slot?: MealSlot;
  /** how many recent logs to median over (§3.5: last 5). */
  sampleSize?: number;
}

/**
 * Learned portion (§3.5): median of the last N logged portions of F. Before any
 * logs, seed from the menu quantity, else the food-graph default, else 0.
 */
export function learnedPortion(
  events: BrainEvent[],
  foodId: string,
  opts: PortionOptions = {},
): number {
  const sampleSize = opts.sampleSize ?? 5;
  const portions = logEvents(events)
    .filter((e) => e.foodId === foodId && typeof e.portionG === 'number')
    .map((e) => e.portionG as number);

  const recent = portions.slice(-sampleSize);
  if (recent.length > 0) return Math.round(median(recent));

  if (opts.menu && opts.dayOfWeek != null && opts.slot) {
    const seed = menuPortion(opts.menu, opts.dayOfWeek, opts.slot, foodId);
    if (seed != null) return seed;
  }
  return opts.fallbackG ?? 0;
}

export interface PortionChips {
  less: number;
  usual: number;
  more: number;
}

/** Confirm chips [bit less −25%] [✓ usual] [bit more +25%], rounded to 5g. */
export function portionChips(baseG: number): PortionChips {
  const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);
  return { less: round5(baseG * 0.75), usual: round5(baseG), more: round5(baseG * 1.25) };
}
