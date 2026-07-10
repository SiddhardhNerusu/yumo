import { useMemo } from 'react';
import {
  nextNudge,
  rankSlot,
  inferSlot,
  logEvents,
  localParts,
  DEFAULT_CONFIG,
  type PredictInput,
  type BrainEvent,
} from '@usual/brain';
import { FOODS, CANDIDATES, SEED_MENU, PORTION_FALLBACK } from './data/seed';
import { coach } from './coach/pack';

export interface Tile {
  foodId: string;
  name: string;
  kcal: number;
  portionG: number;
}
export interface TimelineItem {
  id: string;
  foodId: string | null;
  name: string;
  slot: string;
  kcal: number;
  portionG: number | null;
  minutesOfDay: number;
}
export interface TodayState {
  slot: string;
  budget: number;
  eaten: number;
  remaining: number;
  usual: { foodId: string; name: string; portionG: number } | null;
  tiles: Tile[];
  timeline: TimelineItem[];
  coach: string;
  /** name of what's already logged in the current slot today (null if open). */
  slotLogged: string | null;
  /** current slot marked "meal off" today (and not logged). */
  slotSkipped: boolean;
  /** id of the skip event, so it can be undone. */
  slotSkipId: string | null;
}

const foodName = (id: string) => FOODS[id]?.name ?? id;
const foodKcal = (id: string) => FOODS[id]?.kcal ?? 0;

export function useToday(events: BrainEvent[], nowMs: number, budget = 2200): TodayState {
  return useMemo(() => compute(events, nowMs, budget), [events, nowMs, budget]);
}

function compute(events: BrainEvent[], now: number, budget: number): TodayState {
  const slot = inferSlot(now, 0);
  const input: PredictInput = {
    events,
    candidates: CANDIDATES[slot] ?? [],
    slot,
    now,
    tzOffsetMin: 0,
    menu: SEED_MENU,
    config: DEFAULT_CONFIG,
    portionFallback: PORTION_FALLBACK,
  };

  const nudge = nextNudge(input);
  const ranked = rankSlot(input).slice(0, 3);

  const usual =
    nudge.fire && nudge.prediction
      ? { foodId: nudge.prediction.foodId, name: foodName(nudge.prediction.foodId), portionG: nudge.prediction.portionG }
      : null;

  const tiles: Tile[] = ranked.map((p) => ({ foodId: p.foodId, name: foodName(p.foodId), kcal: foodKcal(p.foodId), portionG: p.portionG }));

  const todayEpochDay = localParts(now, 0).epochDay;
  const todaysLogs = logEvents(events).filter((e) => localParts(e.ts, 0).epochDay === todayEpochDay);
  const eaten = todaysLogs.reduce((s, e) => s + (e.kcal ?? 0), 0);
  const remaining = Math.max(0, budget - eaten);

  const timeline: TimelineItem[] = todaysLogs
    .map((e) => {
      const metaName = typeof e.meta?.['name'] === 'string' ? (e.meta['name'] as string) : null;
      return {
        id: e.id,
        foodId: e.foodId ?? null,
        name: metaName ?? (e.foodId ? foodName(e.foodId) : 'meal'),
        slot: e.slot ?? '',
        kcal: e.kcal ?? 0,
        portionG: e.portionG ?? null,
        minutesOfDay: localParts(e.ts, 0).minutesOfDay,
      };
    })
    .sort((a, b) => a.minutesOfDay - b.minutesOfDay);

  const slotLogs = todaysLogs.filter((e) => e.slot === slot && e.foodId);
  const last = slotLogs[slotLogs.length - 1];
  const slotLogged = last?.foodId ? foodName(last.foodId) : null;

  // Skip / fasting: a skip_meal for the current slot today, not soft-deleted.
  const deleted = new Set(
    events
      .filter((e) => e.kind === 'delete')
      .map((e) => e.meta?.['targetId'])
      .filter((x): x is string => typeof x === 'string'),
  );
  const skips = events.filter(
    (e) => e.kind === 'skip_meal' && e.slot === slot && !deleted.has(e.id) && localParts(e.ts, 0).epochDay === todayEpochDay,
  );
  const slotSkipId = skips.length ? (skips[skips.length - 1]?.id ?? null) : null;
  const slotSkipped = slotSkipId !== null && slotLogged === null;

  return { slot, budget, eaten, remaining, usual, tiles, timeline, coach: coachLine(eaten, remaining), slotLogged, slotSkipped, slotSkipId };
}

function coachLine(eaten: number, remaining: number): string {
  if (eaten === 0) return coach('todayFresh', { remaining: remaining.toLocaleString() });
  if (remaining <= 0) return coach('todayOver');
  return coach('todayOnTrack', { remaining: remaining.toLocaleString() });
}
