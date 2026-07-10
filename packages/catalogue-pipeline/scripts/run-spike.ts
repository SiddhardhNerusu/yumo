/**
 * Recipe-pipeline spike (§4.5 / Phase-0 acceptance). Runs every draft recipe in
 * data/recipes-draft through the full pipeline and reports:
 *   - status distribution (ready / needs_review / rejected)
 *   - per-recipe energy + macros + Atwater deviation
 *   - resolver confidence distribution (auto-accept vs human queue)
 *   - acceptance: how many recipes verify at ≤5% kcal deviation
 *
 *   npm run spike
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadStore, indexById } from '../src/fdc/store';
import { loadHazardDenylist } from '../src/lints/whitelist';
import { loadAllergenKeywords } from '../src/lints/allergens';
import { runRecipe, type PipelineConfig, type RecipeResult } from '../src/pipeline';
import { buildReviewHtml, type ReviewEntry } from '../src/review';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const storePath = join(pkgDir, 'data', 'fdc-cache', 'foods.json');
const draftDir = join(pkgDir, 'data', 'recipes-draft');
const resultsPath = join(pkgDir, 'data', 'spike-results.json');
const reviewPath = join(pkgDir, 'data', 'review.html');

if (!existsSync(storePath)) {
  console.error(`FDC store not found at ${storePath}. Run "npm run fetch:fdc" first.`);
  process.exit(1);
}

const store = loadStore(storePath);
const byId = indexById(store);
const config: PipelineConfig = {
  hazardDenylist: loadHazardDenylist(join(pkgDir, 'data', 'hazard-denylist.json')),
  allergenKeywords: loadAllergenKeywords(join(pkgDir, 'data', 'allergen-keywords.json')),
  autoAcceptThreshold: 0.9,
  outlierReferenceBudget: 2200,
  atwaterTolerance: 0.05,
};

const files = existsSync(draftDir)
  ? readdirSync(draftDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : [];

if (files.length === 0) {
  console.error(`No draft recipes in ${draftDir}.`);
  process.exit(1);
}

console.log(`FDC store: ${store.count} foods (${store.datasets.join(', ')})`);
console.log(`Running ${files.length} draft recipes through the pipeline…\n`);

const results: ReviewEntry[] = [];
let ingredientsTotal = 0;
let ingredientsAutoAccepted = 0;
let atwaterChecked = 0;
let atwaterPassed = 0;
let maxDeviation = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(draftDir, file), 'utf8')) as ReviewEntry['raw'];
  const result = runRecipe(raw, store, byId, config);
  results.push({ file, raw, result });

  const badge =
    result.status === 'ready' ? '✅ ready' : result.status === 'needs_review' ? '🟡 review' : '❌ reject';
  const ps = result.perServingRounded;
  const macroStr = ps ? `${ps.kcal}kcal  P${ps.protein_g} C${ps.carbs_g} F${ps.fat_g}` : '—';
  const dev = result.verification ? `${(result.verification.deviationPct * 100).toFixed(1)}%` : '—';
  console.log(`${badge}  ${(result.name ?? file).padEnd(34).slice(0, 34)}  ${macroStr.padEnd(28)} Δ${dev}`);
  if (result.allergens.length) console.log(`         allergens: ${result.allergens.join(', ')}`);
  for (const reason of result.reviewReasons) console.log(`         • ${reason}`);

  for (const r of result.resolutions) {
    ingredientsTotal++;
    if (!r.needsReview && r.fdcId != null) ingredientsAutoAccepted++;
  }
  if (result.verification && result.macros && result.macros.unresolved.length === 0) {
    atwaterChecked++;
    if (result.verification.passes) atwaterPassed++;
    maxDeviation = Math.max(maxDeviation, result.verification.deviationPct);
  }
}

const ready = results.filter((r) => r.result.status === 'ready').length;
const review = results.filter((r) => r.result.status === 'needs_review').length;
const reject = results.filter((r) => r.result.status === 'rejected').length;

console.log('\n────────────────────────── SPIKE SUMMARY ──────────────────────────');
console.log(`Recipes:        ${results.length}  →  ✅ ${ready} ready   🟡 ${review} review   ❌ ${reject} reject`);
console.log(
  `Ingredients:    ${ingredientsTotal}  →  ${ingredientsAutoAccepted} auto-accepted (≥0.90), ${ingredientsTotal - ingredientsAutoAccepted} to human queue`,
);
console.log(
  `Energy check:   ${atwaterPassed}/${atwaterChecked} fully-resolved recipes pass ≤5% Atwater deviation (max Δ ${(maxDeviation * 100).toFixed(1)}%)`,
);
console.log('─────────────────────────────────────────────────────────────────');

writeFileSync(resultsPath, JSON.stringify({ generatedFrom: files, results }, null, 2));
writeFileSync(reviewPath, buildReviewHtml(results));
console.log(`\nFull results → ${resultsPath}`);
console.log(`Review page  → ${reviewPath}   (open in a browser)`);
