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
import { cookability } from './cookability';
import { POOL, POOL_STEPS, POOL_INGREDIENTS, POOL_INGREDIENTS_MAP, POOL_METHODS_MAP } from './menu-seed';
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

export async function getMenu(
  profile: UserProfile,
  seed?: string,
  boostIds?: string[],
  pantryFit?: PantryFit,
): Promise<{ plan: WeekMenuPlan; source: Source }> {
  try {
    const { plan } = await api.generateMenu(seed, boostIds);
    return { plan, source: 'server' };
  } catch {
    return { plan: generateWeekMenu(POOL, profile, { seed: seed ?? 'app-week', days: 7, boostIds, pantryFit }), source: 'local' };
  }
}

export async function getMixup(
  recipe: MenuRecipe,
  slot: MealSlot,
  profile: UserProfile,
  opts: { boostIds?: string[]; recentlyUsed?: string[]; pantryFit?: PantryFit } = {},
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

const LIQUID = /\b(milk|stock|broth|water|juice|cream|passata)\b/i;
const SPOONABLE = /\b(oil|butter|honey|syrup|sauce|vinegar|mayonnaise|ketchup|mustard|paste|tahini)\b/i;
/** Human-friendly quantity: grams for solids, ml for liquids, tsp/tbsp for oils/condiments. */
function formatQty(name: string, g: number): string {
  if (g <= 0) return '';
  if (SPOONABLE.test(name) && g <= 45) {
    if (g <= 7) return '1 tsp';
    const tbsp = g / 15;
    if (Math.abs(tbsp - Math.round(tbsp)) <= 0.34) return `${Math.round(tbsp)} tbsp`;
    return `${g}g`;
  }
  if (LIQUID.test(name)) return `${g}ml`;
  return `${g}g`;
}

/** §5.4 seasonings, oil and aromatics stay fixed when a portion scales — you don't
 * double the salt for a 2× serving. Everything else scales with the portion. */
const FIXED_WHEN_SCALED = /\b(salt|pepper|oil|butter|ghee|margarine|spice|spices|turmeric|cumin|paprika|masala|chilli powder|chili powder|cinnamon|oregano|basil|thyme|parsley|coriander|cilantro|mint|dill|bay|garlic|ginger|baking powder|yeast|vanilla|nutmeg|cardamom|clove|seasoning|stock cube)\b/i;
/** Clean rounding so scaled grams read like a recipe, not a lab (185→190, 22→20). */
const roundQty = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)));

function scaleIngredient(i: { name: string; qty_g: number }, scale: number): { name: string; qty_g: number } {
  if (scale === 1 || FIXED_WHEN_SCALED.test(i.name)) return i;
  return { name: i.name, qty_g: roundQty(i.qty_g * scale) };
}

/** Scale the amounts written into a step's prose (150g → 225g, 2 eggs → 3) without
 * touching times, temperatures, or fixed seasonings/oil (§5.4). */
const countWord = (n: number, word: string) =>
  n === 1 ? word.replace(/s$/i, '') : word.endsWith('s') ? word : `${word}s`;
function scaleStepText(step: string, scale: number): string {
  if (scale === 1) return step;
  let out = step.replace(/(\d+(?:\.\d+)?)\s*(g|ml)\b/gi, (m, num: string, unit: string, off: number, whole: string) => {
    if (FIXED_WHEN_SCALED.test(whole.slice(Math.max(0, off - 26), off + 26))) return m;
    return `${roundQty(parseFloat(num) * scale)}${unit.toLowerCase()}`;
  });
  // whole-unit counts: ranges first ("1-2 slices"), then singles, with clean pluralisation.
  out = out.replace(/\b(\d+)\s*-\s*(\d+)\s+(eggs?|tortillas?|slices?)\b/gi, (_m, a: string, b: string, word: string) => {
    const lo = Math.max(1, Math.round(parseInt(a, 10) * scale));
    const hi = Math.max(1, Math.round(parseInt(b, 10) * scale));
    return lo === hi ? `${lo} ${countWord(lo, word)}` : `${lo}-${hi} ${countWord(hi, word)}`;
  });
  out = out.replace(/\b(\d+)\s+(eggs?|tortillas?|slices?)\b/gi, (_m, num: string, word: string) => {
    const n = Math.max(1, Math.round(parseInt(num, 10) * scale));
    return `${n} ${countWord(n, word)}`;
  });
  return out;
}

/** Clean-portion label for the recipe sheet: ½ · 1½ · 2 portions (blank at 1×). */
export function portionLabel(scale: number): string | undefined {
  if (Math.abs(scale - 1) < 1e-6) return undefined;
  const frac: Record<string, string> = { '0.5': '½', '1.5': '1½', '2': '2', '2.5': '2½', '3': '3' };
  const key = String(Number(scale.toFixed(2)).valueOf());
  const label = frac[key] ?? `${scale.toFixed(1)}×`;
  return `${label} portion${scale > 1 ? 's' : ''}`;
}

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
