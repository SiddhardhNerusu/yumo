import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '../haptics';
import { inferSlot, type BrainEvent, type EventKind } from '@yumo/brain';
import type { MealSlot } from '@yumo/shared';
import { FOODS, buildSeedHistory } from './seed';
import { DEMO_DATA } from './demo';
import { api } from '../api/client';
import { track } from '../analytics';

const STORAGE_KEY = 'usual.eventlog.v1';

/** Which log surface produced the event → its §3.2 event kind. Keeping these
 * distinct (not all 'log') is what lets the Brain read nudge accepts, tile taps,
 * menu accepts and mix-up picks as the preference signals they are. */
const SOURCE_KIND: Record<string, EventKind> = {
  usual: 'nudge_accept',
  tile: 'tile_tap',
  search: 'search_log',
  barcode: 'barcode_log',
  menu: 'menu_accept',
  cooknow: 'menu_accept', // §8 "Tonight you can make…" cook-now log (distinct source for the north star)
  recent: 'log',
  quickadd: 'log',
  edit: 'log',
  mymeal: 'log', // §M5 saved-meal one-tap (explicit; SOURCE_KIND[…] ?? 'log' already yields this)
};

interface LogOpts {
  slot?: MealSlot;
  portionG?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  name?: string;
  source?: string;
  taps?: number;
  /** M2 backfill: pin the event's `ts` to a past day (id uniqueness stays on the
   * real Date.now(), so re-logging the same past (day,slot) never collides). */
  ts?: number;
  /** ms from surface-open to log, for §10 log_completed{ms}. */
  tookMs?: number;
  /** extra event meta (e.g. cuisine, swapFrom) merged into the event. */
  meta?: Record<string, unknown>;
}

interface EventStore {
  events: BrainEvent[];
  logFood: (foodId: string, opts?: LogOpts) => void;
  deleteLog: (targetEventId: string) => void;
  skipMeal: (slot: MealSlot) => void;
  /** §3.6 "Something else →": record a decline so the nudge budget quiets the
   * slot / suppresses the food. Not a log kind — never touches the ring. */
  declineNudge: (foodId: string, slot: MealSlot) => void;
  /** §4.3.3 mix-it-up plan swap: a preference signal (not eaten) that re-weights
   * future menu generation. chosenId = the alternative picked. */
  recordMixupPick: (chosenId: string, fromId: string, slot: MealSlot) => void;
  /** §8 one-tap 👍/👎 on a recipe → the hardest learned-preference signal.
   * Not a log kind (never touches the ring). Re-tapping the same way is a no-op. */
  thumbRecipe: (recipeId: string, dir: 'up' | 'down') => void;
  /** latest thumb per recipe id, for the button's active state. */
  thumbs: Map<string, 'up' | 'down'>;
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
  // Demo history populates the dev preview only — real users start with an empty
  // log so the ring/streak/Brain reflect their own eating, never a fake persona.
  const seed = useMemo(() => (DEMO_DATA ? buildSeedHistory(initNow) : []), [initNow]);
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
    (foodId: string, opts: LogOpts = {}) => {
      // nowReal drives id uniqueness (and resets to 0 with idc on reload, so the
      // real clock is what keeps ids distinct); ts is what the event is dated to,
      // which M2 backfill can pin to a past day. They MUST stay separate — a single
      // `now = opts.ts ?? Date.now()` would make backfilled ids deterministic and
      // collide across reloads (one deleteLog would soft-delete both rows).
      const nowReal = Date.now();
      const ts = opts.ts ?? nowReal;
      const meta = FOODS[foodId];
      const name = opts.name ?? meta?.name;
      const source = opts.source ?? 'unknown';
      const evMeta = { ...(name ? { name } : {}), ...(opts.meta ?? {}) };
      const ev: BrainEvent = {
        id: `log-${idc++}-${nowReal}`,
        ts,
        tzOffsetMin: 0,
        kind: SOURCE_KIND[source] ?? 'log',
        foodId,
        slot: opts.slot ?? inferSlot(nowReal, 0),
        portionG: opts.portionG ?? meta?.portionG,
        kcal: opts.kcal ?? meta?.kcal,
        ...(opts.proteinG != null ? { proteinG: opts.proteinG } : {}),
        ...(opts.carbsG != null ? { carbsG: opts.carbsG } : {}),
        ...(opts.fatG != null ? { fatG: opts.fatG } : {}),
        ...(Object.keys(evMeta).length ? { meta: evMeta } : {}),
      };
      setUserLogs((prev) => {
        const next = [...prev, ev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      api.syncEvents(JSON.stringify(ev), 1).catch(() => {}); // fire-and-forget; offline-safe
      haptics.success(); // the satisfying "logged" beat
      track('log_completed', { source, slot: ev.slot ?? '', taps: opts.taps ?? 1, ...(opts.tookMs != null ? { ms: Math.round(opts.tookMs) } : {}) });
      if (ev.kind === 'nudge_accept') track('nudge_accepted', { foodId });
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

  // §3.6 nudge decline: feeds the budget state machine (2 declines → slot quiet
  // 48h; 3 declines of a food → suppressed 14d). Offline-safe sync.
  const declineNudge = useCallback((foodId: string, slot: MealSlot) => {
    const now = Date.now();
    const ev: BrainEvent = { id: `dec-${idc++}-${now}`, ts: now, tzOffsetMin: 0, kind: 'nudge_decline', foodId, slot };
    setUserLogs((prev) => {
      const next = [...prev, ev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    api.syncEvents(JSON.stringify(ev), 1).catch(() => {});
    track('nudge_declined', { foodId, slot });
  }, []);

  const recordMixupPick = useCallback((chosenId: string, fromId: string, slot: MealSlot) => {
    const now = Date.now();
    const ev: BrainEvent = { id: `mix-${idc++}-${now}`, ts: now, tzOffsetMin: 0, kind: 'mixup_pick', foodId: chosenId, slot, meta: { swapFrom: fromId } };
    setUserLogs((prev) => {
      const next = [...prev, ev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    api.syncEvents(JSON.stringify(ev), 1).catch(() => {});
    track('mixup_picked', { chosenId });
    track('menu_swapped', { fromId, toId: chosenId, slot });
  }, []);

  // §8 latest 👍/👎 per recipe, derived from the log (most recent thumb wins).
  const thumbs = useMemo(() => {
    const m = new Map<string, 'up' | 'down'>();
    for (const e of events) {
      if (!e.foodId) continue;
      if (e.kind === 'recipe_thumb_up') m.set(e.foodId, 'up');
      else if (e.kind === 'recipe_thumb_down') m.set(e.foodId, 'down');
    }
    return m;
  }, [events]);
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;

  const thumbRecipe = useCallback((recipeId: string, dir: 'up' | 'down') => {
    if (thumbsRef.current.get(recipeId) === dir) return; // already this way — no duplicate signal
    const now = Date.now();
    const ev: BrainEvent = { id: `thumb-${idc++}-${now}`, ts: now, tzOffsetMin: 0, kind: dir === 'up' ? 'recipe_thumb_up' : 'recipe_thumb_down', foodId: recipeId };
    setUserLogs((prev) => {
      const next = [...prev, ev];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    api.syncEvents(JSON.stringify(ev), 1).catch(() => {});
    haptics.tap();
    track('recipe_thumb', { recipeId, dir });
  }, []);

  return <Ctx.Provider value={{ events, logFood, deleteLog, skipMeal, declineNudge, recordMixupPick, thumbRecipe, thumbs }}>{children}</Ctx.Provider>;
}

export function useEventStore(): EventStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('EventStoreProvider missing');
  return v;
}
