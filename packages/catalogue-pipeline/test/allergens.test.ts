import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractAllergens, loadAllergenKeywords } from '../src/lints/allergens';

const here = dirname(fileURLToPath(import.meta.url));
const KEYWORDS = resolve(here, '../data/allergen-keywords.json');
const CATALOGUE = resolve(here, '../../../app/src/data/catalogue.generated.ts');
const kw = loadAllergenKeywords(KEYWORDS);

describe('allergen extractor', () => {
  // The regression: the whole-word boundary rejected a trailing plural `s`, so
  // "peanuts"/"eggs"/"walnuts"/"noodles" slipped through UNDECLARED — a safety hole.
  it('matches plural forms of allergen keywords', () => {
    expect(extractAllergens(['peanuts'], kw)).toContain('peanuts');
    expect(extractAllergens(['crushed walnuts'], kw)).toContain('tree_nuts');
    expect(extractAllergens(['rice noodles'], kw)).toContain('gluten');
    expect(extractAllergens(['2 eggs'], kw)).toContain('eggs');
  });

  it('still matches the singular form', () => {
    expect(extractAllergens(['peanut butter'], kw)).toContain('peanuts');
    expect(extractAllergens(['walnut'], kw)).toContain('tree_nuts');
  });

  it('does not over-match across word boundaries', () => {
    // "throat"/"goat" must not trigger the "oat" (gluten) keyword.
    expect(extractAllergens(['goat cheese'], kw)).not.toContain('gluten');
    // milk is still flagged from "goat cheese" (cheese → milk) — sanity that the row still works.
    expect(extractAllergens(['goat cheese'], kw)).toContain('milk');
  });
});

/** Parse the shipped catalogue array (gotcha: slice on `= [` INCLUDING the bracket). */
function loadShippedCatalogue(): Array<{ id: string; name: string; allergens: string[]; foodTokens: string[]; ingredients?: Array<{ name: string }> }> {
  const src = readFileSync(CATALOGUE, 'utf8');
  const start = src.indexOf('= [') + 2;
  const body = src.slice(start, src.lastIndexOf(']') + 1).replace(/,\s*\]$/, ']');
  return JSON.parse(body);
}

describe('shipped catalogue allergen integrity (build-failing guard)', () => {
  const pool = loadShippedCatalogue();

  it('has recipes', () => {
    expect(pool.length).toBeGreaterThan(400);
  });

  // The safety invariant: every allergen the extractor derives from a recipe's
  // ingredients MUST be present in its declared `allergens[]`. If this fails, a
  // recipe would be served to a user who is allergic to something in it.
  it('declares every extractable allergen for every recipe', () => {
    const drift: string[] = [];
    for (const r of pool) {
      const texts = [...(r.foodTokens ?? []), ...((r.ingredients ?? []).map((i) => i.name))];
      const extracted = extractAllergens(texts, kw);
      const declared = new Set(r.allergens ?? []);
      const missing = extracted.filter((a) => !declared.has(a));
      if (missing.length) drift.push(`${r.id} (${r.name}) missing [${missing.join(', ')}]`);
    }
    expect(drift, `Allergen drift — these recipes under-declare:\n${drift.join('\n')}`).toEqual([]);
  });
});
