import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleShopReminder, cancelShopReminder } from './shopReminder';
import { track } from '../analytics';

/**
 * The weekly shop-day preference (Kitchen §5) — the day-of-week the shop-list push
 * fires (1 = Sun … 7 = Sat, expo's convention), or null for Off. A PROVIDER (like
 * WeightUnitProvider) so Settings and the notification wiring share one source.
 * Setting a day (re)schedules the local reminder and stores its id so a later
 * change can cancel it; native-only scheduling no-ops on web.
 */
const KEY = 'yumo.shopday.v1';

interface Stored {
  weekday: number | null;
  notifId: string | null;
  /** true = a day is picked but the user declined notification permission (native). */
  denied?: boolean;
}
interface ShopDayCtx {
  weekday: number | null;
  /** a day is set but no reminder is scheduled because notifications were declined. */
  denied: boolean;
  setShopDay: (weekday: number | null) => void;
}

const Ctx = createContext<ShopDayCtx | null>(null);

export function ShopDayProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>({ weekday: null, notifId: null });
  const ref = useRef(stored);
  ref.current = stored;
  const opRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v) as Stored;
        setStored((s) => (s.weekday != null ? s : parsed));
      } catch { /* corrupt — start Off */ }
    }).catch(() => {});
  }, []);

  const setShopDay = useCallback((weekday: number | null) => {
    // Serialize schedule/cancel so each call reads prevId only after the previous
    // one committed ref.current — otherwise two quick taps orphan a notification
    // whose id we then lose and can never cancel.
    opRef.current = opRef.current.then(async () => {
      const prevId = ref.current.notifId;
      if (prevId) await cancelShopReminder(prevId);
      let notifId: string | null = null;
      let denied = false;
      if (weekday != null) {
        const res = await scheduleShopReminder(weekday);
        if (res.status === 'scheduled') notifId = res.id;
        else if (res.status === 'denied') denied = true;
      }
      const next: Stored = { weekday, notifId, denied };
      ref.current = next;
      setStored(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      track('shop_day_set', { weekday: weekday ?? 0 });
    }).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ weekday: stored.weekday, denied: !!stored.denied, setShopDay }}>{children}</Ctx.Provider>;
}

export function useShopDay(): ShopDayCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('ShopDayProvider missing');
  return v;
}
