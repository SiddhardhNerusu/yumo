import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadStore, indexById } from '../src/fdc/store';
import { loadHazardDenylist } from '../src/lints/whitelist';
import { loadAllergenKeywords } from '../src/lints/allergens';
import type { PipelineConfig } from '../src/pipeline';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));

export const store = loadStore(join(pkgDir, 'data', 'fdc-cache', 'foods.json'));
export const byId = indexById(store);

export const config: PipelineConfig = {
  hazardDenylist: loadHazardDenylist(join(pkgDir, 'data', 'hazard-denylist.json')),
  allergenKeywords: loadAllergenKeywords(join(pkgDir, 'data', 'allergen-keywords.json')),
  autoAcceptThreshold: 0.9,
  outlierReferenceBudget: 2200,
  atwaterTolerance: 0.05,
};
