import { loggedFoodIds, type BrainEvent, type WeekMenu } from '@yumo/brain';
import { FOODS } from './seed';

/**
 * §3.3 candidate set = union(user's logged foods, this week's menu items,
 * onboarding NEED/LIKE foods). Replaces the old static per-slot seed list so the
 * Brain scores over what the user actually eats/plans/asked for. The engine
 * scores slot-relevance internally, so this is one slot-agnostic set.
 *
 * Onboarding tokens are human labels ("Chicken", "Rice"); in the seed/offline
 * app they're resolved to seed food ids by name match. Server-side the catalogue
 * maps tokens→food-graph nodes directly.
 */
export function buildCandidates(events: BrainEvent[], menu: WeekMenu, tokens: string[] = []): string[] {
  const set = new Set<string>();

  for (const id of loggedFoodIds(events)) set.add(id);
  for (const entry of menu) if (entry.foodId) set.add(entry.foodId);
  for (const id of resolveTokens(tokens)) set.add(id);

  return [...set];
}

/** Best-effort token→seed-food-id resolution by name substring (offline only). */
function resolveTokens(tokens: string[]): string[] {
  if (tokens.length === 0) return [];
  const out: string[] = [];
  for (const token of tokens) {
    const t = token.trim().toLowerCase();
    if (t.length < 3) continue;
    for (const [id, meta] of Object.entries(FOODS)) {
      if (meta.name.toLowerCase().includes(t)) out.push(id);
    }
  }
  return out;
}
