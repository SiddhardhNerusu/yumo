/**
 * Kitchen voice/text "add" parser (§5.5 — "add chicken, rice and a bag of spinach").
 *
 * Deliberately NOT the Goyo VoiceSetParser shape: that was a 1,482-line first-match
 * regex cascade with ordered string-substitution numbers and hardcoded entity
 * rewrites (its own audit found the most canonical utterances corrupted). The
 * lessons applied here:
 *   1. Parse each spoken number ONCE, left-to-right (no substitution-order dead code).
 *   2. Resolve food names by catalog-anchored fuzzy similarity with a scored margin
 *      gate — never a hardcoded "squad"→"squat" rewrite table.
 *   3. Only structure words (verbs, connectives, quantity units) are literal — and
 *      they carry no entity meaning, so they don't violate the no-hardcoded-food rule.
 *   4. Never a dead-end: an unmatched noun is still added as spoken (the fridge is
 *      fuzzy). Resolution only *canonicalises* to a known token when confident.
 * The human always confirms before anything is written (§1.4 / §5).
 */

export type AddLevel = 'plenty' | 'some' | 'low';

export interface ParsedAddItem {
  /** the food noun as spoken (filler + quantity stripped). */
  phrase: string;
  /** spoken quantity if one was given (a dozen → 12), else null. */
  qty: number | null;
  /** coarse stock level inferred from the quantity words (§1.1 fuzzy, never a count). */
  level: AddLevel;
}

export interface FoodVocabEntry { token: string; label: string }
export interface FoodResolution { token: string; label: string; score: number; canonical: boolean }

// ── spoken cardinals (small, closed — structure, not food) ────────────────────
const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, a: 1, an: 1,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Left-to-right cardinal from a run of number words. Returns null if none. */
function parseNumberWords(words: string[]): number | null {
  // "a dozen" / "half a dozen" / "a couple" get resolved before we get here,
  // but bare "dozen"/"couple"/"few" also map to a count.
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (/^\d+$/.test(w)) { current += parseInt(w, 10); seen = true; continue; }
    if (w in UNITS) { current += UNITS[w]!; seen = true; continue; }
    if (w in TENS) { current += TENS[w]!; seen = true; continue; }
    if (w === 'hundred') { current = (current || 1) * 100; seen = true; continue; }
    if (w === 'dozen') { current = (current || 1) * 12; seen = true; continue; }
    if (w === 'couple') { current = 2; seen = true; continue; }
    if (w === 'few') { current = 3; seen = true; continue; }
    if (w === 'and') continue;
  }
  total += current;
  return seen ? total : null;
}

// Quantity phrases → level. Only structure words, no food entities.
const PLENTY_WORDS = /\b(lots?|loads?|plenty|tons?|stacks?|a lot|heaps?|full)\b/;
const LOW_WORDS = /\b(low on|almost out|nearly out|running low|down to|last|a bit of|little)\b/;
// full level phrases (incl. trailing prepositions) to STRIP from the noun.
const LEVEL_STRIP = /\b(lots? of|lots?|loads? of|loads?|plenty of|plenty|tons? of|tons?|stacks? of|heaps? of|a lot of|a lot|full of|low on|running low|almost out of|almost out|nearly out of|nearly out|down to|a bit of|a little|little|last)\b/g;
// container / vague quantity units to strip (they imply "some")
const UNIT_WORDS = /\b(a |an |the )?(bag|bags|packet|packets|pack|packs|carton|cartons|tub|tubs|box|boxes|bunch|bunches|bottle|bottles|jar|jars|tin|tins|can|cans|loaf|loaves|punnet|punnets|clove|cloves|head|heads|bit|couple|few|dozen|handful|some|of)\b/g;
const LEAD_VERB = /^(add|please add|put|put away|stock|grab|get|buy|bought|pick up|picked up|throw in|chuck in|log|i just (bought|got|picked up)|i (bought|got|have|need|picked up)|i've (got|bought)|we (have|got|need|bought)|there's|theres)\b[\s:]*/;
const FILLER = /\b(please|also|too|as well|some more|more)\b/g;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

