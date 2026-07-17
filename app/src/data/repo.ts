import { api, setToken } from '../api/client';
import {
  generateWeekMenu,
  mixItUp,
  type UserProfile,
  type WeekMenuPlan,
  type MenuRecipe,
  type PantryFit,
} from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';
import { formatQty, scaleIngredient, scaleStepText } from '@yumo/shared';
export { portionLabel } from '@yumo/shared'; // re-exported for Day (§5.4 recipe-sheet label)
import { localParts } from '@yumo/brain';
import { cookability } from './cookability';
import { POOL, POOL_STEPS, POOL_INGREDIENTS, POOL_INGREDIENTS_MAP, POOL_METHODS_MAP } from './menu-seed';
import { BUBBLE_FOODS, CUISINES } from './onboarding-seed';
import { FOODS } from './seed';
import { searchLocalFoods } from './fdc-foods';
import { setCoachPack } from '../coach/pack';
import { setBrainConfig } from './brainConfig';

/**
 * Data layer: server-first, with an offline fallback to the local seed so the
 * app is fully usable even when the server isn't running (offline-first, §9).
 */

export type Source = 'server' | 'local';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Log the user in (dev login for now — Apple/Google verification is stubbed)
 * and push their profile. Returns whether the server was reachable. */
export async function bootstrapSession(profile: UserProfile, goal: string): Promise<Source> {
  try {
    const { token } = await api.devLogin('usual-device');
    setToken(token);
    await api.patchProfile({
      budgetKcal: profile.budgetKcal,
      targetWeightKg: profile.targetWeightKg,
      goal,
      allergies: profile.allergies,
      hates: profile.hates,
      needs: profile.needs,
      likes: profile.likes,
      pantry: profile.pantry,
      variation: profile.variation,
      cuisineLean: profile.cuisineLean,
    });
    try {
      const cfg = await api.getConfig();
      setCoachPack(cfg.coach);
      setBrainConfig(cfg.brain); // §3.3 server-tunable weights/caps/thresholds
    } catch {
      // keep the default coach pack + brain config
    }
    return 'server';
  } catch {
    setToken(null);
    return 'local';
  }
}

export async function getBubbles(): Promise<string[]> {
  try {
    const { bubbles } = await api.bubbles(40);
    const words = bubbles.map((b) => titleCase(b.token)).filter((w) => w.length >= 3);
    return words.length ? words : BUBBLE_FOODS;
  } catch {
    return BUBBLE_FOODS;
  }
}

/** §4.2 / decision 5: cuisine options from live catalogue counts, never a
 * hardcoded list. Falls back to the local seed only if the server is down. */
export async function getCuisines(): Promise<string[]> {
  try {
    const { cuisines } = await api.cuisines();
    const names = cuisines.map((x) => x.name).filter(Boolean);
    return names.length ? names : CUISINES;
  } catch {
    return CUISINES;
  }
}

/** §7 build a live-kitchen matcher from stock tokens (reuses cookability's staple/
 * token matching — the engine never re-implements it). Undefined when stock is empty. */
export function makePantryFit(haveTokens: Set<string>): PantryFit | undefined {
  if (!haveTokens.size) return undefined;
  return (recipe) => {
    const cook = cookability(recipe, haveTokens);
    const state = cook.tier === 'now' ? 'ready' : cook.tier === 'oneShort' ? 'near_miss' : 'shop';
    return { state, missing: cook.missing };
  };
}

/** §4.3 the "fresh week" ritual, client side: the default menu seed is anchored
 * to a Monday-aligned week bucket, so the plan stays stable within a week but
 * regenerates on its own each Monday (no server cron needed). The "New week"
 * button still passes an explicit seed to reshuffle on demand. */
export function currentWeekSeed(nowMs = Date.now()): string {
  const epochDay = localParts(nowMs, 0).epochDay;
  return `week-${Math.floor((epochDay + 3) / 7)}`; // epoch day 4 = 1970-01-05 = Monday
}

export async function getMenu(
  profile: UserProfile,
  seed?: string,
  boostIds?: string[],
  pantryFit?: PantryFit,
  userWeights?: Map<string, number>,
): Promise<{ plan: WeekMenuPlan; source: Source }> {
  const weekSeed = seed ?? currentWeekSeed();
  try {
    const { plan } = await api.generateMenu(weekSeed, boostIds);
    return { plan, source: 'server' };
  } catch {
    return { plan: generateWeekMenu(POOL, profile, { seed: weekSeed, days: 7, boostIds, pantryFit, userWeights }), source: 'local' };
  }
}

export async function getMixup(
  recipe: MenuRecipe,
  slot: MealSlot,
  profile: UserProfile,
  opts: { boostIds?: string[]; recentlyUsed?: string[]; pantryFit?: PantryFit; userWeights?: Map<string, number> } = {},
): Promise<MenuRecipe[]> {
  try {
    const { alternatives } = await api.mixup(recipe.id, slot, opts.boostIds);
    return alternatives;
  } catch {
    return mixItUp(recipe, slot, POOL, profile, opts);
  }
}

