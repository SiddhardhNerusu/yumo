import {
  nextNudge,
  logEvents,
  localParts,
  inferSlot,
  DEFAULT_CONFIG,
  type BrainEvent,
} from '@yumo/brain';
import { FOODS, CANDIDATES, SEED_MENU, PORTION_FALLBACK } from '../data/seed';

/**
 * The exact data the lock-screen / home-screen widget renders (§3.7). This is
 * the RN→native contract: the app computes it (Brain runs on-device) and writes
 * it to the shared App Group; the WidgetKit / Glance view reads it. Kept small
 * and serialisable — no UI, no functions. See docs/native-widget.md.
 */
export interface WidgetPayload {
  slot: string;
  ring: { eaten: number; budget: number; remaining: number };
  /** the one-tap "the usual?" suggestion when confident; null → widget shows a
   * plain "Log" that deep-links into the app. */
  suggestion: { foodId: string; name: string; portionG: number; kcal: number } | null;
  updatedAt: number;
}

export function widgetPayload(events: BrainEvent[], now: number, budget: number): WidgetPayload {
  const slot = inferSlot(now, 0);
  const nudge = nextNudge({
    events,
    candidates: CANDIDATES[slot] ?? [],
    slot,
    now,
    tzOffsetMin: 0,
    menu: SEED_MENU,
    config: DEFAULT_CONFIG,
    portionFallback: PORTION_FALLBACK,
  });

  const day = localParts(now, 0).epochDay;
  const eaten = logEvents(events)
    .filter((e) => localParts(e.ts, 0).epochDay === day)
    .reduce((s, e) => s + (e.kcal ?? 0), 0);

  const suggestion =
    nudge.fire && nudge.prediction
      ? {
          foodId: nudge.prediction.foodId,
          name: FOODS[nudge.prediction.foodId]?.name ?? nudge.prediction.foodId,
          portionG: nudge.prediction.portionG,
          kcal: FOODS[nudge.prediction.foodId]?.kcal ?? 0,
        }
      : null;

  return {
    slot,
    ring: { eaten, budget, remaining: Math.max(0, budget - eaten) },
    suggestion,
    updatedAt: now,
  };
}
