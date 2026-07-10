import { api, setToken } from '../api/client';
import {
  generateWeekMenu,
  mixItUp,
  type UserProfile,
  type WeekMenuPlan,
  type MenuRecipe,
} from '@usual/menu';
import type { MealSlot } from '@usual/shared';
import { POOL, POOL_STEPS } from './menu-seed';
import { BUBBLE_FOODS } from './onboarding-seed';

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

export async function getMenu(profile: UserProfile): Promise<{ plan: WeekMenuPlan; source: Source }> {
  try {
    const { plan } = await api.generateMenu();
    return { plan, source: 'server' };
  } catch {
    return { plan: generateWeekMenu(POOL, profile, { seed: 'app-week', days: 7 }), source: 'local' };
  }
}

export async function getMixup(recipe: MenuRecipe, slot: MealSlot, profile: UserProfile): Promise<MenuRecipe[]> {
  try {
    const { alternatives } = await api.mixup(recipe.id, slot);
    return alternatives;
  } catch {
    return mixItUp(recipe, slot, POOL, profile);
  }
}

export async function getRecipeSteps(recipe: MenuRecipe): Promise<string[]> {
  try {
    const { steps } = await api.recipe(recipe.id);
    return steps ?? [];
  } catch {
    return POOL_STEPS.get(recipe.id) ?? [];
  }
}
