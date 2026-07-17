import {
  nextNudge,
  logEvents,
  localParts,
  inferSlot,
  type BrainEvent,
  type WeekMenu,
} from '@yumo/brain';
import { SEED_MENU, PORTION_FALLBACK } from '../data/seed';
import { buildCandidates } from '../data/candidates';
import { getBrainConfig } from '../data/brainConfig';
import { resolveFoodMeta } from '../data/resolveFoodMeta';
import { DEMO_DATA } from '../data/demo';

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

/**
 * `menu` is the REAL generated week menu (via `weekMenuFor`) — without it the
 * widget can only ever suggest a demo food, or nothing at all in production.
 * SEED_MENU is used ONLY as a demo fallback (parity with `useToday`), never for
 * a real user. Everything else here is on the live prediction path — the same
 * `buildCandidates` / `getBrainConfig` / name-kcal resolver the app screen uses —
 * so the widget can never contradict what Today shows.
 */
export function widgetPayload(events: BrainEvent[], now: number, budget: number, menu?: WeekMenu): WidgetPayload {
  const slot = inferSlot(now, 0);
  const effectiveMenu = menu ?? (DEMO_DATA ? SEED_MENU : undefined);
  const nudge = nextNudge({
    events,
    candidates: buildCandidates(events, effectiveMenu ?? [], []),
    slot,
    now,
    tzOffsetMin: 0,
    menu: effectiveMenu,
    config: getBrainConfig(),
    portionFallback: PORTION_FALLBACK,
  });
  const { name: foodName, kcal: foodKcal } = resolveFoodMeta(events);

  const day = localParts(now, 0).epochDay;
  const eaten = logEvents(events)
    .filter((e) => localParts(e.ts, 0).epochDay === day)
    .reduce((s, e) => s + (e.kcal ?? 0), 0);

  const suggestion =
    nudge.fire && nudge.prediction
      ? {
          foodId: nudge.prediction.foodId,
          name: foodName(nudge.prediction.foodId),
          portionG: nudge.prediction.portionG,
          kcal: foodKcal(nudge.prediction.foodId),
        }
      : null;

  return {
    slot,
    ring: { eaten, budget, remaining: Math.max(0, budget - eaten) },
    suggestion,
    updatedAt: now,
  };
}
