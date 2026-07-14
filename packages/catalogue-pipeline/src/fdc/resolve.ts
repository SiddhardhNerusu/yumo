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

/** §6.3 cooking-state words. A recipe that says "chickpeas, COOKED" must resolve
 * to the cooked FDC entry (164 kcal/100g), never the dry one (378) — a ~2.5x
 * error. FDC ships separately-measured raw AND cooked entries, so the fix is
 * state-aware selection, not a yield-factor computation. */
// "dried"/"dehydrated" are NOT a raw-state synonym here: they're a processed form
// (freeze-dried parsley ≠ fresh raw parsley), handled by NONGENERIC_QUALIFIERS. Only
// fresh raw / dry-uncooked count as the raw state for the cooked-vs-raw bonus.
const STATE_WORDS = ['cooked', 'roasted', 'boiled', 'grilled', 'baked', 'fried', 'steamed', 'braised', 'poached', 'simmered', 'sauteed', 'sautéed', 'raw', 'dry', 'uncooked'];
const STATE_TOKENS = new Set(STATE_WORDS.flatMap((w) => tokenize(w)));
const COOKED_RE = /\b(cooked|roasted|boiled|grilled|baked|fried|steamed|braised|poached|simmered|sauteed|saut[eé]ed)\b/;
const RAW_RE = /\b(raw|dry|uncooked)\b/;

/** British→US ingredient normalisation so a UK recipe term reaches the FDC entry
 * (courgette→zucchini). Applied to the QUERY only (FDC descriptions are US). This
 * is linguistic normalisation like STOPWORDS/stemming, not a food catalogue. */
const SYNONYMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcourgettes?\b/g, 'zucchini'],
  [/\baubergines?\b/g, 'eggplant'],
  [/\bprawns?\b/g, 'shrimp'],
  [/\brocket\b/g, 'arugula'],
  [/\bpak choi\b/g, 'bok choy'],
  [/\bmangetout\b/g, 'snow peas'],
  [/\bsweetcorn\b/g, 'sweet corn'],
  [/\bspring onions?\b/g, 'scallions'],
  [/\bcoriander leaves?\b/g, 'cilantro'],
  [/\bgammon\b/g, 'ham'],
  [/\bbreadcrumbs\b/g, 'bread crumbs'],
  [/\bhake\b/g, 'haddock'],
];
function applySynonyms(query: string): string {
  let q = query.toLowerCase();
  for (const [re, to] of SYNONYMS) q = q.replace(re, to);
  return q;
}
type FoodState = 'cooked' | 'raw' | null;
/** The cooking state a description/query implies, or null if it says nothing. */
function foodState(text: string): FoodState {
  const t = text.toLowerCase();
  if (COOKED_RE.test(t)) return 'cooked';
  if (RAW_RE.test(t)) return 'raw';
  return null;
}
/** Bonus only — never a penalty. Penalising the sole correct-food entry (when no
 * same-state entry exists) let a wrong food that merely shares the cooking word
 * win (millet for farro). Instead we lift a same-STATE entry only when it is
 * genuinely the queried food; foods with no matching-state entry stay put and
 * are caught by the state-mismatch lint. */
const STATE_MATCH_BONUS = 0.15;

/** §6.3 lint signal: a query that states a cooking state resolved to an entry of
 * the OPPOSITE state ("chickpeas, cooked" → a dry entry) — a ~2.5x macro error. */
export function isStateMismatch(query: string, description: string): boolean {
  const qs = foodState(query);
  const ds = foodState(description);
  return qs !== null && ds !== null && qs !== ds;
}

/** Preparation/quality qualifiers that mark a row as a SPECIAL form, not the
 * generic ingredient a recipe means by "lentils, cooked" or "beef, cooked"
 * (sprouted lentils 101 vs plain 116; cured/pastrami/fat cuts). Mild penalty in
 * the spirit of the composite penalty — the plain entry wins ties, but a query
 * that explicitly asks for the form still matches (coverage dominates). Never a
 * food list: these are descriptor words, like STOPWORDS. */
const NONGENERIC_QUALIFIERS = /\b(sprouted|germinated|cured|pastrami|luncheon|separable fat|breakfast strips|mechanically separated|variety meats|imitation|infant|baby food|dehydrated|freeze[- ]dried|dried|frozen mixture|oil|flour|bar|fish oil|liver oil|cod liver|snacks|sheep|goat)\b/i;
const QUALIFIER_PENALTY = 0.08;

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

function scoreFood(queryTokens: string[], querySet: Set<string>, food: FdcFood, queryState: FoodState, queryHasQualifier: boolean): number {
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

  // §6.3 cooking-state alignment: when the query states a state (e.g. "cooked"),
  // lift a same-state entry — but ONLY when it is genuinely the queried food
  // (covers every non-state query token), so a wrong food that merely shares the
  // cooking word is never rewarded. Bonus-only; see STATE_MATCH_BONUS note.
  let stateAdj = 0;
  if (queryState && foodState(food.description) === queryState) {
    const nonState = queryTokens.filter((t) => !STATE_TOKENS.has(t));
    if (nonState.length > 0 && nonState.every((t) => descSet.has(t))) stateAdj = STATE_MATCH_BONUS;
  }

  // §6.2 prefer the generic form unless the query asked for the special one.
  const qualifierPenalty = !queryHasQualifier && NONGENERIC_QUALIFIERS.test(food.description) ? QUALIFIER_PENALTY : 0;

  const score =
    0.35 * coverage +
    0.3 * headInQuery +
    0.2 * queryHeadInDescHead +
    0.1 * Math.min(1, density * 2.5) +
    0.05 * completeBonus -
    compositePenalty -
    qualifierPenalty +
    stateAdj;

  return Math.max(0, Math.min(1, score));
}

/** Top-N foods for a free-text query, using the same category-head scoring as
 * resolution — so food search ranks the pure food above composites. */
export function rankFoods(query: string, store: FdcStore, limit: number): ResolverCandidate[] {
  const normalized = applySynonyms(query);
  const queryTokens = tokenize(normalized);
  const querySet = new Set(queryTokens);
  const queryState = foodState(normalized);
  const queryHasQualifier = NONGENERIC_QUALIFIERS.test(normalized);
  const scored: ResolverCandidate[] = [];
  for (const food of store.foods) {
    const score = scoreFood(queryTokens, querySet, food, queryState, queryHasQualifier);
    if (score > 0) scored.push({ fdcId: food.fdcId, description: food.description, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
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

  const normalized = applySynonyms(query);
  const queryTokens = tokenize(normalized);
  const querySet = new Set(queryTokens);
  const queryState = foodState(normalized);
  const queryHasQualifier = NONGENERIC_QUALIFIERS.test(normalized);

  const scored: ResolverCandidate[] = [];
  for (const food of store.foods) {
    const score = scoreFood(queryTokens, querySet, food, queryState, queryHasQualifier);
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
