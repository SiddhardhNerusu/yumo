/**
 * Run ONLY the snack-*.json drafts through the pipeline and print results +
 * write them to data/snack-results.json. Kept separate from run-spike so the
 * re-authored steps already baked into the app catalogue aren't clobbered.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadStore, indexById } from '../src/fdc/store';
import { loadHazardDenylist } from '../src/lints/whitelist';
import { loadAllergenKeywords } from '../src/lints/allergens';
import { runRecipe, type PipelineConfig } from '../src/pipeline';
import type { ReviewEntry } from '../src/review';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const store = loadStore(join(pkgDir, 'data', 'fdc-cache', 'foods.json'));
const byId = indexById(store);
const config: PipelineConfig = {
  hazardDenylist: loadHazardDenylist(join(pkgDir, 'data', 'hazard-denylist.json')),
  allergenKeywords: loadAllergenKeywords(join(pkgDir, 'data', 'allergen-keywords.json')),
  autoAcceptThreshold: 0.9,
  outlierReferenceBudget: 2200,
  atwaterTolerance: 0.05,
};

const draftDir = join(pkgDir, 'data', 'recipes-draft');
const files = readdirSync(draftDir).filter((f) => f.startsWith('snack-') && f.endsWith('.json')).sort();
const results: ReviewEntry[] = [];
for (const file of files) {
  const raw = JSON.parse(readFileSync(join(draftDir, file), 'utf8')) as ReviewEntry['raw'];
  const result = runRecipe(raw, store, byId, config);
  results.push({ file, raw, result });
  const ps = result.perServingRounded;
  const dev = result.verification ? `${(result.verification.deviationPct * 100).toFixed(1)}%` : '—';
  const badge = result.status === 'ready' ? '✅' : result.status === 'needs_review' ? '🟡' : '❌';
  console.log(`${badge} ${(result.name ?? file).padEnd(30).slice(0, 30)} ${ps ? `${ps.kcal}kcal P${ps.protein_g}` : '—'} Δ${dev}`);
  for (const r of result.resolutions) if (r.needsReview) console.log(`     ? ${r.query} → ${r.matchedDescription ?? 'NO MATCH'} (${r.confidence.toFixed(2)})`);
}
writeFileSync(join(pkgDir, 'data', 'snack-results.json'), JSON.stringify({ results }, null, 2));
const ready = results.filter((r) => r.result.status === 'ready').length;
const review = results.filter((r) => r.result.status === 'needs_review').length;
const reject = results.filter((r) => r.result.status === 'rejected').length;
console.log(`\n${results.length} snacks → ✅ ${ready} ready · 🟡 ${review} review · ❌ ${reject} reject`);
if (existsSync(join(pkgDir, 'data', 'snack-results.json'))) console.log('wrote data/snack-results.json');
