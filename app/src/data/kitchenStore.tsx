import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MenuRecipe } from '@yumo/menu';
import {
  type KitchenItem,
  type Zone,
  type Level,
  type Freshness,
  ZONES,
  stepDown,
  stepUp,
  inStock,
  tokenMatch,
} from './kitchen-model';
import { shelfLifeDays, defaultZone } from './shelf-life';
import { STARTER_KITCHEN } from './kitchen-seed';

const KEY = 'yumo.kitchen.v1';
const STATS_KEY = 'yumo.kitchen.stats.v1';
const EMPTY_KEY = 'yumo.kitchen.empty.v1';
const DAY = 86_400_000;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** §8 lifetime tallies for the used-% / money recap. */
export interface KitchenStats { stocked: number; wasted: number; cooked: number }

interface KitchenStore {
  items: KitchenItem[];
  /** ids added very recently — drives the shelf fly-in animation. */
  recentlyAdded: Set<string>;
  /** §8 tallies (stocked/wasted/cooked, lifetime) + derived used-fraction. */
  stats: KitchenStats;
  usedPct: number | null;
  /** §9 "using things up" — bias generation to in-stock/expiring, pause shopping. */
  emptyMode: boolean;
  setEmptyMode: (on: boolean) => void;
  addItem: (token: string, opts?: { label?: string; zone?: Zone; level?: Level; price?: number; source?: KitchenItem['source'] }) => void;
  restock: (entries: Array<{ token: string; label?: string; price?: number; zone?: Zone; level?: Level }>) => void;
  removeItem: (id: string) => void;
  setLevel: (id: string, level: Level) => void;
  setFreshness: (id: string, state: Freshness) => void;
  moveZone: (id: string, zone: Zone) => void;
  wasteItem: (id: string) => void;
  /** step down every in-stock item a recipe uses (auto-decrement on a logged meal). */
  decrementForRecipe: (recipe: MenuRecipe) => void;
  /** step matching items back up when that logged meal is deleted (reverse decrement). */
  incrementForRecipe: (recipe: MenuRecipe) => void;
  /** in-stock tokens, for cookability. */
  availableTokens: () => Set<string>;
}

const Ctx = createContext<KitchenStore | null>(null);
let idc = 0;

function freshUntilFor(token: string, zone: Zone, now: number): number {
  return now + shelfLifeDays(token, zone) * DAY;
}

/** Seed freshness: honour an optional hint (use-soon / use-today), else compute. */
function freshUntilSeed(token: string, zone: Zone, now: number, fresh?: Freshness): number {
  if (fresh === 'soon') return now + 1.5 * DAY;
  if (fresh === 'today') return now - 0.2 * DAY;
  if (fresh === 'gone') return now - 2 * DAY;
  return freshUntilFor(token, zone, now);
}

