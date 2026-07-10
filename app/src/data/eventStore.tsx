import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inferSlot, type BrainEvent } from '@usual/brain';
import type { MealSlot } from '@usual/shared';
import { FOODS, buildSeedHistory } from './seed';
import { api } from '../api/client';

const STORAGE_KEY = 'usual.eventlog.v1';

interface EventStore {
  events: BrainEvent[];
  logFood: (foodId: string, opts?: { slot?: MealSlot; portionG?: number; kcal?: number; name?: string }) => void;
  deleteLog: (targetEventId: string) => void;
  skipMeal: (slot: MealSlot) => void;
}

const Ctx = createContext<EventStore | null>(null);
let idc = 0;

/**
 * The live event log (§3.2). The demo history is regenerated each launch; the
 * user's real logs are persisted (AsyncStorage → localStorage on web) so they
 * survive a reload, and each log fires an opaque sync to the server. Real blob
 * encryption + SQLite are follow-ups (§8.2).
 */
export function EventStoreProvider({ children }: { children: ReactNode }) {
  const [initNow] = useState(() => Date.now());
  const seed = useMemo(() => buildSeedHistory(initNow), [initNow]);
  const [userLogs, setUserLogs] = useState<BrainEvent[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!alive || !v) return;
        try {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) setUserLogs(parsed as BrainEvent[]);
        } catch {
          // ignore corrupt cache
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const events = useMemo(() => [...seed, ...userLogs], [seed, userLogs]);

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
      setUserLogs((prev) => {
        const next = [...prev, ev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      api.syncEvents(JSON.stringify(ev), 1).catch(() => {}); // fire-and-forget; offline-safe
    },
    [],
  );

  // Soft-delete (§3.2): a delete event referencing the original id. The Brain's
  // logEvents() excludes it, so the ring/timeline/predictions all recompute.
  const deleteLog = useCallback((targetEventId: string) => {
    const now = Date.now();
    const ev: BrainEvent = { id: `del-${idc++}-${now}`, ts: now, tzOffsetMin: 0, kind: 'delete', meta: { targetId: targetEventId } };
    setUserLogs((prev) => {
      const next = [...prev, ev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Skip / fasting (§5.8): a streak-safe "meal off". Not a log kind, so it never
  // touches the ring; it just marks the slot handled and quiets the Brain there.
  const skipMeal = useCallback((slot: MealSlot) => {
    const now = Date.now();
    const ev: BrainEvent = { id: `skip-${idc++}-${now}`, ts: now, tzOffsetMin: 0, kind: 'skip_meal', slot };
    setUserLogs((prev) => {
      const next = [...prev, ev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    api.syncEvents(JSON.stringify(ev), 1).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ events, logFood, deleteLog, skipMeal }}>{children}</Ctx.Provider>;
}

export function useEventStore(): EventStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('EventStoreProvider missing');
  return v;
}
