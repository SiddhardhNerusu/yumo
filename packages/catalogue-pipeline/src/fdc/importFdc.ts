import { readFileSync } from 'node:fs';
import type { FdcFood } from './store';

interface RawNutrient {
  nutrient?: { number?: string; unitName?: string };
  amount?: number;
}
interface RawFood {
  fdcId?: number;
  description?: string;
  foodNutrients?: RawNutrient[];
}

// FDC nutrient "number" codes. Energy is preferred as 208 (kcal); some
// Foundation foods only carry Atwater general/specific energy (957/958),
// which are also kcal — used as fallbacks.
const ENERGY_NUMBERS = ['208', '958', '957'];
const PROTEIN = '203';
const FAT = '204';
const CARBS = '205'; // carbohydrate, by difference

function pickAmount(
  nutrients: RawNutrient[],
  numbers: readonly string[],
  requireKcal = false,
): number | undefined {
  for (const num of numbers) {
    const hit = nutrients.find(
      (n) =>
        n.nutrient?.number === num &&
        typeof n.amount === 'number' &&
        (!requireKcal || n.nutrient?.unitName?.toUpperCase() === 'KCAL'),
    );
    if (hit && typeof hit.amount === 'number') return hit.amount;
  }
  return undefined;
}

function extractFood(raw: RawFood, dataType: FdcFood['dataType']): FdcFood | null {
  if (typeof raw.fdcId !== 'number' || !raw.description) return null;
  const nutrients = raw.foodNutrients ?? [];
  const kcal = pickAmount(nutrients, ENERGY_NUMBERS, true);
  if (kcal === undefined) return null; // energy is mandatory
  const protein = pickAmount(nutrients, [PROTEIN]);
  const fat = pickAmount(nutrients, [FAT]);
  const carbs = pickAmount(nutrients, [CARBS]);
  return {
    fdcId: raw.fdcId,
    description: raw.description.trim(),
    dataType,
    per100g: {
      kcal,
      protein_g: protein ?? 0,
      carbs_g: carbs ?? 0,
      fat_g: fat ?? 0,
    },
    complete: protein !== undefined && fat !== undefined && carbs !== undefined,
  };
}

/** Parse the two FDC bulk JSON files into normalized food rows. */
export function importFromRaw(srLegacyPath: string, foundationPath: string): FdcFood[] {
  const foods: FdcFood[] = [];

  const sr = JSON.parse(readFileSync(srLegacyPath, 'utf8')) as { SRLegacyFoods?: RawFood[] };
  for (const raw of sr.SRLegacyFoods ?? []) {
    const food = extractFood(raw, 'sr_legacy');
    if (food) foods.push(food);
  }

  const fo = JSON.parse(readFileSync(foundationPath, 'utf8')) as { FoundationFoods?: RawFood[] };
  for (const raw of fo.FoundationFoods ?? []) {
    const food = extractFood(raw, 'foundation');
    if (food) foods.push(food);
  }

  return foods;
}
