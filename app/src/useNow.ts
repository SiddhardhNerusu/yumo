import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A `now` that stays current across the local-midnight boundary and app resume.
 *
 * Screens used to capture `Date.now()` once with `useState(() => Date.now())`.
 * Left open across midnight, every day-scoped computation (the ring's `eaten`,
 * which slot is "today", the double-log guard) kept referencing yesterday — so a
 * meal logged after midnight vanished from the ring and could be re-logged (and
 * the pantry re-decremented). This refreshes `now` when it actually matters:
 * at the next local midnight (+a few seconds of slack) and whenever the app
 * returns to the foreground. No per-second interval — nothing here needs it.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const d = new Date();
      const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime();
      timer = setTimeout(() => { setNow(Date.now()); scheduleMidnight(); }, Math.max(1000, nextMidnight - Date.now()));
    };
    scheduleMidnight();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setNow(Date.now()); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
  return now;
}
