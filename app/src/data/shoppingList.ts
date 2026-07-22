import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's own shopping list (Kitchen §4/§5) — items you flag while going
 * through the kitchen: "Used up" and "Running low" add here, and unknown free-add
 * searches can too. Distinct from the menu-derived gap list (shopping.ts): this is
 * the running "need to buy" tally the footer counts and the sheet checks off.
 * One row per token; buying it restocks the kitchen and clears it here.
 */
const KEY = 'yumo.shoppinglist.v1';

export interface ShopItem {
  token: string;
  label: string;
  addedAt: number;
}

export interface ShoppingList {
  items: ShopItem[];
  count: number;
  has: (token: string) => boolean;
  add: (token: string, label: string) => void;
  remove: (token: string) => void;
  clear: () => void;
}

export function useShoppingList(): ShoppingList {
  const [items, setItems] = useState<ShopItem[]>([]);
  const ref = useRef<ShopItem[]>(items);
  ref.current = items;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((v) => {
      if (!alive || !v) return;
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) setItems(parsed as ShopItem[]);
      } catch { /* corrupt — start empty */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const write = useCallback((next: ShopItem[]) => {
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const add = useCallback((token: string, label: string) => {
    const tk = token.toLowerCase();
    if (ref.current.some((i) => i.token === tk)) return; // one row per token
    write([...ref.current, { token: tk, label, addedAt: Date.now() }]);
  }, [write]);

  const remove = useCallback((token: string) => {
    const tk = token.toLowerCase();
    write(ref.current.filter((i) => i.token !== tk));
  }, [write]);

  const clear = useCallback(() => write([]), [write]);
  const has = useCallback((token: string) => ref.current.some((i) => i.token === token.toLowerCase()), []);

  return { items, count: items.length, has, add, remove, clear };
}
