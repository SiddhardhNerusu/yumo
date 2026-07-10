import type { MealSlot, Allergen } from '@yumo/shared';
import type { MenuRecipe, Effort, UserProfile } from '../src/types';

function r(
  id: string,
  name: string,
  cuisine: string,
  slotAffinity: MealSlot[],
  effort: Effort,
  kcal: number,
  protein: number,
  allergens: Allergen[],
  foodTokens: string[],
): MenuRecipe {
  return {
    id,
    name,
    cuisine,
    slotAffinity,
    effort,
    perServing: { kcal, protein_g: protein, carbs_g: Math.round(kcal / 8), fat_g: Math.round(kcal / 30) },
    allergens,
    foodTokens,
  };
}

/** A controlled ~19-recipe pool spanning slots / cuisines / efforts / allergens. */
export const POOL: MenuRecipe[] = [
  // breakfast
  r('oats_yogurt', 'Oats & yogurt', 'British-everyday', ['breakfast'], '5min', 450, 25, ['milk', 'gluten'], ['oats', 'yogurt', 'banana']),
  r('eggs_toast', 'Eggs on toast', 'British-everyday', ['breakfast'], '15min', 480, 28, ['eggs', 'gluten'], ['egg', 'bread']),
  r('porridge', 'Porridge', 'British-everyday', ['breakfast'], '5min', 420, 14, ['gluten'], ['oats']),
  r('smoothie', 'Berry smoothie', 'British-everyday', ['breakfast', 'snack'], '5min', 380, 20, ['milk'], ['banana', 'milk', 'berries']),
  // lunch
  r('chicken_rice', 'Chicken & rice', 'British-everyday', ['lunch', 'dinner'], '15min', 620, 45, [], ['chicken', 'rice']),
  r('tuna_salad', 'Tuna salad', 'British-everyday', ['lunch'], '5min', 500, 35, ['fish'], ['tuna', 'lettuce']),
  r('black_bean_bowl', 'Black bean bowl', 'Mexican', ['lunch'], '15min', 600, 22, [], ['beans', 'rice']),
  r('falafel_wrap', 'Falafel wrap', 'Mediterranean', ['lunch'], '15min', 640, 18, ['gluten', 'sesame'], ['chickpea', 'bread']),
  // dinner
  r('salmon_veg', 'Salmon & veg', 'British-everyday', ['dinner'], '30min+', 620, 42, ['fish'], ['salmon', 'broccoli']),
  r('beef_pasta', 'Beef pasta', 'Italian', ['dinner'], '30min+', 700, 40, ['gluten'], ['beef', 'pasta']),
  r('tofu_stirfry', 'Tofu stir-fry', 'Chinese', ['dinner'], '15min', 580, 30, ['soy'], ['tofu', 'rice']),
  r('chicken_curry', 'Chicken curry', 'Indian', ['dinner'], '30min+', 640, 44, [], ['chicken', 'rice']),
  r('veg_chili', 'Veg chili', 'Mexican', ['dinner'], '30min+', 560, 24, [], ['beans', 'tomato']),
  r('lentil_dhal', 'Lentil dhal', 'Indian', ['dinner'], '15min', 520, 26, [], ['lentils']),
  r('roast_chicken', 'Roast chicken', 'British-everyday', ['dinner'], '30min+', 680, 50, [], ['chicken', 'potato']),
  // snack
  r('greek_yogurt', 'Greek yogurt', 'British-everyday', ['snack'], '5min', 180, 18, ['milk'], ['yogurt']),
  r('apple_pb', 'Apple & peanut butter', 'British-everyday', ['snack'], '5min', 240, 8, ['peanuts'], ['apple', 'peanut']),
  r('hummus_carrots', 'Hummus & carrots', 'Mediterranean', ['snack'], '5min', 190, 6, ['sesame'], ['chickpea', 'carrot']),
  r('protein_bar', 'Protein bar', 'British-everyday', ['snack'], '5min', 220, 20, ['milk'], ['whey']),
];

export const baseProfile: UserProfile = {
  budgetKcal: 2000,
  targetWeightKg: 75,
  allergies: [],
  hates: [],
  needs: [],
  likes: [],
  pantry: [],
  variation: 'balanced',
};
