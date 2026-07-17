import { parseAddUtterance, resolveFood, type FoodVocabEntry } from './voiceAdd';

/**
 * Receipt → kitchen items (§M6, on-device OCR). PURE: takes already-recognised
 * lines + the kitchen food vocab and returns confirmed matches + the lines it
 * couldn't read. The app supplies ML Kit's `TextLine[]` (text + optional `top`
 * for two-column price re-pairing) and `buildFoodVocab(kitchen.items)`.
 *
 * Matching reuses `resolveFood` (Dice + word-overlap + Levenshtein, floor 0.62)
 * with `parseAddUtterance` in front to strip quantities/containers — NOT the
 * kitchen's `tokenMatch`, which has no stemming and misses plural receipt lines.
 *
 * D17: `resolveFood` can canonicalise a plain plural to a *qualified* variant
 * ("tomatoes" → "tinned tomatoes") when the plain token is absent from the vocab.
 * We DON'T hide that — a match whose token carries a qualifying word the receipt
 * line never said is flagged `variant: true` so the confirm sheet can surface it
 * un-ticked (opt-in) instead of silently stocking the wrong food.
 */

export interface ReceiptLine {
  text: string;
  /** vertical position (ML Kit `frame.top`) — reserved for price re-pairing. */
  top?: number;
}
export interface ReceiptMatch {
  token: string;
  label: string;
  price?: number;
  /** true = a best-guess qualified variant of what the line said (see D17). */
  variant: boolean;
  /** the raw receipt line, for the confirm sheet + debugging. */
  line: string;
}
export interface ReceiptParse {
  matches: ReceiptMatch[];
  unmatched: string[];
}

// Receipt STRUCTURE vocabulary (totals, payment, tax) — not food content, so this
// small stop-list doesn't violate the no-food-lists rule. resolveFood's 0.62 floor
// rejects most of these anyway; this is a cheap pre-filter.
const STOP = /\b(total|subtotal|card|cash|change|balance|vat|tax|points|visa|mastercard|debit|credit|payment|tender|amount due|thank you|receipt|invoice|qty|item)\b/i;
const PRICE_RE = /([£$€]?)(\d+)[.,](\d{2})\s*$/;
const hasLetters = (s: string) => /[a-z]/i.test(s);
/** Crude singularising stem so plural receipt words match singular tokens
 * (tomatoes→tomato, berries→berry, eggs→egg) — enough for the variant check. */
const stem = (w: string) =>
  w
    .replace(/ies$/, 'y')
    .replace(/(oes|ses|xes|zes|ches|shes)$/, (m) => m.slice(0, -2))
    .replace(/s$/, '');

/** Strip the trailing price + leading "2x"/weight noise; return the food body. */
function normalize(raw: string): { body: string; price?: number } {
  let s = raw.trim();
  let price: number | undefined;
  const pm = s.match(PRICE_RE);
  if (pm) {
    price = parseInt(pm[2]!, 10) + parseInt(pm[3]!, 10) / 100;
    s = s.slice(0, pm.index ?? s.length).trim();
  }
  s = s
    .replace(/^\s*\d+\s*[x×]\s*/i, '') // "2x apples"
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|ml|l|lb|oz)\b/gi, ' ') // "0.454kg", "500 g"
    .replace(/\s+/g, ' ')
    .trim();
  return { body: s, price };
}

export function parseReceipt(lines: ReceiptLine[], vocab: FoodVocabEntry[]): ReceiptParse {
  const matches: ReceiptMatch[] = [];
  const unmatched: string[] = [];

  for (const line of lines) {
    const raw = (line.text ?? '').trim();
    if (!raw || !hasLetters(raw) || STOP.test(raw)) continue; // structure line, skip
    const { body, price } = normalize(raw);
    if (!body || !hasLetters(body)) continue;

    // strip quantity/container/filler → the food phrase
    const parsed = parseAddUtterance(body);
    const phrase = parsed.length ? parsed[0]!.phrase : body.toLowerCase();
    const res = resolveFood(phrase, vocab);

    if (res.canonical) {
      // variant iff the matched token has a QUALIFIER the receipt line never said
      // ("tomatoes" → token "tinned tomatoes": "tinned" was never on the receipt).
      // Stem first so "eggs" → "egg" is NOT flagged — that's a plural, not a variant.
      const said = new Set([...phrase.toLowerCase().split(/\s+/)].filter(Boolean).map(stem));
      const tokenWords = res.token.toLowerCase().split(/[\s_]+/).filter(Boolean).map(stem);
      const variant = !tokenWords.every((w) => said.has(w));
      matches.push({ token: res.token, label: res.label, ...(price != null ? { price } : {}), variant, line: raw });
    } else {
      unmatched.push(raw);
    }
  }

  return { matches, unmatched };
}
