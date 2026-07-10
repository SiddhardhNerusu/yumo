import type { MealSlot, EnergyMacros, Allergen } from '@usual/shared';

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
  /** for the protein floor 1.6 g/kg (§4.3). */
  targetWeightKg: number;
  allergies: Allergen[]; // HARD: never
  hates: string[]; // HARD: never (food tokens)
  needs: string[]; // pinned 1×/day (food tokens)
  likes: string[]; // soft up-weight (food tokens)
  pantry: string[]; // soft up-weight (food tokens)
  variation: VariationDial;
  /** cuisine → multiplier (heavy 1.5 / light 0.5); absent = 1. */
  cuisineLean?: Record<string, number>;
}

export interface MenuSlotPick {
  slot: MealSlot;
  recipe: MenuRecipe;
  /** multiplier on the authored serving to hit the slot envelope (§4.3). */
  portionScale: number;
  kcal: number; // scaled
  protein_g: number; // scaled
  /** why it was chosen — interpretable. */
  reasons: string[];
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
