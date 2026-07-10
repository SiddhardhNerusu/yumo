/**
 * Build the local FDC nutrient store from the bulk JSON, and smoke-test both
 * the import and the resolver. Downloads the raw bulk files if missing.
 *
 *   npm run fetch:fdc
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { importFromRaw } from '../src/fdc/importFdc';
import { buildStore, saveStore, indexById } from '../src/fdc/store';
import { resolveIngredient } from '../src/fdc/resolve';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rawDir = join(pkgDir, 'data', 'fdc-raw');
const cacheDir = join(pkgDir, 'data', 'fdc-cache');
const storePath = join(cacheDir, 'foods.json');

const SR_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip';
const FO_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2025-04-24.zip';

function findRaw(pattern: RegExp): string | null {
  if (!existsSync(rawDir)) return null;
  const hit = readdirSync(rawDir).find((f) => pattern.test(f) && f.endsWith('.json'));
  return hit ? join(rawDir, hit) : null;
}

function ensureRaw(): { sr: string; fo: string } {
  let sr = findRaw(/sr_legacy/i);
  let fo = findRaw(/foundation/i);
  if (!sr || !fo) {
    console.log('Raw FDC files missing — downloading (~14MB zipped)…');
    mkdirSync(rawDir, { recursive: true });
    if (!sr) {
      execSync(`curl -sL -o "${join(rawDir, 'sr_legacy.zip')}" "${SR_URL}"`, { stdio: 'inherit' });
      execSync(`unzip -o -q "${join(rawDir, 'sr_legacy.zip')}" -d "${rawDir}"`, { stdio: 'inherit' });
      sr = findRaw(/sr_legacy/i);
    }
    if (!fo) {
      execSync(`curl -sL -o "${join(rawDir, 'foundation.zip')}" "${FO_URL}"`, { stdio: 'inherit' });
      execSync(`unzip -o -q "${join(rawDir, 'foundation.zip')}" -d "${rawDir}"`, { stdio: 'inherit' });
      fo = findRaw(/foundation/i);
    }
  }
  if (!sr || !fo) throw new Error('Could not locate or download FDC raw JSON files.');
  return { sr, fo };
}

const { sr, fo } = ensureRaw();
console.log('Importing FDC bulk JSON…');
const foods = importFromRaw(sr, fo);
const store = buildStore(foods, ['SR Legacy 2018-04', 'Foundation Foods 2025-04-24']);
mkdirSync(cacheDir, { recursive: true });
saveStore(storePath, store);

const complete = foods.filter((f) => f.complete).length;
console.log(`\nWrote ${foods.length} foods (${complete} with all four macros) → ${storePath}`);

console.log('\nResolver + import smoke-test:');
const byId = indexById(store);
const probes = [
  'chicken breast, cooked',
  'olive oil',
  'white rice, cooked',
  'broccoli, cooked',
  'cheddar cheese',
  'banana, raw',
  'egg, whole, cooked',
  'lentils, cooked',
  'salmon, cooked',
  'greek yogurt, plain',
];
for (const q of probes) {
  const r = resolveIngredient(q, undefined, store, byId);
  const food = r.fdcId != null ? byId.get(r.fdcId) ?? null : null;
  const tag = r.needsReview ? '(review)' : '        ';
  const detail = food
    ? `${Math.round(food.per100g.kcal)}kcal P${food.per100g.protein_g} C${food.per100g.carbs_g} F${food.per100g.fat_g} — ${food.description} [${food.fdcId}]`
    : 'UNRESOLVED';
  console.log(`  ${r.confidence.toFixed(2)} ${tag} "${q}" → ${detail}`);
}
