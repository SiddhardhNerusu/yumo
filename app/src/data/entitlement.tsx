import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Premium entitlement (§11). For now this is a local mock — a real RevenueCat
 * purchase/restore is a device + store-account gated follow-up. The gating
 * pattern (useEntitlement().isPremium) is what production wires to RevenueCat.
 * Per §11.4 the beta keeps features unlimited, so nothing hard-blocks yet.
 */
const KEY = 'usual.entitlement.v1';

interface Entitlement {
  isPremium: boolean;
  /** MOCK trial start. Replace with RevenueCat purchase. */
  startTrial: () => void;
  cancel: () => void;
}

const Ctx = createContext<Entitlement | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'premium') setIsPremium(true);
      })
      .catch(() => {});
  }, []);

  const startTrial = useCallback(() => {
    setIsPremium(true);
    AsyncStorage.setItem(KEY, 'premium').catch(() => {});
  }, []);

  const cancel = useCallback(() => {
    setIsPremium(false);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ isPremium, startTrial, cancel }}>{children}</Ctx.Provider>;
}

export function useEntitlement(): Entitlement {
  const v = useContext(Ctx);
  if (!v) throw new Error('EntitlementProvider missing');
  return v;
}
