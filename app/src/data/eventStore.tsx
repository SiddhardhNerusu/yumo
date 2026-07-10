import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { inferSlot, type BrainEvent } from '@usual/brain';
import type { MealSlot } from '@usual/shared';
import { FOODS, buildSeedHistory } from './seed';
import { api } from '../api/client';

interface EventStore {
  events: BrainEvent[];
  logFood: (foodId: string, opts?: { slot?: MealSlot; portionG?: number; kcal?: number; name?: string }) => void;
}

const Ctx = createContext<EventStore | null>(null);
let idc = 0;

/**
 * The live event log (§3.2). Seeded with history, then live logs append on top.
 * Each log fires an opaque sync to the server (real encryption is a later
 * concern). In-memory for now; AsyncStorage/SQLite persistence is a follow-up.
 */
export function EventStoreProvider({ children }: { children: ReactNode }) {
  const [initNow] = useState(() => Date.now());
  const [events, setEvents] = useState<BrainEvent[]>(() => buildSeedHistory(initNow));

  const logFood = useCallback(
    (foodId: string, opts: { slot?: MealSlot; portionG?: number; kcal?: number; name?: string } = {}) => {
      const now = Date.now();
      const meta = FOODS[foodId];
      const name = opts.name ?? meta?.name;
      const ev: BrainEvent = {
        id: `log-${idc++}-${now}`,
        ts: now,
        tzOffsetMin: 0,
        kind: 'log',
        foodId,
        slot: opts.slot ?? inferSlot(now, 0),
        portionG: opts.portionG ?? meta?.portionG,
        kcal: opts.kcal ?? meta?.kcal,
        ...(name ? { meta: { name } } : {}),
      };
      setEvents((prev) => [...prev, ev]);
      api.syncEvents(JSON.stringify(ev), 1).catch(() => {}); // fire-and-forget; offline-safe
    },
    [],
  );

  return <Ctx.Provider value={{ events, logFood }}>{children}</Ctx.Provider>;
}

export function useEventStore(): EventStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('EventStoreProvider missing');
  return v;
}
