import type { MealSlot } from '@usual/shared';
import type { BrainEvent, EventKind } from './events';
import { localParts, hoursBetween } from './time';
import type { BrainConfig } from './config';

/**
 * Recorded outcomes of a proactive nudge. The budget counts these as "nudges
 * fired". A shown-but-ignored nudge is expected to be recorded as a decline via
 * the notification callback (§3.6), so it counts too.
 */
export const NUDGE_OUTCOME_KINDS: ReadonlySet<EventKind> = new Set<EventKind>([
  'nudge_accept',
  'nudge_decline',
]);

function isNudgeOutcome(e: BrainEvent): boolean {
  return NUDGE_OUTCOME_KINDS.has(e.kind);
}

export interface NudgeDecision {
  allowed: boolean;
  reasons: string[];
}

/** Nudge outcomes on the same local calendar day as `now`. */
export function nudgeOutcomesToday(
  events: BrainEvent[],
  now: number,
  tzOffsetMin: number,
): BrainEvent[] {
  const today = localParts(now, tzOffsetMin).epochDay;
  return events.filter(
    (e) => isNudgeOutcome(e) && localParts(e.ts, e.tzOffsetMin).epochDay === today,
  );
}

/** A slot goes quiet after N consecutive declines, for `slotQuietHours` (§3.6). */
export function slotIsQuiet(
  events: BrainEvent[],
  slot: MealSlot,
  now: number,
  config: BrainConfig,
): boolean {
  const outcomes = events
    .filter((e) => isNudgeOutcome(e) && e.slot === slot)
    .sort((a, b) => b.ts - a.ts);
  let leadingDeclines = 0;
  for (const e of outcomes) {
    if (e.kind === 'nudge_decline') leadingDeclines++;
    else break;
  }
  if (leadingDeclines < config.nudge.slotQuietAfterDeclines) return false;
  const latest = outcomes[0];
  return !!latest && hoursBetween(now, latest.ts) < config.nudge.slotQuietHours;
}

/** A food is suppressed from a slot's nudges after K declines within the window (§3.6). */
export function foodSuppressed(
  events: BrainEvent[],
  foodId: string,
  slot: MealSlot,
  now: number,
  config: BrainConfig,
): boolean {
  const cutoff = now - config.nudge.foodSuppressDays * 86_400_000;
  const declines = events.filter(
    (e) =>
      e.kind === 'nudge_decline' &&
      e.foodId === foodId &&
      e.slot === slot &&
      e.ts >= cutoff,
  ).length;
  return declines >= config.nudge.foodSuppressAfterDeclines;
}

/** The hard gate: may we fire a proactive nudge for (foodId, slot) right now? */
export function canNudge(
  events: BrainEvent[],
  foodId: string,
  slot: MealSlot,
  now: number,
  tzOffsetMin: number,
  config: BrainConfig,
): NudgeDecision {
  const reasons: string[] = [];
  const today = nudgeOutcomesToday(events, now, tzOffsetMin);

  if (today.length >= config.nudge.maxPerDay) reasons.push('daily nudge budget reached');
  if (today.filter((e) => e.slot === slot).length >= config.nudge.maxPerSlotPerDay) {
    reasons.push('slot nudge budget reached');
  }
  if (slotIsQuiet(events, slot, now, config)) reasons.push('slot quiet after consecutive declines');
  if (foodSuppressed(events, foodId, slot, now, config)) {
    reasons.push('food suppressed after repeated declines');
  }

  return { allowed: reasons.length === 0, reasons };
}
