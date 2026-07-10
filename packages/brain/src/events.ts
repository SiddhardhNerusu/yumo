import type { MealSlot } from '@usual/shared';

/**
 * Append-only event log (§3.2). This is the single source of truth the Brain
 * learns from. Deletes are soft: a `delete` event referencing the original id.
 */
export type EventKind =
  | 'log'
  | 'nudge_accept'
  | 'nudge_decline'
  | 'tile_tap'
  | 'search_log'
  | 'barcode_log'
  | 'photo_log'
  | 'menu_accept'
  | 'menu_swap'
  | 'mixup_pick'
  | 'portion_edit'
  | 'delete'
  | 'skip_meal'
  | 'onboard_bubble'
  | 'pantry_edit';

export interface BrainEvent {
  id: string;
  /** epoch ms. */
  ts: number;
  /** minutes east of UTC at log time (see time.ts). */
  tzOffsetMin: number;
  kind: EventKind;
  foodId?: string;
  slot?: MealSlot;
  portionG?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** free-form: e.g. { targetId } on a delete, { source } on a log. */
  meta?: Record<string, unknown>;
}

/** Kinds that represent a food actually being logged/eaten. */
export const LOG_KINDS: ReadonlySet<EventKind> = new Set<EventKind>([
  'log',
  'nudge_accept',
  'tile_tap',
  'search_log',
  'barcode_log',
  'photo_log',
  'menu_accept',
  'mixup_pick',
]);

export function isLogKind(kind: EventKind): boolean {
  return LOG_KINDS.has(kind);
}

/** Ids cancelled by a later soft-delete event (meta.targetId). */
function deletedIds(events: BrainEvent[]): Set<string> {
  const set = new Set<string>();
  for (const e of events) {
    if (e.kind === 'delete') {
      const target = e.meta?.['targetId'];
      if (typeof target === 'string') set.add(target);
    }
  }
  return set;
}

/**
 * Effective log events: food-logging kinds with a foodId, minus any that were
 * soft-deleted. Sorted ascending by ts.
 */
export function logEvents(events: BrainEvent[]): BrainEvent[] {
  const deleted = deletedIds(events);
  return events
    .filter((e) => isLogKind(e.kind) && e.foodId != null && !deleted.has(e.id))
    .sort((a, b) => a.ts - b.ts);
}

export function eventsOfFood(events: BrainEvent[], foodId: string): BrainEvent[] {
  return events.filter((e) => e.foodId === foodId);
}

export function eventsInSlot(events: BrainEvent[], slot: MealSlot): BrainEvent[] {
  return events.filter((e) => e.slot === slot);
}

export function eventsInWindow(events: BrainEvent[], now: number, windowDays: number): BrainEvent[] {
  const cutoff = now - windowDays * 86_400_000;
  return events.filter((e) => e.ts >= cutoff && e.ts <= now);
}

/** Distinct food ids that appear anywhere in the effective log. */
export function loggedFoodIds(events: BrainEvent[]): string[] {
  const set = new Set<string>();
  for (const e of logEvents(events)) if (e.foodId) set.add(e.foodId);
  return [...set];
}

/** ts of the earliest event (for cold-start day counting), or `now` if empty. */
export function firstEventTs(events: BrainEvent[], now: number): number {
  let min = now;
  for (const e of events) if (e.ts < min) min = e.ts;
  return min;
}