export interface RecipeIngredientLine {
  name: string;
  qty: string;
}
export interface RecipeDetail {
  steps: string[];
  /** ingredients split name/quantity for the two-column recipe layout (§4.2). */
  ingredients: RecipeIngredientLine[];
  /** compact cook-method lines: "Oven — 200°C, 25 min" · "Air fryer — 190°C, 18 min". */
  methods?: string[];
}

// §5.4 recipe scaling (formatQty / scaleIngredient / scaleStepText / portionLabel
// + the LIQUID/SPOONABLE/FIXED_WHEN_SCALED vocab) now lives in @yumo/shared
// (scaling.ts + scaling-vocab.json), so it is unit-tested. Imported above.

/** Split an offline "Rolled oats — 50g" seed line into { name, qty }. */
function splitIngredient(line: string): RecipeIngredientLine {
  const idx = line.indexOf(' — ');
  return idx >= 0 ? { name: line.slice(0, idx), qty: line.slice(idx + 3) } : { name: line, qty: '' };
}

/** §5.4 the sheet is shown at the *served* portion: amounts and step numbers are
 * scaled by `scale` (the menu's clean ½/1/1½/2 multiplier) so what you read matches
 * the calories on the card. Seasonings and oil stay fixed. */
export async function getRecipeDetail(recipe: MenuRecipe, scale = 1): Promise<RecipeDetail> {
  const fmt = (i: { name: string; qty_g: number }) => {
    const s = scaleIngredient(i, scale);
    return { name: titleCase(s.name), qty: formatQty(s.name, s.qty_g) };
  };
  const scaleSteps = (steps: string[]) => steps.map((s) => scaleStepText(s, scale));
  try {
    const r = await api.recipe(recipe.id);
    const ingredients = (r.ingredients ?? []).map(fmt);
    return { steps: scaleSteps(r.steps ?? []), ingredients, methods: POOL_METHODS_MAP.get(recipe.id) };
  } catch {
    const structured = POOL_INGREDIENTS_MAP.get(recipe.id);
    const ingredients = structured
      ? structured.map(fmt)
      : (POOL_INGREDIENTS.get(recipe.id) ?? []).map(splitIngredient); // hand-seeds are display strings; shown at 1×
    return { steps: scaleSteps(POOL_STEPS.get(recipe.id) ?? []), ingredients, methods: POOL_METHODS_MAP.get(recipe.id) };
  }
}

export interface FoodHit {
  fdcId: number;
  description: string;
  per100g: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
}

/** Server food search (§5.4). A pure-digit query (8–14) is a barcode → OpenFoodFacts;
 * otherwise text search. Offline falls back to matching the seed foods. */
export async function searchFoods(q: string): Promise<FoodHit[]> {
  const trimmed = q.trim();
  if (/^\d{8,14}$/.test(trimmed)) {
    const food = await lookupBarcode(trimmed);
    return food ? [food] : [];
  }
  // Local-first: the bundled FDC index is instant and works offline, so single
  // ingredients always appear regardless of server state. Server search is only a
  // fallback if the local index somehow returns nothing.
  const local = searchLocalFoods(trimmed, 20);
  if (local.length) return local.map((f) => ({ fdcId: f.fdcId, description: f.description, per100g: f.per100g }));
  try {
    const { foods } = await api.foodsSearch(q, 15);
    return foods.map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      per100g: {
        kcal: f.per100g['kcal'] ?? 0,
        protein_g: f.per100g['protein_g'] ?? 0,
        carbs_g: f.per100g['carbs_g'] ?? 0,
        fat_g: f.per100g['fat_g'] ?? 0,
      },
    }));
  } catch {
    const ql = q.toLowerCase();
    return Object.entries(FOODS)
      .filter(([, m]) => m.name.toLowerCase().includes(ql))
      .map(([, m], i) => ({
        fdcId: -1 - i,
        description: m.name,
        per100g: { kcal: Math.round((m.kcal / m.portionG) * 100), protein_g: 0, carbs_g: 0, fat_g: 0 },
      }));
  }
}

/** Single food by barcode (EAN) → OpenFoodFacts via the server; null offline/unknown.
 * Separate from searchFoods so the scanner can await exactly one result. */
export async function lookupBarcode(ean: string): Promise<FoodHit | null> {
  try {
    const { food } = await api.barcode(ean);
    return {
      fdcId: food.fdcId,
      description: food.description,
      per100g: {
        kcal: food.per100g['kcal'] ?? 0,
        protein_g: food.per100g['protein_g'] ?? 0,
        carbs_g: food.per100g['carbs_g'] ?? 0,
        fat_g: food.per100g['fat_g'] ?? 0,
      },
    };
  } catch {
    return null;
  }
}
