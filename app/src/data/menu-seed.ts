import type { Allergen } from '@yumo/shared';
import type { MenuRecipe, Effort } from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';

/**
 * DEMO SEED recipe pool for the Menu screen — replaced by the server's
 * published catalogue (POST /api/menu/generate). Placeholder only; includes
 * `steps` for the recipe sheet (§14.2).
 */
export interface MenuSeedRecipe extends MenuRecipe {
  steps: string[];
}

function r(
  id: string,
  name: string,
  cuisine: string,
  slots: MealSlot[],
  effort: Effort,
  kcal: number,
  protein: number,
  allergens: Allergen[],
  foodTokens: string[],
  steps: string[],
): MenuSeedRecipe {
  return {
    id,
    name,
    cuisine,
    slotAffinity: slots,
    effort,
    perServing: { kcal, protein_g: protein, carbs_g: Math.round(kcal / 8), fat_g: Math.round(kcal / 30) },
    allergens,
    foodTokens,
    steps,
  };
}

export const POOL: MenuSeedRecipe[] = [
  r('oats_yogurt', 'Oats & yogurt', 'British', ['breakfast'], '5min', 450, 25, ['milk', 'gluten'], ['oats', 'yogurt', 'banana'],
    ['Tip the oats and yogurt into a bowl.', 'Slice the banana over the top.', 'Add a splash of milk and serve.']),
  r('eggs_toast', 'Eggs on toast', 'British', ['breakfast'], '15min', 480, 28, ['eggs', 'gluten'], ['egg', 'bread'],
    ['Whisk the eggs with a pinch of salt.', 'Scramble gently in a buttered pan until just set.', 'Toast the bread and pile the eggs on top.']),
  r('porridge', 'Porridge & berries', 'British', ['breakfast'], '5min', 420, 14, ['gluten'], ['oats', 'berries'],
    ['Simmer the oats with milk for 4 minutes, stirring.', 'Spoon into a bowl and top with berries.']),
  r('chicken_rice', 'Chicken & rice', 'British', ['lunch', 'dinner'], '15min', 620, 45, [], ['chicken', 'rice'],
    ['Cook the chicken through in a hot pan until no longer pink.', 'Warm the rice.', 'Slice the chicken over the rice and season.']),
  r('tuna_salad', 'Tuna salad', 'British', ['lunch'], '5min', 500, 35, ['fish'], ['tuna', 'lettuce'],
    ['Drain the tuna and flake into a bowl.', 'Toss with the leaves and a little dressing.']),
  r('black_bean_bowl', 'Black bean bowl', 'Mexican', ['lunch'], '15min', 600, 22, [], ['beans', 'rice'],
    ['Warm the rice and black beans together.', 'Add salsa and a squeeze of lime.', 'Top with avocado if you like.']),
  r('salmon_veg', 'Salmon & greens', 'British', ['dinner'], '30min+', 620, 42, ['fish'], ['salmon', 'broccoli'],
    ['Heat the oven to 200°C.', 'Bake the salmon for 15 minutes until it flakes.', 'Steam the broccoli and serve alongside.']),
  r('beef_pasta', 'Beef & tomato pasta', 'Italian', ['dinner'], '30min+', 700, 40, ['gluten'], ['beef', 'pasta'],
    ['Fry the onion until soft.', 'Add the beef and brown it.', 'Stir in chopped tomato and simmer 15 minutes.', 'Cook the pasta and toss through.']),
  r('tofu_stirfry', 'Tofu stir-fry', 'Chinese', ['dinner'], '15min', 580, 30, ['soy'], ['tofu', 'rice'],
    ['Fry the tofu until golden.', 'Add the veg and stir-fry 3 minutes.', 'Splash in soy sauce and serve over rice.']),
  r('chicken_curry', 'Chicken curry', 'Indian', ['dinner'], '30min+', 640, 44, [], ['chicken', 'rice'],
    ['Fry the onion until deep golden.', 'Add spices and tomato, cook to a paste.', 'Add the chicken and simmer 20 minutes until cooked through.', 'Serve with rice.']),
  r('veg_chili', 'Veg chili', 'Mexican', ['dinner'], '30min+', 560, 24, [], ['beans', 'tomato'],
    ['Fry the onion and pepper.', 'Add beans, tomato and spices.', 'Simmer 20 minutes and serve.']),
  r('greek_yogurt', 'Greek yogurt', 'British', ['snack'], '5min', 180, 18, ['milk'], ['yogurt'],
    ['Spoon into a bowl. That’s it.']),
  r('apple_pb', 'Apple & peanut butter', 'British', ['snack'], '5min', 240, 8, ['peanuts'], ['apple', 'peanut'],
    ['Slice the apple.', 'Serve with a spoon of peanut butter.']),
  r('hummus_carrots', 'Hummus & carrots', 'Mediterranean', ['snack'], '5min', 190, 6, ['sesame'], ['chickpea', 'carrot'],
    ['Cut the carrots into sticks.', 'Serve with the hummus.']),
];

export const POOL_STEPS: Map<string, string[]> = new Map(POOL.map((x) => [x.id, x.steps]));

/**
 * Precise ingredient quantities (§4.2 "exact quantities in g/ml + household
 * measure") so people know *how much* — replaced by the server catalogue's
 * FDC-computed recipe_ingredients online. Display strings, one per line.
 */
export const POOL_INGREDIENTS: Map<string, string[]> = new Map([
  ['oats_yogurt', ['Rolled oats — 50g', 'Greek yogurt — 150g', 'Banana — 1 medium', 'Milk — 30ml (a splash)']],
  ['eggs_toast', ['Eggs — 3 medium', 'Wholemeal bread — 2 slices', 'Butter — 5g', 'Salt — a pinch']],
  ['porridge', ['Rolled oats — 50g', 'Milk — 250ml', 'Mixed berries — 80g']],
  ['chicken_rice', ['Chicken breast — 150g', 'Cooked rice — 180g', 'Olive oil — 5ml', 'Salt & pepper — to taste']],
  ['tuna_salad', ['Tuna in spring water — 1 tin (drained, 110g)', 'Mixed salad leaves — 80g', 'Light dressing — 15ml']],
  ['black_bean_bowl', ['Black beans — 150g (½ tin)', 'Cooked rice — 150g', 'Salsa — 40g', 'Avocado — ½', 'Lime — a squeeze']],
  ['salmon_veg', ['Salmon fillet — 150g', 'Broccoli — 120g', 'Olive oil — 5ml']],
  ['beef_pasta', ['Lean beef mince — 125g', 'Dried pasta — 80g', 'Chopped tomatoes — 200g', 'Onion — ½']],
  ['tofu_stirfry', ['Firm tofu — 150g', 'Mixed stir-fry veg — 150g', 'Cooked rice — 150g', 'Soy sauce — 15ml']],
  ['chicken_curry', ['Chicken thigh — 150g', 'Onion — 1', 'Chopped tomatoes — 200g', 'Curry spices — 2 tsp', 'Cooked rice — 150g']],
  ['veg_chili', ['Mixed beans — 200g', 'Chopped tomatoes — 200g', 'Onion — 1', 'Pepper — 1', 'Chilli spices — 2 tsp']],
  ['greek_yogurt', ['Greek yogurt — 200g']],
  ['apple_pb', ['Apple — 1 medium', 'Peanut butter — 20g (1 tbsp)']],
  ['hummus_carrots', ['Hummus — 60g', 'Carrots — 2 (cut into sticks)']],
]);
