/**
 * The Kitchen inventory model (§3). Fuzzy, never a ledger — items carry a
 * coarse `level`, and freshness is *computed* (§4), never a typed date.
 */
export type Zone = 'fridge' | 'freezer' | 'cupboard' | 'counter';
export type Level = 'plenty' | 'some' | 'low' | 'out';
export type Freshness = 'fresh' | 'soon' | 'today' | 'gone';
export type ItemSource = 'receipt' | 'manual' | 'photo' | 'barcode' | 'decrement' | 'seed';

export interface KitchenItem {
  id: string;
  /** food-graph token (lowercased) — same vocabulary as recipe foodTokens. */
  token: string;
  label: string;
  zone: Zone;
  level: Level;
  addedAt: number;
  /** computed use-by estimate (addedAt + shelfLife); user-overridable. */
  freshUntil: number;
  price?: number;
  source: ItemSource;
}

export const ZONES: Zone[] = ['fridge', 'freezer', 'cupboard', 'counter'];
export const ZONE_LABEL: Record<Zone, string> = { fridge: 'Fridge', freezer: 'Freezer', cupboard: 'Cupboard', counter: 'Counter' };

/** Ordered low→high so we can step a level up/down on use/restock. */
const LADDER: Level[] = ['out', 'low', 'some', 'plenty'];
export function stepDown(l: Level): Level {
  return LADDER[Math.max(0, LADDER.indexOf(l) - 1)]!;
}
export function stepUp(l: Level): Level {
  return LADDER[Math.min(LADDER.length - 1, LADDER.indexOf(l) + 1)]!;
}
export function inStock(l: Level): boolean {
  return l !== 'out';
}

const DAY = 86_400_000;

/** Whole-word fuzzy token match: "chicken" matches "chicken breast, cooked" but
 * NOT "eggplant"↔"egg" or "pea"↔"peanut". Used for cookability + decrement. */
export function tokenMatch(a: string, b: string): boolean {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (A === B) return true;
  const aw = A.split(/[\s,]+/).filter(Boolean);
  const bw = B.split(/[\s,]+/).filter(Boolean);
  if (aw.length === 0 || bw.length === 0) return false;
  return aw.every((w) => bw.includes(w)) || bw.every((w) => aw.includes(w));
}

/** §4 computed freshness state from the estimate window. Deliberately fuzzy —
 * "use soon", not "expires Thursday". */
export function freshnessOf(item: KitchenItem, now: number): Freshness {
  const daysLeft = (item.freshUntil - now) / DAY;
  if (daysLeft > 2) return 'fresh';
  if (daysLeft > 0) return 'soon';
  if (daysLeft > -1.5) return 'today';
  return 'gone';
}

/** 0 (just added) → 1 (at estimate) → >1 (past) — drives the visual arc. */
export function freshnessFrac(item: KitchenItem, now: number): number {
  const span = item.freshUntil - item.addedAt;
  if (span <= 0) return 0;
  return Math.max(0, (now - item.addedAt) / span);
}
