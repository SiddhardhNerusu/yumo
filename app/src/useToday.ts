import { useMemo } from 'react';
import {
  nextNudge,
  rankSlot,
  inferSlot,
  logEvents,
  localParts,
  daysBetween,
  firstEventTs,
  type PredictInput,
  type BrainEvent,
} from '@yumo/brain';
import type { MealSlot } from '@yumo/shared';
import { FOODS, SEED_MENU, PORTION_FALLBACK } from './data/seed';
import { buildCandidates } from './data/candidates';
import { getBrainConfig } from './data/brainConfig';
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
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  portionG: number | null;
  minutesOfDay: number;
}
export interface DaySlot {
  slot: MealSlot;
  /** foods logged into this slot today. */
  items: TimelineItem[];
  kcal: number;
  skipped: boolean;
  skipId: string | null;
  /** the slot the current time falls in (gets the prediction). */
  isCurrent: boolean;
}

export interface TodayState {
  slot: string;
  budget: number;
  eaten: number;
  remaining: number;
  usual: { foodId: string; name: string; portionG: number; kcal: number } | null;
  /** how a fired nudge is framed: 'confident' ("the usual?") vs 'menu'
   * (cold-start "your menu says … — did you have it?", §3.8). */
  usualFraming: 'confident' | 'menu' | null;
  tiles: Tile[];
  /** the day laid out by meal slot (§6.1) — breakfast/lunch/dinner/snack. */
  slots: DaySlot[];
  timeline: TimelineItem[];
  coach: string;
  /** warm, time-of-day greeting kicker for the header (§7.1). */
  greeting: string;
  /** the "magic moment" (§3.9): a day-of-week pattern the Brain has learned,
   * e.g. { note: 'Fridays are different' }. null when nothing new to surface. */
  learned: { note: string } | null;
  /** ED guardrail (§7.4): true when logged intake has run very low for ~5 days. */
  signpost: boolean;
  /** §3.8 cold start: <7 days of history → the Brain is still learning. */
  coldStart: boolean;
  /** name of what's already logged in the current slot today (null if open). */
  slotLogged: string | null;
  /** current slot marked "meal off" today (and not logged). */
  slotSkipped: boolean;
  /** id of the skip event, so it can be undone. */
  slotSkipId: string | null;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Absolute daily-intake floor for the ED signpost (§7.4). Conservative single
 * value (the lower of the 1,500 M / 1,200 F rate floors) so it only fires on
 * genuinely very-low intake and never false-alarms a normal cut. */
const SIGNPOST_FLOOR_KCAL = 1200;

/** Resolve a food's display name/kcal: seed FOODS first, then the event log's
 * own meta (so menu-accepted recipes / search hits — whose ids aren't in FOODS —
 * still show their real name + kcal instead of a raw id at 0 kcal). */
function resolver(events: BrainEvent[]): { name: (id: string) => string; kcal: (id: string) => number } {
  const fromLog = new Map<string, { name?: string; kcal?: number }>();
  for (const e of logEvents(events)) {
    if (!e.foodId) continue;
    const nm = typeof e.meta?.['name'] === 'string' ? (e.meta['name'] as string) : undefined;
    fromLog.set(e.foodId, { name: nm, kcal: e.kcal }); // last write wins = most recent
  }
  return {
    name: (id) => FOODS[id]?.name ?? fromLog.get(id)?.name ?? id,
    kcal: (id) => FOODS[id]?.kcal ?? fromLog.get(id)?.kcal ?? 0,
  };
}

export function useToday(events: BrainEvent[], nowMs: number, budget = 2200, tokens: string[] = []): TodayState {
  const tokenKey = tokens.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => compute(events, nowMs, budget, tokens), [events, nowMs, budget, tokenKey]);
}

