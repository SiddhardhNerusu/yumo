import { readFileSync } from 'node:fs';
import type { Allergen } from '@yumo/shared';
import { ALLERGENS } from '@yumo/shared';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type AllergenKeywordMap = Record<Allergen, string[]>;

export function loadAllergenKeywords(path: string): AllergenKeywordMap {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const map = {} as AllergenKeywordMap;
  for (const a of ALLERGENS) {
    const list = parsed[a];
    map[a] = Array.isArray(list) ? (list as string[]).map((s) => s.toLowerCase()) : [];
  }
  return map;
}

/**
 * Extract allergens from ingredient names + resolved FDC descriptions
 * (§4.5 step 3). Conservative/additive — a hit flags; absence is not a
 * guarantee (composite foods still get "always check labels" downstream).
 */
export function extractAllergens(texts: string[], keywords: AllergenKeywordMap): Allergen[] {
  const found = new Set<Allergen>();
  const haystack = texts.join(' | ').toLowerCase();
  for (const allergen of ALLERGENS) {
    for (const kw of keywords[allergen]) {
      // Whole-word match, but tolerate a trailing plural: `peanut` MUST match
      // `peanuts`, `egg` → `eggs`, `walnut` → `walnuts`, `noodle` → `noodles`.
      // The old boundary `([^a-z]|$)` rejected the following `s` and silently
      // let plurals through undeclared — a safety hole. `(?:s|es)?` before the
      // boundary is strictly additive (over-flagging is the safe direction).
      const re = new RegExp(`(^|[^a-z])${escapeRegExp(kw)}(?:s|es)?([^a-z]|$)`, 'i');
      if (re.test(haystack)) {
        found.add(allergen);
        break;
      }
    }
  }
  return [...found];
}
