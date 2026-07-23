import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleShopReminder, cancelShopReminder } from './shopReminder';

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
}
interface ShopDayCtx {
  weekday: number | null;
  setShopDay: (weekday: number | null) => void;
}

const Ctx = createContext<ShopDayCtx | null>(null);

export function ShopDayProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>({ weekday: null, notifId: null });
  const ref = useRef(stored);
  ref.current = stored;

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v) as Stored;
        setStored((s) => (s.weekday != null ? s : parsed));
      } catch { /* corrupt — start Off */ }
    }).catch(() => {});
  }, []);

  const setShopDay = useCallback(async (weekday: number | null) => {
    const prevId = ref.current.notifId;
    if (prevId) await cancelShopReminder(prevId);
    const notifId = weekday != null ? await scheduleShopReminder(weekday) : null;
    const next: Stored = { weekday, notifId };
    ref.current = next;
    setStored(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ weekday: stored.weekday, setShopDay }}>{children}</Ctx.Provider>;
}

export function useShopDay(): ShopDayCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('ShopDayProvider missing');
  return v;
}