export function KitchenProvider({ children, seedTokens = [] }: { children: ReactNode; seedTokens?: string[] }) {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<KitchenStats>({ stocked: 0, wasted: 0, cooked: 0 });
  const [emptyMode, setEmptyModeState] = useState(false);
  // live mirror of items so event handlers (add/restock) can read current state
  // without a stale closure and without re-creating callbacks on every change.
  const itemsRef = useRef<KitchenItem[]>(items);
  itemsRef.current = items;

  // Load persisted kitchen (+ §8 stats, §9 mode), else seed from the starter kitchen.
  useEffect(() => {
    let alive = true;
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(STATS_KEY), AsyncStorage.getItem(EMPTY_KEY)])
      .then(([v, sv, ev]) => {
        if (!alive) return;
        if (ev === '1') setEmptyModeState(true);
        let statsLoaded = false;
        if (sv) { try { const p = JSON.parse(sv); if (p && typeof p.stocked === 'number') { setStats(p); statsLoaded = true; } } catch { /* ignore */ } }
        if (v) {
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) { setItems(parsed as KitchenItem[]); return; }
          } catch { /* ignore corrupt */ }
        }
        const now = Date.now();
        // §4 starter kitchen, then any onboarding-pantry tokens it doesn't already cover.
        const seeded: KitchenItem[] = STARTER_KITCHEN.map((s) => ({
          id: `k${idc++}`, token: s.token, label: s.label, zone: s.zone, level: s.level,
          addedAt: now, freshUntil: freshUntilSeed(s.token, s.zone, now, s.fresh), ...(s.price != null ? { price: s.price } : {}), source: 'seed' as const,
        }));
        const covered = new Set(STARTER_KITCHEN.map((s) => s.token));
        for (const t of seedTokens) {
          const token = t.toLowerCase();
          if (covered.has(token)) continue;
          const zone = defaultZone(token);
          seeded.push({ id: `k${idc++}`, token, label: titleCase(t), zone, level: 'some', addedAt: now, freshUntil: freshUntilFor(token, zone, now), source: 'seed' });
        }
        // don't clobber anything the user added before hydration finished.
        setItems((prev) => (prev.length ? prev : seeded));
        // seed the stocked baseline once (so used-% has a denominator on first run).
        if (!statsLoaded) { const s0 = { stocked: seeded.length, wasted: 0, cooked: 0 }; setStats(s0); AsyncStorage.setItem(STATS_KEY, JSON.stringify(s0)).catch(() => {}); }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bumpStats = useCallback((d: Partial<KitchenStats>) => {
    setStats((prev) => {
      // clamp ≥0 — a reversed decrement (§ delete-a-log) must never drive a
      // lifetime tally negative and corrupt the used-% / money counters.
      const next = {
        stocked: Math.max(0, prev.stocked + (d.stocked ?? 0)),
        wasted: Math.max(0, prev.wasted + (d.wasted ?? 0)),
        cooked: Math.max(0, prev.cooked + (d.cooked ?? 0)),
      };
      AsyncStorage.setItem(STATS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const setEmptyMode = useCallback((on: boolean) => { setEmptyModeState(on); AsyncStorage.setItem(EMPTY_KEY, on ? '1' : '0').catch(() => {}); }, []);

  const persist = useCallback((next: KitchenItem[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const update = useCallback((fn: (prev: KitchenItem[]) => KitchenItem[]) => {
    setItems((prev) => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  const markRecent = useCallback((ids: string[]) => {
    setRecentlyAdded((prev) => new Set([...prev, ...ids]));
    // hold long enough for the staggered fly-in (delay ≤590ms + 750ms flight) to finish.
    setTimeout(() => setRecentlyAdded((prev) => { const s = new Set(prev); ids.forEach((i) => s.delete(i)); return s; }), 1600);
  }, []);

  const addItem = useCallback<KitchenStore['addItem']>((token, opts = {}) => {
    const now = Date.now();
    const tk = token.toLowerCase();
    const zone = opts.zone ?? defaultZone(tk);
    // reuse the existing item's id so the fly-in animation targets the real tile.
    const existing = itemsRef.current.find((p) => p.token === tk);
    const id = existing ? existing.id : `k${idc++}-${now}`;
    const item: KitchenItem = { id, token: tk, label: opts.label ?? titleCase(token), zone, level: opts.level ?? 'some', addedAt: now, freshUntil: freshUntilFor(tk, zone, now), ...(opts.price != null ? { price: opts.price } : {}), source: opts.source ?? 'manual' };
    update((prev) => {
      // if we already have it (in stock or not), top it up rather than duplicate.
      const ex = prev.find((p) => p.token === tk);
      if (ex) return prev.map((p) => (p.id === ex.id ? { ...p, level: 'plenty', addedAt: now, freshUntil: freshUntilFor(tk, p.zone, now) } : p));
      return [...prev, item];
    });
    if (!existing) bumpStats({ stocked: 1 });
    markRecent([id]);
  }, [update, markRecent, bumpStats]);

  const restock = useCallback<KitchenStore['restock']>((entries) => {
    const now = Date.now();
    // resolve ids up front from current state so markRecent targets the right tiles.
    const ids = entries.map((e) => {
      const ex = itemsRef.current.find((p) => p.token === e.token.toLowerCase());
      return ex ? ex.id : `k${idc++}-${now}-${e.token}`;
    });
    update((prev) => {
      const next = [...prev];
      entries.forEach((e, i) => {
        const tk = e.token.toLowerCase();
        const zone = e.zone ?? defaultZone(tk);
        const level = e.level ?? 'plenty';
        const idx = next.findIndex((p) => p.token === tk);
        if (idx >= 0) next[idx] = { ...next[idx]!, level, addedAt: now, freshUntil: freshUntilFor(tk, next[idx]!.zone, now), ...(e.price != null ? { price: e.price } : {}) };
        else next.push({ id: ids[i]!, token: tk, label: e.label ?? titleCase(e.token), zone, level, addedAt: now, freshUntil: freshUntilFor(tk, zone, now), ...(e.price != null ? { price: e.price } : {}), source: 'receipt' });
      });
      return next;
    });
    const newCount = entries.filter((e) => !itemsRef.current.find((p) => p.token === e.token.toLowerCase())).length;
    if (newCount) bumpStats({ stocked: newCount });
    markRecent(ids);
  }, [update, markRecent, bumpStats]);

  const removeItem = useCallback<KitchenStore['removeItem']>((id) => update((prev) => prev.filter((p) => p.id !== id)), [update]);
  const wasteItem = useCallback<KitchenStore['wasteItem']>((id) => { removeItem(id); bumpStats({ wasted: 1 }); }, [removeItem, bumpStats]);
  const setLevel = useCallback<KitchenStore['setLevel']>((id, level) => update((prev) => prev.map((p) => (p.id === id ? { ...p, level } : p))), [update]);
  const moveZone = useCallback<KitchenStore['moveZone']>((id, zone) => update((prev) => prev.map((p) => (p.id === id ? { ...p, zone, freshUntil: freshUntilFor(p.token, zone, p.addedAt) } : p))), [update]);
  const setFreshness = useCallback<KitchenStore['setFreshness']>((id, state) => {
    const now = Date.now();
    // days-left the freshness state should read as (freshnessOf: >2 fresh, >0 soon, >-1.5 today, else gone)
    const delta = state === 'fresh' ? 0 : state === 'soon' ? 1.5 : state === 'today' ? -0.2 : -2;
    update((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      if (state === 'fresh') return { ...p, addedAt: now, freshUntil: freshUntilFor(p.token, p.zone, now) };
      return { ...p, freshUntil: now + delta * DAY };
    }));
  }, [update]);

  const decrementForRecipe = useCallback<KitchenStore['decrementForRecipe']>((recipe) => {
    const tokens = recipe.foodTokens.map((t) => t.toLowerCase());
    let touched = false;
    update((prev) => prev.map((p) => {
      if (!inStock(p.level)) return p;
      const used = tokens.some((t) => tokenMatch(t, p.token)); // whole-word, no 'egg'↔'eggplant'
      if (used) touched = true;
      return used ? { ...p, level: stepDown(p.level) } : p;
    }));
    if (touched) bumpStats({ cooked: 1 }); // §8 a meal cooked from the kitchen
  }, [update, bumpStats]);

  // Reverse a decrement when its log is deleted (§ delete-a-log): step matching
  // items back up so deleting a mis-logged meal doesn't permanently eat the
  // fridge. Fuzzy by design — 'out' items come back to 'low', not exact grams.
  const incrementForRecipe = useCallback<KitchenStore['incrementForRecipe']>((recipe) => {
    const tokens = recipe.foodTokens.map((t) => t.toLowerCase());
    let touched = false;
    update((prev) => prev.map((p) => {
      const used = tokens.some((t) => tokenMatch(t, p.token));
      if (used) touched = true;
      return used ? { ...p, level: stepUp(p.level) } : p;
    }));
    if (touched) bumpStats({ cooked: -1 });
  }, [update, bumpStats]);

  const availableTokens = useCallback(() => new Set(items.filter((p) => inStock(p.level)).map((p) => p.token)), [items]);

  const usedPct = stats.stocked > 0 ? Math.max(0, Math.min(1, (stats.stocked - stats.wasted) / stats.stocked)) : null;

  const value = useMemo<KitchenStore>(() => ({ items, recentlyAdded, stats, usedPct, emptyMode, setEmptyMode, addItem, restock, removeItem, setLevel, setFreshness, moveZone, wasteItem, decrementForRecipe, incrementForRecipe, availableTokens }), [items, recentlyAdded, stats, usedPct, emptyMode, setEmptyMode, addItem, restock, removeItem, setLevel, setFreshness, moveZone, wasteItem, decrementForRecipe, incrementForRecipe, availableTokens]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKitchen(): KitchenStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('KitchenProvider missing');
  return v;
}

export { ZONES, stepUp };
