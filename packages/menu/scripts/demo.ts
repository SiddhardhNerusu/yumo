/**
 * End-to-end demo: build a menu candidate pool from the real catalogue
 * (recipes → deterministic FDC macros), then generate a 7-day menu for a user
 * and show a "Mix it up" swap. `npm run menu:demo`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  loadStore,
  indexById,
  loadHazardDenylist,
  loadAllergenKeywords,
  runRecipe,
  type PipelineConfig,
} from '@usual/catalogue-pipeline';
import type { MealSlot } from '@usual/shared';
import { generateWeekMenu, mixItUp, type MenuRecipe, type UserProfile, type Effort } from '../src/index';

const menuDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cat = join(menuDir, '..', 'catalogue-pipeline');
const store = loadStore(join(cat, 'data', 'fdc-cache', 'foods.json'));
const byId = indexById(store);
const config: PipelineConfig = {
  hazardDenylist: loadHazardDenylist(join(cat, 'data', 'hazard-denylist.json')),
  allergenKeywords: loadAllergenKeywords(join(cat, 'data', 'allergen-keywords.json')),
};
const draftDir = join(cat, 'data', 'recipes-draft');

// Build the pool from fully-resolved catalogue recipes (accurate macros only).
const pool: MenuRecipe[] = [];
for (const f of readdirSync(draftDir).filter((x) => x.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(draftDir, f), 'utf8')) as {
    cuisine?: string; slotAffinity?: MealSlot[]; effort?: Effort; ingredients?: Array<{ name: string }>;
  };
  const res = runRecipe(raw, store, byId, config);
  if (!res.schemaOk || !res.perServingRounded || !res.macros || res.macros.unresolved.length > 0) continue;
  pool.push({
    id: res.id ?? f,
    name: res.name ?? f,
    cuisine: raw.cuisine ?? 'unknown',
    slotAffinity: raw.slotAffinity ?? ['lunch', 'dinner'],
    effort: raw.effort ?? '15min',
    perServing: res.perServingRounded,
    allergens: res.allergens,
    foodTokens: (raw.ingredients ?? []).map((i) => String(i.name).toLowerCase()),
  });
}

const profile: UserProfile = {
  budgetKcal: 2200,
  targetWeightKg: 78,
  allergies: [],
  hates: ['tuna'],
  needs: ['chicken'],
  likes: ['rice', 'yogurt'],
  pantry: ['onion', 'rice'],
  variation: 'balanced',
  cuisineLean: { Indian: 1.5 },
};

console.log(`Pool: ${pool.length} fully-resolved catalogue recipes`);
console.log(`User: ${profile.budgetKcal} kcal/day · needs ${profile.needs.join(',')} · hates ${profile.hates.join(',')} · lean Indian\n`);

const plan = generateWeekMenu(pool, profile, { seed: 'sid-week-1', days: 7 });
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

for (const day of plan.days) {
  console.log(`── Day ${plan.days.indexOf(day) + 1}  (${Math.round(day.totalKcal)} kcal · ${Math.round(day.totalProtein_g)}g protein)`);
  for (const p of day.picks) {
    const line = `${p.slot.padEnd(9)} ${p.recipe.name.padEnd(30).slice(0, 30)} ${Math.round(p.kcal).toString().padStart(4)}kcal`;
    const why = p.reasons.length ? `  · ${p.reasons.slice(0, 2).join(', ')}` : '';
    console.log(`   ${line}${why}`);
  }
}

if (plan.warnings.length) console.log(`\n⚠ ${plan.warnings.length} warning(s): ${plan.warnings.slice(0, 3).join(' | ')}`);

// Mix it up: swap the first day's dinner.
const dinner = plan.days[0]?.picks.find((p) => p.slot === 'dinner');
if (dinner) {
  const alts = mixItUp(dinner.recipe, 'dinner', pool, profile);
  console.log(`\n🔀 Mix it up — "${dinner.recipe.name}" (${Math.round(dinner.recipe.perServing.kcal)}kcal, ${Math.round(dinner.recipe.perServing.protein_g)}g P):`);
  if (alts.length === 0) console.log('   (no isocaloric alternative in this pool)');
  for (const a of alts) {
    console.log(`   → ${a.name.padEnd(28).slice(0, 28)} ${Math.round(a.perServing.kcal)}kcal ${Math.round(a.perServing.protein_g)}g P · ${a.cuisine}`);
  }
}
console.log('');
