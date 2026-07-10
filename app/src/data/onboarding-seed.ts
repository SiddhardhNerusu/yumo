import type { Allergen } from '@yumo/shared';

/**
 * DEMO SEED for the onboarding pickers — replaced by GET /api/onboarding/bubbles
 * (server-served, data-driven from the catalogue). Placeholder only.
 */
export const BUBBLE_FOODS = [
  'Chicken', 'Rice', 'Eggs', 'Oats', 'Greek yogurt', 'Banana', 'Salmon', 'Beef',
  'Pasta', 'Potato', 'Broccoli', 'Spinach', 'Chickpeas', 'Lentils', 'Black beans',
  'Tofu', 'Cheese', 'Milk', 'Peanut butter', 'Almonds', 'Avocado', 'Sweet potato',
  'Tuna', 'Prawns', 'Bread', 'Berries', 'Apple', 'Tomato', 'Onion', 'Curry',
  'Noodles', 'Hummus',
];

export const CUISINES = [
  'British', 'Indian', 'Chinese', 'Italian', 'Thai', 'Mexican', 'Caribbean',
  'West African', 'Mediterranean', 'Japanese',
];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soy: 'Soy',
  sulphites: 'Sulphites',
};
