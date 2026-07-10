/**
 * UK FSA 14 major allergens (superset of the US big-9). Used to gate
 * suggestions/menu against a user's declared allergies (§2.1). Manual logging
 * is never gated — only what we proactively suggest.
 */
export type Allergen =
  | 'celery'
  | 'gluten' // cereals containing gluten (wheat, rye, barley, oats)
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'lupin'
  | 'milk'
  | 'molluscs'
  | 'mustard'
  | 'tree_nuts'
  | 'peanuts'
  | 'sesame'
  | 'soy'
  | 'sulphites';

export const ALLERGENS: readonly Allergen[] = [
  'celery',
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'tree_nuts',
  'peanuts',
  'sesame',
  'soy',
  'sulphites',
];
