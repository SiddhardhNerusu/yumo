import type { Zone, Level, Freshness } from './kitchen-model';

/**
 * Starter kitchen (Addendum §4). Demo/seed data only — the real inventory is the
 * user's. Kinds are NOT stored here; they're derived from the token by kindOf().
 * `fresh` is an optional hint so a few items read as "use soon"/"use today".
 */
export interface SeedItem {
  token: string;
  label: string;
  zone: Zone;
  level: Level;
  fresh?: Freshness;
  /** typical UK shelf price £ (as if from a receipt) — feeds §8 money. */
  price?: number;
}

export const STARTER_KITCHEN: SeedItem[] = [
  // fridge
  { token: 'milk', label: 'Milk', zone: 'fridge', level: 'plenty', price: 1.3 },
  { token: 'greek yogurt', label: 'Greek yogurt', zone: 'fridge', level: 'some', price: 2 },
  { token: 'spinach', label: 'Spinach', zone: 'fridge', level: 'some', fresh: 'soon', price: 1 },
  { token: 'chicken breast', label: 'Chicken breast', zone: 'fridge', level: 'plenty', fresh: 'soon', price: 4 },
  { token: 'eggs', label: 'Eggs', zone: 'fridge', level: 'plenty', price: 2 },
  { token: 'butter', label: 'Butter', zone: 'fridge', level: 'plenty', price: 2 },
  { token: 'berries', label: 'Berries', zone: 'fridge', level: 'some', fresh: 'soon', price: 2.5 },
  { token: 'leftover chili', label: 'Leftover chili', zone: 'fridge', level: 'some', fresh: 'today' },
  // freezer
  { token: 'frozen peas', label: 'Frozen peas', zone: 'freezer', level: 'plenty', price: 1.2 },
  { token: 'salmon fillets', label: 'Salmon fillets', zone: 'freezer', level: 'some', price: 5 },
  { token: 'mixed veg', label: 'Mixed veg', zone: 'freezer', level: 'plenty', price: 1.5 },
  { token: 'ice cream', label: 'Ice cream', zone: 'freezer', level: 'some', price: 3 },
  // cupboard
  { token: 'rolled oats', label: 'Rolled oats', zone: 'cupboard', level: 'plenty', price: 1.5 },
  { token: 'basmati rice', label: 'Basmati rice', zone: 'cupboard', level: 'plenty', price: 2 },
  { token: 'pasta', label: 'Pasta', zone: 'cupboard', level: 'some', price: 1 },
  { token: 'tinned tomatoes', label: 'Tinned tomatoes', zone: 'cupboard', level: 'plenty', price: 0.5 },
  { token: 'peanut butter', label: 'Peanut butter', zone: 'cupboard', level: 'some', price: 2.5 },
  { token: 'chickpeas', label: 'Chickpeas', zone: 'cupboard', level: 'plenty', price: 0.5 },
  // counter
  { token: 'oranges', label: 'Oranges', zone: 'counter', level: 'some', price: 2 },
  { token: 'apples', label: 'Apples', zone: 'counter', level: 'plenty', price: 2 },
  { token: 'bananas', label: 'Bananas', zone: 'counter', level: 'low', fresh: 'soon', price: 1 },
  { token: 'sourdough loaf', label: 'Sourdough loaf', zone: 'counter', level: 'some', fresh: 'soon', price: 2.5 },
];
