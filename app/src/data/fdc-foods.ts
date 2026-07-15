import RAW from './fdc-foods.json';

/**
 * Bundled USDA FoodData Central generic foods (CC0 public domain) — the local
 * ingredient index the plan (§5.4) calls for: "recents-first local index (<50ms),
 * then server search". Shipping it means single-ingredient search works instantly
 * and offline, instead of collapsing to a 15-item seed when the server is cold.
 *
 * Versioned DATA (regenerate from packages/catalogue-pipeline/data/fdc-cache via
 * scripts), never a hardcoded list in code. Compact tuple rows keep the bundle small:
 *   [fdcId, description, kcal, protein_g, carbs_g, fat_g]  (all per 100g)
 */
type Tup = [number, string, number, number, number, number];
const TUPLES = RAW as unknown as Tup[];
const LOWER: string[] = TUPLES.map((t) => t[1].toLowerCase());
const HEAD: string[] = TUPLES.map((t) => (t[1].split(',')[0] ?? '').toLowerCase());

export interface LocalFood {
  fdcId: number;
  description: string;
  per100g: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
}

function toFood(t: Tup): LocalFood {
  return { fdcId: t[0], description: t[1], per100g: { kcal: t[2], protein_g: t[3], carbs_g: t[4], fat_g: t[5] } };
}

/**
 * Ranked local ingredient search. AND-matches every query word, then ranks so the
 * cleanest, most on-the-nose entry wins: exact/prefix hits, the FDC head noun (FDC
 * descriptions lead with the food, e.g. "Chicken, broilers…"), and shorter names
 * over long processed variants. Linear over ~8k rows → a few ms, no index needed.
 */
export function searchLocalFoods(q: string, limit = 20): LocalFood[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const words = query.split(/\s+/).filter(Boolean);
  const scored: Array<{ i: number; s: number }> = [];
  for (let i = 0; i < TUPLES.length; i++) {
    const d = LOWER[i]!;
    let ok = true;
    for (const w of words) {
      if (!d.includes(w)) { ok = false; break; }
    }
    if (!ok) continue;
    let s = 100;
    if (d === query) s += 1000;
    else if (d.startsWith(query)) s += 500;
    if (HEAD[i]!.includes(words[0]!)) s += 220;
    if (d.includes(' ' + query) || d.startsWith(query) || d.includes(query + ',')) s += 120;
    s += Math.max(0, 90 - d.length); // prefer clean, short names
    if (d.includes('baby food') || d.includes('infant formula')) s -= 300; // rarely what's meant
    scored.push({ i, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => toFood(TUPLES[x.i]!));
}
