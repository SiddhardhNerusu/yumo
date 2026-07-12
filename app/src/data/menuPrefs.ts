import type { BrainEvent } from '@yumo/brain';
import type { MenuRecipe, UserProfile } from '@yumo/menu';
import { tokenMatch } from './kitchen-model';

/**
 * §4.3.3 "swaps persist → re-weight future generation". The recipe ids the user
 * has picked via Mix it up (or swapped to) become up-weight signals fed back
 * into generation + mix-up ranking. Read from the event log (client-authoritative).
 */
export function menuBoostIds(events: BrainEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if ((e.kind === 'mixup_pick' || e.kind === 'menu_swap') && e.foodId) set.add(e.foodId);
  }
  return [...set];
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
