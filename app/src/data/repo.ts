import { api, setToken } from '../api/client';
import {
  generateWeekMenu,
  mixItUp,
  type UserProfile,
  type WeekMenuPlan,
  type MenuRecipe,
} from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';
import { POOL, POOL_STEPS, POOL_INGREDIENTS } from './menu-seed';
import { BUBBLE_FOODS, CUISINES } from './onboarding-seed';
import { FOODS } from './seed';
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

export async function getMenu(
  profile: UserProfile,
  seed?: string,
  boostIds?: string[],
): Promise<{ plan: WeekMenuPlan; source: Source }> {
  try {
    const { plan } = await api.generateMenu(seed, boostIds);
    return { plan, source: 'server' };
  } catch {
    return { plan: generateWeekMenu(POOL, profile, { seed: seed ?? 'app-week', days: 7, boostIds }), source: 'local' };
  }
}

export async function getMixup(
  recipe: MenuRecipe,
  slot: MealSlot,
  profile: UserProfile,
  opts: { boostIds?: string[]; recentlyUsed?: string[] } = {},
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
}

/** Split an offline "Rolled oats — 50g" seed line into { name, qty }. */
function splitIngredient(line: string): RecipeIngredientLine {
  const idx = line.indexOf(' — ');
  return idx >= 0 ? { name: line.slice(0, idx), qty: line.slice(idx + 3) } : { name: line, qty: '' };
}

export async function getRecipeDetail(recipe: MenuRecipe): Promise<RecipeDetail> {
  try {
    const r = await api.recipe(recipe.id);
    const ingredients = (r.ingredients ?? []).map((i) => ({ name: titleCase(i.name), qty: i.qty_g > 0 ? `${i.qty_g}g` : '' }));
    return { steps: r.steps ?? [], ingredients };
  } catch {
    return { steps: POOL_STEPS.get(recipe.id) ?? [], ingredients: (POOL_INGREDIENTS.get(recipe.id) ?? []).map(splitIngredient) };
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
    try {
      const { food } = await api.barcode(trimmed);
      return [
        {
          fdcId: food.fdcId,
          description: food.description,
          per100g: {
            kcal: food.per100g['kcal'] ?? 0,
            protein_g: food.per100g['protein_g'] ?? 0,
            carbs_g: food.per100g['carbs_g'] ?? 0,
            fat_g: food.per100g['fat_g'] ?? 0,
          },
        },
      ];
    } catch {
      return [];
    }
  }
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
