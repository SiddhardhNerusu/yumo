import vocab from '../scaling-vocab.json';

/**
 * Recipe portion scaling (§5.4), moved out of the app so it is unit-tested. The
 * three former inline food regexes now build from `scaling-vocab.json` (DATA, not
 * code — the owner rule). Behaviour is byte-identical to repo.ts's originals;
 * `scaling.test.ts` asserts the data-built regexes accept/reject exactly the same
 * tokens as the hand-written ones.
 */

type VocabEntry = string | { word: string; notFollowedBy: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One case-insensitive `\b(a|b|…)\b` regex from a vocab list. A {word,
 * notFollowedBy} entry appends a negative lookahead (regex fragment, NOT escaped). */
function buildRegex(entries: readonly VocabEntry[]): RegExp {
  const parts = entries.map((e) => (typeof e === 'string' ? escapeRe(e) : `${escapeRe(e.word)}(?!${e.notFollowedBy})`));
  return new RegExp(`\\b(${parts.join('|')})\\b`, 'i');
}

const LIQUID = buildRegex(vocab.liquid as VocabEntry[]); // "cream cheese" is a solid → g, not ml
const SPOONABLE = buildRegex(vocab.spoonable as VocabEntry[]);
/** §5.4 seasonings, oil and aromatics stay fixed when a portion scales — you don't
 * double the salt for a 2× serving. Everything else scales with the portion. */
const FIXED_WHEN_SCALED = buildRegex(vocab.fixedWhenScaled as VocabEntry[]);
// Whole-unit counts that DO scale in step prose ("2 eggs" → "3"). Built from the
// same vocab file as the other food lists (no hardcoded food alternation in code).
// `(?:egg|tortilla|slice)s?` reproduces the former inline `(eggs?|tortillas?|slices?)`.
const COUNTABLE_ALT = (vocab.countable as string[]).map(escapeRe).join('|');
const RANGE_COUNT_RE = new RegExp(`\\b(\\d+)\\s*-\\s*(\\d+)\\s+((?:${COUNTABLE_ALT})s?)\\b`, 'gi');
const SINGLE_COUNT_RE = new RegExp(`\\b(\\d+)\\s+((?:${COUNTABLE_ALT})s?)\\b`, 'gi');

/** Human-friendly quantity: grams for solids, ml for liquids, tsp/tbsp for oils/condiments. */
export function formatQty(name: string, g: number): string {
  if (g <= 0) return '';
  if (SPOONABLE.test(name) && g <= 45) {
    if (g <= 7) return '1 tsp';
    const tbsp = g / 15;
    if (Math.abs(tbsp - Math.round(tbsp)) <= 0.34) return `${Math.round(tbsp)} tbsp`;
    return `${g}g`;
  }
  if (LIQUID.test(name)) return `${g}ml`;
  return `${g}g`;
}

/** Clean rounding so scaled grams read like a recipe, not a lab (185→190, 22→20). */
export const roundQty = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)));

export function scaleIngredient(i: { name: string; qty_g: number }, scale: number): { name: string; qty_g: number } {
  if (scale === 1 || FIXED_WHEN_SCALED.test(i.name)) return i;
  return { name: i.name, qty_g: roundQty(i.qty_g * scale) };
}

/** Scale the amounts written into a step's prose (150g → 225g, 2 eggs → 3) without
 * touching times, temperatures, or fixed seasonings/oil (§5.4). */
const countWord = (n: number, word: string) =>
  n === 1 ? word.replace(/s$/i, '') : word.endsWith('s') ? word : `${word}s`;

export function scaleStepText(step: string, scale: number): string {
  if (scale === 1) return step;
  let out = step.replace(/(\d+(?:\.\d+)?)\s*(g|ml)\b/gi, (m, num: string, unit: string, off: number, whole: string) => {
    if (FIXED_WHEN_SCALED.test(whole.slice(Math.max(0, off - 26), off + 26))) return m;
    return `${roundQty(parseFloat(num) * scale)}${unit.toLowerCase()}`;
  });
  // whole-unit counts: ranges first ("1-2 slices"), then singles, with clean pluralisation.
  out = out.replace(RANGE_COUNT_RE, (_m, a: string, b: string, word: string) => {
    const lo = Math.max(1, Math.round(parseInt(a, 10) * scale));
    const hi = Math.max(1, Math.round(parseInt(b, 10) * scale));
    return lo === hi ? `${lo} ${countWord(lo, word)}` : `${lo}-${hi} ${countWord(hi, word)}`;
  });
  out = out.replace(SINGLE_COUNT_RE, (_m, num: string, word: string) => {
    const n = Math.max(1, Math.round(parseInt(num, 10) * scale));
    return `${n} ${countWord(n, word)}`;
  });
  return out;
}

/** Clean-portion label for the recipe sheet: ½ · 1½ · 2 portions (blank at 1×). */
export function portionLabel(scale: number): string | undefined {
  if (Math.abs(scale - 1) < 1e-6) return undefined;
  const frac: Record<string, string> = { '0.5': '½', '1.5': '1½', '2': '2', '2.5': '2½', '3': '3' };
  const key = String(Number(scale.toFixed(2)).valueOf());
  const label = frac[key] ?? `${scale.toFixed(1)}×`;
  return `${label} portion${scale > 1 ? 's' : ''}`;
}
