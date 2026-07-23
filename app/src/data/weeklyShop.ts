import { buildShoppingList, aisleFor, AISLE_ORDER, AISLE_LABEL, type ShopPick, type ShopLine, type ShopAisleGroup } from './shopping';
import type { ShopItem } from './shoppingList';

/**
 * The weekly shop (Kitchen §5) — ONE list of what to buy next time, merging:
 *  - what next week's planned menu needs that isn't in your kitchen (with
 *    household quantities, via buildShoppingList), and
 *  - the items you flagged yourself while going through the kitchen
 *    ("Used up" / "Running low").
 *
 * Deduped by token (a menu-needed item you also flagged appears once, keeping the
 * menu row's quantity + meal), flagged items you already own are dropped, and the
 * whole thing is grouped by supermarket aisle in shopping order. Pure + RN-free.
 */
export function buildWeeklyShop(flagged: ShopItem[], picks: ShopPick[], have: Set<string>): ShopAisleGroup[] {
  const menuGroups = buildShoppingList(picks, have);
  const menuTokens = new Set(menuGroups.flatMap((g) => g.items.map((i) => i.token)));

  // flagged rows the menu didn't already cover and you don't already own
  const flaggedLines: ShopLine[] = flagged
    .filter((f) => !menuTokens.has(f.token) && !have.has(f.token))
    .map((f) => ({ token: f.token, label: f.label, qty: '', meal: '', flagged: true }));

  // fold flagged rows into the aisle buckets, then re-order + alphabetize so
  // flagged and menu rows interleave correctly within each aisle.
  const byAisle = new Map<ShopAisleGroup['aisle'], ShopLine[]>();
  for (const g of menuGroups) byAisle.set(g.aisle, [...g.items]);
  for (const line of flaggedLines) {
    const a = aisleFor(line.token);
    byAisle.set(a, [...(byAisle.get(a) ?? []), line]);
  }

  const out: ShopAisleGroup[] = [];
  for (const a of AISLE_ORDER) {
    const items = byAisle.get(a);
    if (items?.length) {
      items.sort((x, y) => x.label.localeCompare(y.label));
      out.push({ aisle: a, label: AISLE_LABEL[a], items });
    }
  }
  return out;
}

/** Total line count across all aisles — for the footer "Shopping list · {n}". */
export function weeklyShopCount(groups: ShopAisleGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
