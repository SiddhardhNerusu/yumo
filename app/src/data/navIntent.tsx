import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * A tiny cross-screen intent bus. Tapping the weekly shop-day notification needs
 * to (a) switch to the Kitchen tab (AppShell) AND (b) open the shop sheet
 * (Kitchen) — two components that don't talk to each other. Both watch the same
 * `shopNonce`; the notification listener bumps it and both react. A monotonic
 * nonce (not a boolean) so a second tap re-fires even if the sheet was closed.
 */
interface NavIntentCtx {
  shopNonce: number;
  openShop: () => void;
  /** clear the intent once acted on, so a later Kitchen remount doesn't re-open the sheet. */
  consumeShop: () => void;
}

const Ctx = createContext<NavIntentCtx>({ shopNonce: 0, openShop: () => {}, consumeShop: () => {} });

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const [shopNonce, setShopNonce] = useState(0);
  const openShop = useCallback(() => setShopNonce((n) => n + 1), []);
  const consumeShop = useCallback(() => setShopNonce(0), []);
  return <Ctx.Provider value={{ shopNonce, openShop, consumeShop }}>{children}</Ctx.Provider>;
}

export function useNavIntent(): NavIntentCtx {
  return useContext(Ctx);
}
