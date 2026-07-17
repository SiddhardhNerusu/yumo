import { logEvents, type BrainEvent } from '@yumo/brain';
import { FOODS } from './seed';

/**
 * Resolve a food's display name/kcal: seed FOODS first, then the event log's own
 * meta (so menu-accepted recipes / search hits / saved meals — whose ids aren't
 * in FOODS — still show their real name + kcal instead of a raw id at 0 kcal).
 *
 * Single source of truth, shared by `useToday`, the widget payload, and (later)
 * the nudge notification copy — do NOT copy this resolution logic anywhere else.
 */
export function resolveFoodMeta(events: BrainEvent[]): { name: (id: string) => string; kcal: (id: string) => number } {
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
