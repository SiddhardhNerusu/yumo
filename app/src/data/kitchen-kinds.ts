/**
 * Glyph "kind" for a kitchen item (Addendum §2.2 / §4). Derives the silhouette a
 * shelf tile draws — carton, jar, tin, eggs, produce, fruit, tub, loaf — from the
 * food-graph token by category. Never a per-item list: map by category, default `pack`.
 */
export type Kind = 'carton' | 'jar' | 'tin' | 'eggs' | 'produce' | 'fruit' | 'tub' | 'loaf' | 'pack';

/** Round silhouettes (drawn square, radius 999) — fruit + loose produce. */
export const ROUND_KINDS: ReadonlySet<Kind> = new Set<Kind>(['fruit', 'produce']);

// Order matters — earlier rules win (e.g. "peanut butter" → jar before tub catches "butter").
const KIND_RULES: Array<[RegExp, Kind]> = [
  [/\beggs?\b/, 'eggs'],
  [/peanut butter|nut butter|almond butter|cashew butter|\bjam\b|marmalade|honey|nutella/, 'jar'],
  [/\btin|tinned|canned|\bcan of|chickpea|baked bean/, 'tin'],
  [/milk|\boats?\b|porridge|\bpasta\b|cereal|granola|\bstock\b|broth|\bflour\b|\bjuice\b/, 'carton'],
  [/bread|sourdough|\bloaf\b|baguette|ciabatta|\bbun\b|\broll\b/, 'loaf'],
  [/yogurt|yoghurt|butter|leftover|ice cream|\bcream\b|hummus|margarine|spread|\bdip\b/, 'tub'],
  [/spinach|broccoli|kale|lettuce|greens|courgette|zucchini|\bherb|cabbage|cauliflower|rocket|chard/, 'produce'],
  [/berry|berries|orange|apple|banana|grape|\bpear\b|peach|plum|mango|melon|kiwi|lemon|lime|avocado/, 'fruit'],
];

/** token → glyph kind. Category-driven; anything unmatched draws as a `pack`. */
export function kindOf(token: string): Kind {
  const t = token.toLowerCase();
  for (const [re, k] of KIND_RULES) if (re.test(t)) return k;
  return 'pack';
}
