import type { BrainEvent } from '@yumo/brain';
import { recipeWeights, type MenuRecipe, type UserProfile, type WeightSignal } from '@yumo/menu';
import { tokenMatch } from './kitchen-model';

/**
 * §8 turn the event log into per-recipe weight signals: accepting+logging a menu
 * meal or picking a mix-up up-weights it, swapping away down-weights the one you
 * left, and 👍/👎 move it hardest. `learnedWeights` folds these (with decay) into
 * the recipeId→weight map the menu scorer consumes — the client-authoritative
 * learning loop, generalising the old binary boost-id set.
 */
export function signalsFromEvents(events: BrainEvent[]): WeightSignal[] {
  const out: WeightSignal[] = [];
  for (const e of events) {
    if (!e.foodId) continue;
    switch (e.kind) {
      case 'menu_accept':
        out.push({ recipeId: e.foodId, kind: 'accept_log', ts: e.ts });
        break;
      case 'mixup_pick':
      case 'menu_swap':
        out.push({ recipeId: e.foodId, kind: 'mixup_pick', ts: e.ts });
        if (typeof e.meta?.swapFrom === 'string') out.push({ recipeId: e.meta.swapFrom, kind: 'swap_away', ts: e.ts });
        break;
      case 'recipe_thumb_up':
        out.push({ recipeId: e.foodId, kind: 'thumb_up', ts: e.ts });
        break;
      case 'recipe_thumb_down':
        out.push({ recipeId: e.foodId, kind: 'thumb_down', ts: e.ts });
        break;
    }
  }
  return out;
}

export function learnedWeights(events: BrainEvent[], now: number): Map<string, number> {
  return recipeWeights(signalsFromEvents(events), now);
}

/** §4.4 mix-it-up reason chip — why this alternative is offered. Derived from the
 * same signals the swap engine ranks by (pantry → likes → novelty). Every option
 * is already isocaloric, so "same macros" is the implicit promise in the subtitle. */
export function mixReason(recipe: MenuRecipe, profile: UserProfile, expiring: string[] = []): string {
  const tokens = recipe.foodTokens.map((t) => t.toLowerCase());
  const has = (list: string[]) => list.some((x) => tokens.some((t) => t.includes(x.toLowerCase())));
  // §8 waste-saver reason ranks top — cook the thing that's about to turn.
  const exp = expiring.find((x) => tokens.some((t) => tokenMatch(t, x.toLowerCase())));
  if (exp) return `Uses your expiring ${exp.toLowerCase()}`;
  if (has(profile.pantry)) return 'Uses your pantry';
  if (has(profile.likes)) return 'You like this';
  return 'Something new';
}
