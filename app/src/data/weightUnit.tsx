import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit } from '@yumo/shared';

/**
 * Weight-unit preference (kg/lb/st). A PROVIDER, not a plain hook: Settings is
 * rendered inside Progress, so a local-state hook there would leave
 * Progress/Overview/WeightSheet on a stale unit until remount. Same shape as
 * EntitlementProvider. Storage is still always kg — this is display only.
 */
const KEY = 'yumo.units.v1';

interface WeightUnitCtx {
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => void;
}

const Ctx = createContext<WeightUnitCtx | null>(null);

export function WeightUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>('kg');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'kg' || v === 'lb' || v === 'st') setUnitState(v);
      })
      .catch(() => {});
  }, []);

  const setUnit = useCallback((u: WeightUnit) => {
    setUnitState(u);
    AsyncStorage.setItem(KEY, u).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ unit, setUnit }}>{children}</Ctx.Provider>;
}

export function useWeightUnit(): WeightUnitCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('WeightUnitProvider missing');
  return v;
}
