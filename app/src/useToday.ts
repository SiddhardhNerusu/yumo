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

export interface Tile {
  foodId: string;
  name: string;
  kcal: number;
  portionG: number;
}
export interface TimelineItem {
  name: string;
  slot: string;
  kcal: number;
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
        name: metaName ?? (e.foodId ? foodName(e.foodId) : 'meal'),
        slot: e.slot ?? '',
        kcal: e.kcal ?? 0,
        minutesOfDay: localParts(e.ts, 0).minutesOfDay,
      };
    })
    .sort((a, b) => a.minutesOfDay - b.minutesOfDay);

  const slotLogs = todaysLogs.filter((e) => e.slot === slot && e.foodId);
  const last = slotLogs[slotLogs.length - 1];
  const slotLogged = last?.foodId ? foodName(last.foodId) : null;

  return { slot, budget, eaten, remaining, usual, tiles, timeline, coach: coachLine(eaten, remaining), slotLogged };
}

function coachLine(eaten: number, remaining: number): string {
  if (eaten === 0) return `Fresh day — ${remaining.toLocaleString()} kcal to work with.`;
  if (remaining <= 0) return `Big day today — tomorrow's a fresh one.`;
  return `Nicely on track — ${remaining.toLocaleString()} kcal left.`;
}
