import type { EnergyMacros, NutrientProfilePer100g } from '@usual/shared';
import { zeroEnergyMacros } from '@usual/shared';
import type { FdcFood } from './fdc/store';
import type { Resolution } from './fdc/resolve';
import type { RecipeDraft } from './schema';

export interface IngredientContribution {
  name: string;
  qty_g: number;
  yieldFactor: number;
  fdcId: number | null;
  matchedDescription: string | null;
  confidence: number;
  per100g: NutrientProfilePer100g | null;
  /** Energy+macros this ingredient adds to the recipe (zero if unresolved). */
  contribution: EnergyMacros;
}

export interface RecipeMacroResult {
  perIngredient: IngredientContribution[];
  total: EnergyMacros; // unrounded — round only for display/storage
  servings: number;
  perServing: EnergyMacros; // unrounded
  unresolved: string[];
}

function scale(p: NutrientProfilePer100g, grams: number, yieldFactor: number): EnergyMacros {
  // qty_g is as-consumed weight; yieldFactor is the FNDDS raw→cooked hook
  // (default 1). Deterministic: Σ qty_g × per-100g / 100.
  const f = (grams * yieldFactor) / 100;
  return {
    kcal: p.kcal * f,
    protein_g: p.protein_g * f,
    carbs_g: p.carbs_g * f,
    fat_g: p.fat_g * f,
  };
}

/**
 * Deterministic macro computation for a recipe. Nutrients come only from the
 * FDC store; nothing is guessed. Full per-ingredient traceability is retained.
 */
export function computeMacros(
  draft: RecipeDraft,
  resolutions: Map<string, Resolution>,
  byId: Map<number, FdcFood>,
): RecipeMacroResult {
  const perIngredient: IngredientContribution[] = [];
  let total = zeroEnergyMacros();
  const unresolved: string[] = [];

  for (const ing of draft.ingredients) {
    const res = resolutions.get(ing.name);
    const yieldFactor = ing.yieldFactor ?? 1;
    const food = res?.fdcId != null ? byId.get(res.fdcId) ?? null : null;

    if (!food) {
      unresolved.push(ing.name);
      perIngredient.push({
        name: ing.name,
        qty_g: ing.qty_g,
        yieldFactor,
        fdcId: res?.fdcId ?? null,
        matchedDescription: res?.matchedDescription ?? null,
        confidence: res?.confidence ?? 0,
        per100g: null,
        contribution: zeroEnergyMacros(),
      });
      continue;
    }

    const contribution = scale(food.per100g, ing.qty_g, yieldFactor);
    total = {
      kcal: total.kcal + contribution.kcal,
      protein_g: total.protein_g + contribution.protein_g,
      carbs_g: total.carbs_g + contribution.carbs_g,
      fat_g: total.fat_g + contribution.fat_g,
    };
    perIngredient.push({
      name: ing.name,
      qty_g: ing.qty_g,
      yieldFactor,
      fdcId: food.fdcId,
      matchedDescription: food.description,
      confidence: res?.confidence ?? 0,
      per100g: food.per100g,
      contribution,
    });
  }

  const servings = draft.servings;
  const perServing: EnergyMacros = {
    kcal: total.kcal / servings,
    protein_g: total.protein_g / servings,
    carbs_g: total.carbs_g / servings,
    fat_g: total.fat_g / servings,
  };

  return { perIngredient, total, servings, perServing, unresolved };
}
