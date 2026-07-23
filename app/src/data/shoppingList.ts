import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's own shopping list (Kitchen §4/§5) — items you flag while going
 * through the kitchen: "Used up" and "Running low" add here, and unknown free-add
 * searches can too. Distinct from the menu-derived gap list (shopping.ts): this is
 * the running "need to buy" tally the footer counts and the sheet checks off.
 * One row per token; buying it restocks the kitchen and clears it here.
 *
 * All mutations go through functional setState updaters (and persist off the
 * computed next value) so several add/remove calls in one tick compose instead of
 * clobbering each other — e.g. buying a basketful removes every token at once.
 */
const KEY = 'yumo.shoppinglist.v1';

export interface ShopItem {
  token: string;
  label: string;
  addedAt: number;
}

export interface ShoppingList {
  items: ShopItem[];
  has: (token: string) => boolean;
  add: (token: string, label: string) => void;
  remove: (token: string) => void;
  removeMany: (tokens: string[]) => void;
  clear: () => void;
}

const persist = (next: ShopItem[]) => { AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); };

export function useShoppingList(): ShoppingList {
  const [items, setItems] = useState<ShopItem[]>([]);
  const ref = useRef<ShopItem[]>(items);
  ref.current = items; // render-synced mirror, for the synchronous has() read

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((v) => {
      if (!alive || !v) return;
      try {
        const parsed = JSON.parse(v);
        // only apply the hydration if the user hasn't already mutated the list
        // in the (sub-ms) gap before this resolves.
        if (Array.isArray(parsed)) setItems((prev) => (prev.length ? prev : (parsed as ShopItem[])));
      } catch { /* corrupt — start empty */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const add = useCallback((token: string, label: string) => {
    const tk = token.toLowerCase();
    setItems((prev) => {
      if (prev.some((i) => i.token === tk)) return prev; // one row per token
      const next = [...prev, { token: tk, label, addedAt: Date.now() }];
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((token: string) => {
    const tk = token.toLowerCase();
    setItems((prev) => { const next = prev.filter((i) => i.token !== tk); persist(next); return next; });
  }, []);

  const removeMany = useCallback((tokens: string[]) => {
    const set = new Set(tokens.map((t) => t.toLowerCase()));
    setItems((prev) => { const next = prev.filter((i) => !set.has(i.token)); persist(next); return next; });
  }, []);

  const clear = useCallback(() => { setItems([]); persist([]); }, []);
  const has = useCallback((token: string) => ref.current.some((i) => i.token === token.toLowerCase()), []);

  return { items, has, add, remove, removeMany, clear };
}