function compute(events: BrainEvent[], now: number, budget: number, tokens: string[]): TodayState {
  const slot = inferSlot(now, 0);
  const input: PredictInput = {
    events,
    candidates: buildCandidates(events, SEED_MENU, tokens),
    slot,
    now,
    tzOffsetMin: 0,
    menu: SEED_MENU,
    config: getBrainConfig(),
    portionFallback: PORTION_FALLBACK,
  };

  const nudge = nextNudge(input);
  const { name: foodName, kcal: foodKcal } = resolver(events);
  // Only surface tiles we can actually render (known name + kcal) — never a raw id.
  const ranked = rankSlot(input)
    .filter((p) => FOODS[p.foodId] != null || foodKcal(p.foodId) > 0)
    .slice(0, 3);

  const usual =
    nudge.fire && nudge.prediction
      ? { foodId: nudge.prediction.foodId, name: foodName(nudge.prediction.foodId), portionG: nudge.prediction.portionG, kcal: foodKcal(nudge.prediction.foodId) }
      : null;
  const usualFraming = usual ? nudge.framing : null;

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
        proteinG: e.proteinG ?? null,
        carbsG: e.carbsG ?? null,
        fatG: e.fatG ?? null,
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

  // §6.1 whole-day layout by meal slot.
  const MEAL_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const slots: DaySlot[] = MEAL_ORDER.map((sl) => {
    const items = timeline.filter((t) => t.slot === sl);
    const kcal = items.reduce((s, i) => s + i.kcal, 0);
    const sk = events.filter(
      (e) => e.kind === 'skip_meal' && e.slot === sl && !deleted.has(e.id) && localParts(e.ts, 0).epochDay === todayEpochDay,
    );
    const skId = sk.length ? (sk[sk.length - 1]?.id ?? null) : null;
    return { slot: sl, items, kcal, skipped: skId !== null && items.length === 0, skipId: skId, isCurrent: sl === slot };
  });

  const parts = localParts(now, 0);
  const pick = parts.epochDay; // stable within a day, rotates day-to-day
  const greeting = greetingFor(parts.minutesOfDay, pick);
  const learned = detectLearned(events, now);
  const signpost = detectSignpost(events, now, SIGNPOST_FLOOR_KCAL);
  const coldStart = daysBetween(now, firstEventTs(events, now)) < getBrainConfig().coldStartDays;

  return { slot, budget, eaten, remaining, usual, usualFraming, tiles, slots, timeline, coach: coachLine(eaten, remaining, budget, pick), greeting, learned, signpost, coldStart, slotLogged, slotSkipped, slotSkipId };
}

function greetingFor(minutesOfDay: number, pick: number): string {
  const h = minutesOfDay / 60;
  const key = h < 12 ? 'greetMorning' : h < 17 ? 'greetAfternoon' : h < 22 ? 'greetEvening' : 'greetNight';
  return coach(key, {}, pick);
}

function coachLine(eaten: number, remaining: number, budget: number, pick: number): string {
  const r = remaining.toLocaleString();
  if (eaten === 0) return coach('todayFresh', { remaining: r }, pick);
  if (remaining <= 0) return coach('todayOver', {}, pick);
  if (remaining <= Math.max(150, Math.round(budget * 0.08))) return coach('todayNearBudget', { remaining: r }, pick);
  return coach('todayOnTrack', { remaining: r }, pick);
}

/** Top (id, count) of a tally map, or null when empty. */
function topOf(m: Map<string, number>): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null;
  for (const [id, count] of m) if (!best || count > best.count) best = { id, count };
  return best;
}

/**
 * §3.9 learning moment. When the food you reliably eat on *this* weekday differs
 * from your all-days default and has recurred ≥3×, the Brain has "learned" the
 * day is special — surface it as "Fridays are different". Needs real history, so
 * it stays quiet until a genuine pattern exists.
 */
function detectLearned(events: BrainEvent[], now: number): { note: string } | null {
  const logs = logEvents(events);
  if (logs.length < 6) return null;
  const todayDow = localParts(now, 0).dayOfWeek;
  const byDow = new Map<string, number>();
  const global = new Map<string, number>();
  for (const e of logs) {
    const fid = e.foodId;
    if (!fid || fid === 'quick') continue;
    global.set(fid, (global.get(fid) ?? 0) + 1);
    if (localParts(e.ts, 0).dayOfWeek === todayDow) byDow.set(fid, (byDow.get(fid) ?? 0) + 1);
  }
  const dowTop = topOf(byDow);
  const globalTop = topOf(global);
  if (!dowTop || !globalTop) return null;
  if (dowTop.count >= 3 && dowTop.id !== globalTop.id) {
    return { note: `${WEEKDAY[todayDow]}s are different` };
  }
  return null;
}

/**
 * §7.4 ED guardrail signpost. Looks at the 5 most recent *completed* logged days
 * (excludes today, so a half-logged day never triggers it) within a ~week
 * window; fires when their mean intake is below the floor. Non-punitive — the UI
 * offers support links, never a red state.
 */
function detectSignpost(events: BrainEvent[], now: number, floor: number): boolean {
  const today = localParts(now, 0).epochDay;
  const byDay = new Map<number, number>();
  for (const e of logEvents(events)) {
    const d = localParts(e.ts, 0).epochDay;
    if (d >= today) continue; // completed days only
    byDay.set(d, (byDay.get(d) ?? 0) + (e.kcal ?? 0));
  }
  const days = [...byDay.keys()].sort((a, b) => b - a).slice(0, 5);
  if (days.length < 5) return false;
  if ((days[0] as number) - (days[4] as number) > 6) return false; // roughly consecutive
  const mean = days.reduce((s, d) => s + (byDay.get(d) ?? 0), 0) / days.length;
  return mean < floor;
}
