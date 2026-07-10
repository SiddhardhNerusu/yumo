import type { FdcFood, FdcStore } from './store';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'with', 'in', 'on', 'by', 'or', 'to', 'for', 'from', 'plus',
]);

/** Light singularization so "banana" matches FDC's "Bananas". Conservative —
 * applied identically to query and description so it never mis-aligns. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`; // berries → berry
  if (t.length > 4 && t.endsWith('oes')) return t.slice(0, -2); // potatoes → potato
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) {
    return t.slice(0, -1); // lentils → lentil (but keep hummus, glass)
  }
  return t;
}

/** Lowercase, strip punctuation, drop stopwords, singularize. Keeps prep words
 * like "cooked"/"raw" — they distinguish energy profiles and must survive. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(stem);
}

/** The food category — everything before the first comma in an FDC description
 * ("Oil, olive, salad or cooking" → "oil"). This is the strongest signal for
 * whether a row IS the food vs. merely CONTAINS it. */
function categoryHead(description: string): string[] {
  const head = description.split(',')[0] ?? description;
  return tokenize(head);
}

export interface ResolverCandidate {
  fdcId: number;
  description: string;
  score: number;
}

export interface Resolution {
  query: string;
  method: 'pinned' | 'auto' | 'unresolved';
  fdcId: number | null;
  matchedDescription: string | null;
  /** 0..1. 1 for a valid pin; the top match score for an auto resolve. */
  confidence: number;
  /** confidence below the accept threshold, or an invalid pin — routes to the human queue. */
  needsReview: boolean;
  alternatives: ResolverCandidate[];
}

export interface ResolveOptions {
  /** Accept an auto match without review at/above this confidence (§4.5: 0.9). */
  autoAcceptThreshold?: number;
  keepAlternatives?: number;
}

const DEFAULTS: Required<ResolveOptions> = { autoAcceptThreshold: 0.9, keepAlternatives: 4 };

function scoreFood(queryTokens: string[], querySet: Set<string>, food: FdcFood): number {
  const descTokens = tokenize(food.description);
  if (descTokens.length === 0 || queryTokens.length === 0) return 0;
  const descSet = new Set(descTokens);

  let matched = 0;
  for (const q of queryTokens) if (descSet.has(q)) matched++;
  if (matched === 0) return 0;

  const head = categoryHead(food.description);
  const headSet = new Set(head);

  const coverage = matched / queryTokens.length; // all query words present?
  // Is the food's category itself made only of query words? ("Oil, olive" → yes;
  // "Mayonnaise, ... olive oil" → no) — the discriminator against composites.
  const headInQuery = head.length > 0 ? head.filter((t) => querySet.has(t)).length / head.length : 0;
  // Does a query word appear in the category head at all?
  const queryHeadInDescHead = queryTokens.some((t) => headSet.has(t)) ? 1 : 0;
  const density = matched / descTokens.length; // query not buried in a long desc
  const completeBonus = food.complete ? 1 : 0;

  // Composite penalty: a description that lists several foods ("Oil, corn,
  // peanut, and olive") is less likely to be the pure ingredient than one with
  // fewer qualifiers ("Oil, olive, salad or cooking"). This breaks resolver
  // ties toward the purest food — and stops phantom allergens (peanut oil in an
  // "olive oil" blend flagging peanuts on every recipe).
  const commaCount = (food.description.match(/,/g) ?? []).length;
  const foodList = /,\s+and\s/i.test(food.description) ? 1 : 0;
  const compositePenalty = 0.02 * Math.min(commaCount, 3) + 0.03 * foodList;

  const score =
    0.35 * coverage +
    0.3 * headInQuery +
    0.2 * queryHeadInDescHead +
    0.1 * Math.min(1, density * 2.5) +
    0.05 * completeBonus -
    compositePenalty;

  return Math.max(0, Math.min(1, score));
}

export function resolveIngredient(
  query: string,
  pinnedFdcId: number | undefined,
  store: FdcStore,
  byId: Map<number, FdcFood>,
  options: ResolveOptions = {},
): Resolution {
  const opts = { ...DEFAULTS, ...options };

  if (pinnedFdcId !== undefined) {
    const food = byId.get(pinnedFdcId);
    if (food) {
      return {
        query,
        method: 'pinned',
        fdcId: food.fdcId,
        matchedDescription: food.description,
        confidence: 1,
        needsReview: false,
        alternatives: [],
      };
    }
    // Pin references an id not in the store — fall through to auto, but flag review.
  }

  const queryTokens = tokenize(query);
  const querySet = new Set(queryTokens);

  const scored: ResolverCandidate[] = [];
  for (const food of store.foods) {
    const score = scoreFood(queryTokens, querySet, food);
    if (score > 0) scored.push({ fdcId: food.fdcId, description: food.description, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  if (!top) {
    return {
      query,
      method: 'unresolved',
      fdcId: null,
      matchedDescription: null,
      confidence: 0,
      needsReview: true,
      alternatives: [],
    };
  }

  const pinWasInvalid = pinnedFdcId !== undefined;
  return {
    query,
    method: 'auto',
    fdcId: top.fdcId,
    matchedDescription: top.description,
    confidence: top.score,
    needsReview: top.score < opts.autoAcceptThreshold || pinWasInvalid,
    alternatives: scored.slice(0, opts.keepAlternatives),
  };
}
