import type { Allergen, EnergyMacros } from '@usual/shared';
import { roundEnergyMacros } from '@usual/shared';
import type { FdcFood, FdcStore } from './fdc/store';
import { resolveIngredient, type Resolution } from './fdc/resolve';
import { validateRecipeDraft } from './schema';
import { computeMacros, type RecipeMacroResult } from './macros';
import { verifyEnergyConsistency, type Verification } from './verify';
import { screenHazards, type HazardFlag } from './lints/whitelist';
import { checkFoodSafety, type FoodSafetyResult } from './lints/foodSafety';
import { checkOutlier, type OutlierResult } from './lints/outlier';
import { extractAllergens, type AllergenKeywordMap } from './lints/allergens';

/**
 * - `rejected`   : hard gate failed (schema or hazardous/non-food ingredient).
 * - `needs_review`: computed fine but a flag needs a human (low-confidence
 *                   match, unresolved item, food-safety, energy inconsistency,
 *                   or kcal outlier). Nothing reaches "live" un-reviewed anyway.
 * - `ready`      : passed every automated gate; awaiting human approve → live.
 */
export type RecipeStatus = 'rejected' | 'needs_review' | 'ready';

export interface PipelineConfig {
  hazardDenylist: string[];
  allergenKeywords: AllergenKeywordMap;
  autoAcceptThreshold?: number;
  outlierReferenceBudget?: number;
  atwaterTolerance?: number;
}

export interface RecipeResult {
  id: string | null;
  name: string | null;
  status: RecipeStatus;
  schemaOk: boolean;
  schemaErrors: string[];
  hazards: HazardFlag[];
  resolutions: Resolution[];
  macros: RecipeMacroResult | null;
  totalRounded: EnergyMacros | null;
  perServingRounded: EnergyMacros | null;
  verification: Verification | null;
  foodSafety: FoodSafetyResult | null;
  outlier: OutlierResult | null;
  allergens: Allergen[];
  reviewReasons: string[];
}

function rejected(partial: Partial<RecipeResult>): RecipeResult {
  return {
    id: null,
    name: null,
    status: 'rejected',
    schemaOk: false,
    schemaErrors: [],
    hazards: [],
    resolutions: [],
    macros: null,
    totalRounded: null,
    perServingRounded: null,
    verification: null,
    foodSafety: null,
    outlier: null,
    allergens: [],
    reviewReasons: [],
    ...partial,
  };
}

/** Run one draft recipe through the full pipeline (§4.5). Pure + deterministic. */
export function runRecipe(
  input: unknown,
  store: FdcStore,
  byId: Map<number, FdcFood>,
  config: PipelineConfig,
): RecipeResult {
  // 1. Schema — a stray authored macro field or a 7th step is a hard reject.
  const validation = validateRecipeDraft(input);
  if (!validation.ok || !validation.data) {
    return rejected({ schemaErrors: validation.errors, reviewReasons: ['schema invalid'] });
  }
  const draft = validation.data;
  const ingredientNames = draft.ingredients.map((i) => i.name);

  // 2. Hazard / non-food hard gate — before any nutrition work.
  const hazards = screenHazards(ingredientNames, config.hazardDenylist);
  if (hazards.length > 0) {
    return rejected({
      id: draft.id,
      name: draft.name,
      schemaOk: true,
      hazards,
      reviewReasons: [
        `hazardous/non-food ingredient(s): ${hazards.map((h) => `${h.name}→${h.token}`).join(', ')}`,
      ],
    });
  }

  // 3. Resolve each ingredient against FDC.
  const resolutions: Resolution[] = draft.ingredients.map((ing) =>
    resolveIngredient(ing.name, ing.fdcId, store, byId, {
      autoAcceptThreshold: config.autoAcceptThreshold,
    }),
  );
  const resByName = new Map<string, Resolution>();
  draft.ingredients.forEach((ing, i) => {
    const r = resolutions[i];
    if (r) resByName.set(ing.name, r);
  });

  // 4. Deterministic macro computation.
  const macros = computeMacros(draft, resByName, byId);

  // 5. Energy cross-check (Atwater).
  const verification = verifyEnergyConsistency(macros.total, config.atwaterTolerance ?? 0.05);

  // 6. Lints.
  const foodSafety = checkFoodSafety(ingredientNames, draft.steps);
  const outlier = checkOutlier(
    macros.perServing.kcal,
    [...draft.slotAffinity],
    config.outlierReferenceBudget ?? 2200,
  );
  const resolvedDescriptions = macros.perIngredient.map((p) => p.matchedDescription ?? '');
  const allergens = extractAllergens([...ingredientNames, ...resolvedDescriptions], config.allergenKeywords);

  // 7. Aggregate review reasons → status.
  const reviewReasons: string[] = [];
  if (foodSafety.flagged) reviewReasons.push(...foodSafety.reasons.map((r) => `food-safety: ${r}`));
  if (macros.unresolved.length > 0) {
    reviewReasons.push(`unresolved ingredient(s): ${macros.unresolved.join(', ')}`);
  }
  const lowConf = resolutions.filter((r) => r.needsReview && r.fdcId != null);
  if (lowConf.length > 0) {
    reviewReasons.push(
      `low-confidence match(es): ${lowConf.map((r) => `${r.query} (${r.confidence.toFixed(2)})`).join(', ')}`,
    );
  }
  if (!verification.passes) {
    reviewReasons.push(
      `energy inconsistency ${(verification.deviationPct * 100).toFixed(1)}% > ${(verification.tolerance * 100).toFixed(0)}%`,
    );
  }
  if (outlier.flagged && outlier.reason) reviewReasons.push(`outlier: ${outlier.reason}`);

  const status: RecipeStatus = reviewReasons.length > 0 ? 'needs_review' : 'ready';

  return {
    id: draft.id,
    name: draft.name,
    status,
    schemaOk: true,
    schemaErrors: [],
    hazards: [],
    resolutions,
    macros,
    totalRounded: roundEnergyMacros(macros.total),
    perServingRounded: roundEnergyMacros(macros.perServing),
    verification,
    foodSafety,
    outlier,
    allergens,
    reviewReasons,
  };
}
