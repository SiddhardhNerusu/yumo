// FDC layer
export type { FdcFood, FdcStore } from './fdc/store';
export { buildStore, saveStore, loadStore, indexById } from './fdc/store';
export { importFromRaw } from './fdc/importFdc';
export {
  resolveIngredient,
  tokenize,
  type Resolution,
  type ResolverCandidate,
  type ResolveOptions,
} from './fdc/resolve';

// Schema
export {
  recipeDraftSchema,
  ingredientSchema,
  validateRecipeDraft,
  MEAL_SLOTS,
  EFFORTS,
  type RecipeDraft,
  type RecipeIngredient,
  type SchemaValidation,
} from './schema';

// Compute + verify
export { computeMacros, type RecipeMacroResult, type IngredientContribution } from './macros';
export { verifyEnergyConsistency, type Verification } from './verify';

// Lints
export { loadHazardDenylist, screenHazards, type HazardFlag } from './lints/whitelist';
export { checkFoodSafety, type FoodSafetyResult } from './lints/foodSafety';
export { checkOutlier, type OutlierResult } from './lints/outlier';
export {
  loadAllergenKeywords,
  extractAllergens,
  type AllergenKeywordMap,
} from './lints/allergens';

// Pipeline
export {
  runRecipe,
  type RecipeStatus,
  type RecipeResult,
  type PipelineConfig,
} from './pipeline';
