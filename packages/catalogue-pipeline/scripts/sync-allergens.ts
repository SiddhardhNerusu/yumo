/**
 * Reproducible allergen sync (safety-critical).
 *
 * The served catalogue artifacts carry a per-recipe `allergens[]` that the menu
 * engine's HARD gate (`isAllowed`) trusts. If those arrays drift from what the
 * current extractor derives, an allergic user can be served a recipe containing
 * their allergen. This happened: a plural-form bug in the extractor was fixed in
 * code, but the SERVER artifact (`catalogue.built.json`) was never regenerated,
 * so it kept under-declaring peanuts/tree-nuts on 15 live recipes.
 *
 * This script re-runs the CURRENT `extractAllergens` over every recipe's
 * ingredient names + food tokens in BOTH shipped artifacts and UNIONS the result
 * into the declared list (additive only — over-declaring is the safe direction;
 * we never remove a human-declared allergen). It preserves every other field,
 * including the re-authored steps/methods that live only in the app artifact.
 *
 * Run: `npm run build:allergens` (root) — idempotent. The vitest guard in
 * test/allergens.test.ts fails the build if any pool recipe ever drifts again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractAllergens, loadAllergenKeywords } from '../src/lints/allergens';

const here = dirname(fileURLToPath(import.meta.url));
const KEYWORDS = resolve(here, '../data/allergen-keywords.json');
const BUILT = resolve(here, '../data/catalogue.built.json');
const GENERATED = resolve(here, '../../../app/src/data/catalogue.generated.ts');
const kw = loadAllergenKeywords(KEYWORDS);

interface Recipe {
  id: string;
  name?: string;
  allergens?: string[];
  foodTokens?: string[];
  ingredients?: Array<{ name: string }>;
}

/** Union declared + freshly-extracted allergens; returns the new array + whether it grew. */
function reextract(r: Recipe): { allergens: string[]; added: string[] } {
  const texts = [...(r.foodTokens ?? []), ...((r.ingredients ?? []).map((i) => i.name))];
  const extracted = extractAllergens(texts, kw);
  const declared = new Set(r.allergens ?? []);
  const added = extracted.filter((a) => !declared.has(a));
  return { allergens: [...new Set([...(r.allergens ?? []), ...extracted])], added };
}

function syncBuilt(): number {
  const built = JSON.parse(readFileSync(BUILT, 'utf8')) as { details: Recipe[]; poolIds: string[] };
  let changed = 0;
  for (const d of built.details) {
    const { allergens, added } = reextract(d);
    if (added.length) {
      d.allergens = allergens;
      changed++;
      console.log(`  [built] ${d.id.padEnd(24)} +[${added.join(', ')}]`);
    }
  }
  writeFileSync(BUILT, JSON.stringify(built)); // preserve the minified single-line format
  return changed;
}

function syncGenerated(): number {
  const src = readFileSync(GENERATED, 'utf8');
  // Slice on '= [' INCLUDING the bracket — the `MenuSeedRecipe[]` TYPE also contains
  // a '[', so indexOf('[') would find the wrong one and corrupt the file.
  const start = src.indexOf('= [') + 2;
  const end = src.lastIndexOf(']');
  const body = src.slice(start, end + 1).replace(/,\s*\]$/, ']');
  const pool = JSON.parse(body) as Recipe[];
  let changed = 0;
  for (const r of pool) {
    const { allergens, added } = reextract(r);
    if (added.length) {
      r.allergens = allergens;
      changed++;
      console.log(`  [app]   ${r.id.padEnd(24)} +[${added.join(', ')}]`);
    }
  }
  const lines = pool.map((r) => '  ' + JSON.stringify(r) + ',');
  writeFileSync(GENERATED, src.slice(0, start) + '[\n' + lines.join('\n') + '\n]' + src.slice(end + 1));
  return changed;
}

const b = syncBuilt();
const a = syncGenerated();
console.log(`allergen sync: ${b} server + ${a} app recipe(s) updated`);
