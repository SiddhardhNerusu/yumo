import { z } from 'zod';

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const EFFORTS = ['5min', '15min', '30min+'] as const;

/**
 * One recipe ingredient. `name` drives FDC resolution + display; `fdcId` is an
 * optional pin for traceability/determinism (§4.2 keeps fdc_id on
 * recipe_ingredients). Note: NO nutrient fields — macros are computed, never
 * authored (§1.5).
 */
export const ingredientSchema = z
  .object({
    name: z.string().min(2),
    qty_g: z.number().positive(),
    fdcId: z.number().int().positive().optional(),
    prep: z.string().optional(),
    note: z.string().optional(),
    /** Cooked/raw mass conversion (FNDDS yield). Defaults to 1 (as-consumed). */
    yieldFactor: z.number().positive().max(4).optional(),
  })
  .strict();

/**
 * A draft recipe as authored by the LLM against this schema (§4.5 step 1).
 * `.strict()` means a stray authored `kcal`/`macros` field is a hard schema
 * error — the "macros never authored" rule is enforced at the door.
 */
export const recipeDraftSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(2),
    cuisine: z.string().min(2),
    slotAffinity: z.array(z.enum(MEAL_SLOTS)).min(1),
    effort: z.enum(EFFORTS),
    servings: z.number().int().positive().default(1),
    methodTags: z.array(z.string()).default([]),
    steps: z.array(z.string().min(3)).min(1).max(6), // ≤6 steps, one sentence each (§4.2)
    ingredients: z.array(ingredientSchema).min(1),
  })
  .strict();

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;
export type RecipeIngredient = z.infer<typeof ingredientSchema>;

export interface SchemaValidation {
  ok: boolean;
  data: RecipeDraft | null;
  errors: string[];
}

export function validateRecipeDraft(input: unknown): SchemaValidation {
  const result = recipeDraftSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data, errors: [] };
  return {
    ok: false,
    data: null,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
