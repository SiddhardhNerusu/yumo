import type { MealSlot, EnergyMacros, Allergen } from '@yumo/shared';

export type Effort = '5min' | '15min' | '30min+';

/** A recipe as the menu engine consumes it — the server builds these from
 * published catalogue recipes (name/macros/allergens/ingredient tokens). */
export interface MenuRecipe {
  id: string;
  name: string;
  cuisine: string;
  slotAffinity: MealSlot[];
  effort: Effort;
  perServing: EnergyMacros;
  allergens: Allergen[];
  /** lowercased ingredient identity tokens, for need/hate/pantry matching. */
  foodTokens: string[];
  tags?: string[];
}

/** Onboarding-derived preferences that steer generation (§2.1). */
export type VariationDial = 'habit' | 'balanced' | 'mixup';

export interface UserProfile {
  budgetKcal: number;
  /** for the protein floor 1.6 g/kg (§4.3), used when proteinTargetG is unset. */
  targetWeightKg: number;
  /** §5.1 explicit daily macro goals. protein is one-sided (hit-or-exceed);
   * carbs/fat are soft bands. Absent → protein defaults to 1.6 g/kg, C/F untargeted. */
  proteinTargetG?: number;
  carbTargetG?: number;
  fatTargetG?: number;
  allergies: Allergen[]; // HARD: never
  hates: string[]; // HARD: never (food tokens)
  needs: string[]; // pinned 1×/day (food tokens)
  likes: string[]; // soft up-weight (food tokens)
  pantry: string[]; // soft up-weight (food tokens)
  variation: VariationDial;
  /** cuisine → multiplier (heavy 1.5 / light 0.5); absent = 1. */
  cuisineLean?: Record<string, number>;
}

/** §7 how much of a pick you can make from what's in the kitchen right now. */
export type PantryState = 'ready' | 'near_miss' | 'shop';

/** §7 pantry match for a recipe against live kitchen stock. Injected by the app
 * (which owns the token/staple matching) so the pure engine never re-implements it. */
export type PantryFit = (recipe: MenuRecipe) => { state: PantryState; missing: string[] };

export interface MenuSlotPick {
  slot: MealSlot;
  recipe: MenuRecipe;
  /** multiplier on the authored serving to hit the slot envelope (§4.3). */
  portionScale: number;
  kcal: number; // scaled
  protein_g: number; // scaled
  /** why it was chosen — interpretable. */
  reasons: string[];
  /** §7 near-miss state vs the kitchen + the tokens you're missing (staples excluded). */
  pantryState?: PantryState;
  missing?: string[];
}

export interface MenuDay {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  picks: MenuSlotPick[];
  totalKcal: number;
  totalProtein_g: number;
}

export interface WeekMenuPlan {
  days: MenuDay[];
  warnings: string[];
}