/** Split an utterance into add-items, each with a coarse level + optional qty. */
export function parseAddUtterance(text: string): ParsedAddItem[] {
  let s = ` ${text.toLowerCase().replace(/[.!?]+$/g, '')} `;
  s = ` ${clean(s).replace(LEAD_VERB, '')} `;
  // split on connectives (comma / and / plus / & / semicolon)
  const fragments = s.split(/\s*(?:,|;|\band\b|\bplus\b|&)\s*/).map(clean).filter(Boolean);

  const items: ParsedAddItem[] = [];
  for (const frag of fragments) {
    let f = ` ${frag} `;
    let level: AddLevel = 'some';
    if (PLENTY_WORDS.test(f)) level = 'plenty';
    else if (LOW_WORDS.test(f)) level = 'low';

    // pull a leading/embedded number (words or digits) for qty
    const numWords = f.trim().split(' ').filter((w) => /^\d+$/.test(w) || w in UNITS || w in TENS || w === 'hundred' || w === 'dozen' || w === 'couple' || w === 'few');
    // "half a dozen" special-case
    const half = /\bhalf a dozen\b/.test(f);
    let qty: number | null = half ? 6 : parseNumberWords(numWords);
    // "a"/"an" alone is an article, not a real count of 1
    if (!half && numWords.length === 1 && (numWords[0] === 'a' || numWords[0] === 'an')) qty = null;
    if (qty != null && qty >= 4) level = 'plenty';

    // strip quantity words, unit/container words, filler, articles → the noun
    f = f
      .replace(/\bhalf a dozen\b/g, ' ')
      .replace(LEVEL_STRIP, ' ')
      .replace(/\b\d+\b/g, ' ')
      .replace(new RegExp(`\\b(${Object.keys(UNITS).concat(Object.keys(TENS), ['hundred']).join('|')})\\b`, 'g'), ' ')
      .replace(UNIT_WORDS, ' ')
      .replace(FILLER, ' ')
      .replace(/\b(a|an|the|of|my|our|more|just)\b/g, ' ');
    // drop any dangling leading/trailing prepositions left by the strips
    const phrase = clean(f).replace(/^(on|of|to|with|the|a|an)\s+/, '').replace(/\s+(on|of)$/, '');
    if (phrase) items.push({ phrase, qty, level });
  }
  return items;
}

// ── catalog-anchored fuzzy resolution (Dice bigram + word overlap) ────────────
function bigrams(s: string): string[] {
  const t = s.replace(/[^a-z0-9]/g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return a === b ? 1 : 0;
  const bag = new Map<string, number>();
  for (const g of A) bag.set(g, (bag.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of B) { const n = bag.get(g); if (n) { inter++; bag.set(g, n - 1); } }
  return (2 * inter) / (A.length + B.length);
}
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}
function levRatio(a: string, b: string): number {
  const A = a.replace(/[^a-z0-9]/g, '');
  const B = b.replace(/[^a-z0-9]/g, '');
  const L = Math.max(A.length, B.length);
  return L ? 1 - levenshtein(A, B) / L : 0;
}
function wordOverlap(a: string, b: string): number {
  const aw = new Set(a.split(' ').filter(Boolean));
  const bw = new Set(b.split(' ').filter(Boolean));
  if (!aw.size || !bw.size) return 0;
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  // subset (spoken "chicken" ⊂ "chicken breast") scores high, not just Jaccard
  return inter / Math.min(aw.size, bw.size);
}
function similarity(phrase: string, entry: FoodVocabEntry): number {
  const p = phrase.toLowerCase().trim();
  const cands = [entry.token.toLowerCase(), entry.label.toLowerCase()];
  let best = 0;
  for (const c of cands) {
    if (p === c) return 1;
    // Dice+overlap catches word-level matches; lev-ratio catches letter-drop ASR typos.
    best = Math.max(best, 0.6 * dice(p, c) + 0.4 * wordOverlap(p, c), 0.9 * levRatio(p, c));
  }
  return best;
}

/** Canonicalise a spoken noun to the nearest known food token — but never block:
 * below the confidence floor we keep the phrase as spoken (the fridge is fuzzy). */
const COMMIT_FLOOR = 0.62;
export function resolveFood(phrase: string, vocab: FoodVocabEntry[]): FoodResolution {
  let best: FoodVocabEntry | null = null;
  let bestScore = 0;
  for (const e of vocab) {
    const s = similarity(phrase, e);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  if (best && bestScore >= COMMIT_FLOOR) return { token: best.token, label: best.label, score: bestScore, canonical: true };
  return { token: phrase.toLowerCase(), label: titleCase(phrase), score: bestScore, canonical: false };
}
