import type { MenuRecipe } from '@yumo/menu';
import { cookability } from './cookability';
import { POOL_INGREDIENTS_MAP } from './menu-seed';
import shopData from './ingredient-shop.json';

/**
 * §9 shop-able shopping list: Σ scaled qty across the week's menu − what's in the
 * kitchen, grouped by supermarket aisle with household units ("2 chicken breasts
 * ≈400g"). Aisle/unit facts live in ingredient-shop.json (versioned data), never
 * hardcoded here. Missing non-staple seasonings are included (the paprika gets bought).
 */
type ShopInfo = { aisle: Aisle; unit: string | null; unitG: number | null };
export type Aisle = 'produce' | 'meat' | 'dairy' | 'dry' | 'frozen' | 'world' | 'spices';
const SHOP = shopData as Record<string, ShopInfo>;

export const AISLE_ORDER: Aisle[] = ['produce', 'meat', 'dairy', 'dry', 'frozen', 'world', 'spices'];
export const AISLE_LABEL: Record<Aisle, string> = {
  produce: 'Produce',
  meat: 'Meat & fish',
  dairy: 'Dairy & chilled',
  dry: 'Dry & tins',
  frozen: 'Frozen',
  world: 'World foods',
  spices: 'Spices & condiments',
};
/** aisles whose items are bought by weight/count (vs. spices/world = buy a jar). */
const QTY_AISLES = new Set<Aisle>(['produce', 'meat', 'dairy', 'dry', 'frozen']);
const LIQUID = /\b(milk|stock|broth|cream|juice|passata|wine|kefir)\b/i;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const headToken = (name: string) => name.split(',')[0]!.trim().toLowerCase();
const roundQty = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)));

export interface ShopLine {
  token: string;
  label: string;
  /** human quantity ("2 breasts · 400g" · "360g" · "" for buy-a-jar items). */
  qty: string;
  /** first meal that needs it. */
  meal: string;
}
export interface ShopAisleGroup {
  aisle: Aisle;
  label: string;
  items: ShopLine[];
}

export interface ShopPick {
  recipe: MenuRecipe;
  portionScale: number;
}

function renderQty(token: string, g: number, info: ShopInfo): string {
  if (!QTY_AISLES.has(info.aisle) || g <= 0) return ''; // seasonings/world → buy a container
  const rg = roundQty(g);
  if (info.unitG && info.unit) {
    const n = Math.max(1, Math.round(g / info.unitG));
    return `${n} ${info.unit}${n > 1 ? 's' : ''} · ${rg}g`;
  }
  return LIQUID.test(token) ? `${rg}ml` : `${rg}g`;
}

/** Build the aisle-grouped list from this week's picks (scaled) minus what's in stock. */
export function buildShoppingList(picks: ShopPick[], have: Set<string>): ShopAisleGroup[] {
  const acc = new Map<string, { g: number; meal: string }>();
  for (const p of picks) {
    const needed = new Set(cookability(p.recipe, have).missing); // non-staple tokens not in stock
    if (!needed.size) continue;
    const ings = POOL_INGREDIENTS_MAP.get(p.recipe.id) ?? [];
    for (const ing of ings) {
      const tk = headToken(ing.name);
      if (!needed.has(tk)) continue;
      const cur = acc.get(tk) ?? { g: 0, meal: p.recipe.name };
      cur.g += ing.qty_g * p.portionScale;
      acc.set(tk, cur);
    }
    // needed tokens with no structured qty (hand-seeds / seasonings) → presence-level row
    for (const tk of needed) if (!acc.has(tk)) acc.set(tk, { g: 0, meal: p.recipe.name });
  }

  const byAisle = new Map<Aisle, ShopLine[]>();
  for (const [tk, { g, meal }] of acc) {
    const info = SHOP[tk] ?? { aisle: 'dry', unit: null, unitG: null };
    const line: ShopLine = { token: tk, label: titleCase(tk), qty: renderQty(tk, g, info), meal };
    const list = byAisle.get(info.aisle) ?? [];
    list.push(line);
    byAisle.set(info.aisle, list);
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
