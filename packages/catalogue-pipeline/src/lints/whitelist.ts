import { readFileSync } from 'node:fs';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function loadHazardDenylist(path: string): string[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { tokens?: string[] };
  return (parsed.tokens ?? []).map((t) => t.toLowerCase());
}

export interface HazardFlag {
  name: string;
  token: string;
}

/**
 * Ingredient whitelist / non-food gate (§4.5 step 1). Any ingredient whose
 * name contains a hazardous/non-food token is a HARD reject — the recipe never
 * reaches macro computation. Word-boundary matching keeps 'soap' from firing
 * inside a real food and supports multi-word tokens ('rat poison').
 */
export function screenHazards(ingredientNames: string[], denylist: string[]): HazardFlag[] {
  const flags: HazardFlag[] = [];
  for (const name of ingredientNames) {
    const lower = name.toLowerCase();
    for (const token of denylist) {
      const re = new RegExp(`(^|[^a-z])${escapeRegExp(token)}([^a-z]|$)`, 'i');
      if (re.test(lower)) {
        flags.push({ name, token });
        break;
      }
    }
  }
  return flags;
}
