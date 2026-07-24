import { logEvents, type BrainEvent } from '@yumo/brain';
import { FOODS } from './seed';
import { POOL_BY_ID } from './menu-seed';

/**
 * Resolve a food's display name/kcal: seed FOODS first, then the recipe catalogue
 * (so a menu-predicted dish the user hasn't logged shows its real name, not the
 * raw id), then the event log's own meta (search hits / saved meals whose ids
 * aren't in either), then a last-resort id.
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
    name: (id) => FOODS[id]?.name ?? POOL_BY_ID.get(id)?.name ?? fromLog.get(id)?.name ?? id,
    kcal: (id) => {
      const pool = POOL_BY_ID.get(id);
      return FOODS[id]?.kcal ?? (pool ? Math.round(pool.perServing.kcal) : undefined) ?? fromLog.get(id)?.kcal ?? 0;
    },
  };
}
