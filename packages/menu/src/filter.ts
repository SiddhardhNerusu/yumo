import type { MenuRecipe, UserProfile } from './types';

/** Does the recipe contain an ingredient matching this token (substring, either
 * direction)? Tokens are things like "chicken", "rice". */
export function containsToken(recipe: MenuRecipe, token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t) return false;
  return recipe.foodTokens.some((ft) => {
    const f = ft.toLowerCase();
    return f === t || f.includes(t) || t.includes(f);
  });
}

export function containsAnyToken(recipe: MenuRecipe, tokens: string[]): boolean {
  return tokens.some((t) => containsToken(recipe, t));
}

/**
 * HARD constraints (§4.3): a recipe is allowed only if it triggers none of the
 * user's allergens (allergen-class level) and contains none of their hated
 * ingredients. Suggestions are gated; manual logging never is (§1.3).
 */
export function isAllowed(recipe: MenuRecipe, profile: UserProfile): boolean {
  if (recipe.allergens.some((a) => profile.allergies.includes(a))) return false;
  if (containsAnyToken(recipe, profile.hates)) return false;
  return true;
}
