import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { store, byId, config } from './_helpers';
import { runRecipe } from '../src/pipeline';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const draftDir = join(pkgDir, 'data', 'recipes-draft');

function loadFixture(file: string): unknown {
  return JSON.parse(readFileSync(join(draftDir, file), 'utf8'));
}

describe('pipeline end-to-end', () => {
  it('marks a clean, fully-pinned recipe ready with correct allergens', () => {
    const result = runRecipe(loadFixture('fixture-02-yogurt-banana-breakfast.json'), store, byId, config);
    expect(result.status).toBe('ready');
    expect(result.verification?.passes).toBe(true);
    expect(result.allergens).toEqual(expect.arrayContaining(['milk', 'peanuts', 'gluten']));
    expect(result.reviewReasons).toEqual([]);
  });

  it('every fully-pinned fixture verifies within the 5% tolerance', () => {
    const files = [
      'fixture-01-chicken-rice-bowl.json',
      'fixture-02-yogurt-banana-breakfast.json',
      'fixture-03-blackbean-veg-bowl.json',
      'fixture-04-salmon-sweet-potato.json',
      'fixture-05-feta-chickpea-salad.json',
      'fixture-06-beef-pasta.json',
    ];
    for (const f of files) {
      const result = runRecipe(loadFixture(f), store, byId, config);
      expect(result.macros?.unresolved, `${f} unresolved`).toEqual([]);
      expect(result.verification?.passes, `${f} Δ=${result.verification?.deviationPct}`).toBe(true);
    }
  });

  it('HARD-rejects a recipe with a hazardous/non-food ingredient', () => {
    const poison = {
      id: 'poison',
      name: 'Definitely not food',
      cuisine: 'test',
      slotAffinity: ['dinner'],
      effort: '5min',
      servings: 1,
      steps: ['Mix and drink.'],
      ingredients: [
        { name: 'white rice, cooked', qty_g: 100 },
        { name: '2 tbsp bleach', qty_g: 30 },
      ],
    };
    const result = runRecipe(poison, store, byId, config);
    expect(result.status).toBe('rejected');
    expect(result.hazards.map((h) => h.token)).toContain('bleach');
    expect(result.macros).toBeNull(); // never even computed macros
  });

  it('routes raw high-risk protein without a cook step to human review', () => {
    const risky = {
      id: 'risky',
      name: 'Raw chicken plate',
      cuisine: 'test',
      slotAffinity: ['dinner'],
      effort: '5min',
      servings: 1,
      steps: ['Plate the chicken and serve immediately.'],
      ingredients: [{ name: 'raw chicken breast', qty_g: 150, fdcId: 171477 }],
    };
    const result = runRecipe(risky, store, byId, config);
    expect(result.status).toBe('needs_review');
    expect(result.reviewReasons.join(' ')).toMatch(/food-safety/);
  });

  it('rejects a schema-invalid recipe', () => {
    const result = runRecipe({ id: 'x', name: 'broken' }, store, byId, config);
    expect(result.status).toBe('rejected');
    expect(result.schemaOk).toBe(false);
  });
});
