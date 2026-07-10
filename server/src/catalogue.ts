import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  loadStore,
  indexById,
  loadHazardDenylist,
  loadAllergenKeywords,
  runRecipe,
  type FdcStore,
  type PipelineConfig,
} from '@usual/catalogue-pipeline';
import type { MealSlot } from '@usual/shared';
import type { MenuRecipe, Effort } from '@usual/menu';

export interface RecipeDetail extends MenuRecipe {
  steps: string[];
  status: string; // ready | needs_review
}

export interface Catalogue {
  foods: FdcStore;
  /** fully macro-resolved recipes — safe for the menu engine. */
  pool: MenuRecipe[];
  details: Map<string, RecipeDetail>;
}

interface RawDraft {
  id?: string;
  name?: string;
  cuisine?: string;
  slotAffinity?: MealSlot[];
  effort?: Effort;
  steps?: string[];
  ingredients?: Array<{ name: string }>;
}

const here = dirname(fileURLToPath(import.meta.url));
const catDir = join(here, '..', '..', 'packages', 'catalogue-pipeline');

/** Build the runtime catalogue from the versioned catalogue data. In production
 * this is replaced by a DB read; here it reuses the offline pipeline directly. */
export function loadCatalogue(): Catalogue {
  const foods = loadStore(join(catDir, 'data', 'fdc-cache', 'foods.json'));
  const byId = indexById(foods);
  const config: PipelineConfig = {
    hazardDenylist: loadHazardDenylist(join(catDir, 'data', 'hazard-denylist.json')),
    allergenKeywords: loadAllergenKeywords(join(catDir, 'data', 'allergen-keywords.json')),
  };
  const draftDir = join(catDir, 'data', 'recipes-draft');

  const pool: MenuRecipe[] = [];
  const details = new Map<string, RecipeDetail>();

  for (const f of readdirSync(draftDir).filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(draftDir, f), 'utf8')) as RawDraft;
    const res = runRecipe(raw, foods, byId, config);
    if (!res.schemaOk || !res.perServingRounded || !res.id) continue;

    const recipe: RecipeDetail = {
      id: res.id,
      name: res.name ?? res.id,
      cuisine: raw.cuisine ?? 'unknown',
      slotAffinity: raw.slotAffinity ?? ['lunch', 'dinner'],
      effort: raw.effort ?? '15min',
      perServing: res.perServingRounded,
      allergens: res.allergens,
      foodTokens: (raw.ingredients ?? []).map((i) => String(i.name).toLowerCase()),
      steps: raw.steps ?? [],
      status: res.status,
    };
    details.set(recipe.id, recipe);
    if (res.macros && res.macros.unresolved.length === 0) pool.push(recipe);
  }

  return { foods, pool, details };
}
