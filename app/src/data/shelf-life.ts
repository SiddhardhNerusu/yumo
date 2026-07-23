import type { Zone } from './kitchen-model';

/**
 * §4 shelf-life dataset (versioned data — human-reviewable, never hardcoded UI).
 * category × zone → typical days fresh. Conservative defaults; the clock starts
 * at purchase/added date. Freezer roughly ×30, cupboard is dry-goods long life.
 */
export interface ShelfLife {
  fridge: number;
  freezer: number;
  cupboard: number;
}

const DEFAULT: ShelfLife = { fridge: 5, freezer: 90, cupboard: 14 };

const TABLE: Record<string, ShelfLife> = {
  poultry: { fridge: 2, freezer: 270, cupboard: 1 },
  red_meat: { fridge: 3, freezer: 180, cupboard: 1 },
  fish: { fridge: 2, freezer: 120, cupboard: 1 },
  dairy_milk: { fridge: 7, freezer: 90, cupboard: 1 },
  dairy_soft: { fridge: 10, freezer: 60, cupboard: 1 }, // yogurt, soft cheese
  dairy_hard: { fridge: 28, freezer: 180, cupboard: 2 }, // hard cheese
  eggs: { fridge: 28, freezer: 1, cupboard: 21 },
  leafy: { fridge: 5, freezer: 240, cupboard: 1 }, // spinach, salad, herbs
  veg: { fridge: 10, freezer: 240, cupboard: 3 }, // broccoli, carrot, pepper
  root: { fridge: 30, freezer: 180, cupboard: 21 }, // potato, onion
  fruit: { fridge: 10, freezer: 240, cupboard: 6 }, // apple, banana
  bread: { fridge: 7, freezer: 90, cupboard: 4 },
  tofu: { fridge: 7, freezer: 120, cupboard: 1 },
  cooked: { fridge: 3, freezer: 60, cupboard: 1 }, // leftovers / cooked rice
  tinned: { fridge: 1, freezer: 1, cupboard: 720 },
  dry: { fridge: 365, freezer: 365, cupboard: 540 }, // rice, pasta, oats, flour
  legume_dry: { fridge: 365, freezer: 365, cupboard: 720 },
  nut: { fridge: 180, freezer: 365, cupboard: 120 },
  condiment: { fridge: 120, freezer: 1, cupboard: 240 },
  frozen: { fridge: 2, freezer: 300, cupboard: 1 },
};

/** Keyword → category. First match wins; order matters (specific before generic). */
const RULES: Array<[RegExp, keyof typeof TABLE]> = [
  // shelf-stable stocks/sauces/pastes must win over a protein/produce keyword in the same name
  [/\b(stock|sauce|paste|gravy|bouillon)\b/, 'condiment'],
  // plant "milks"/creams are shelf-stable, not dairy
  [/(coconut|almond|oat|soya?|rice|cashew) milk|coconut cream/, 'dry'],
  // "frozen X" is a freezer item first (before the food-type rule below claims it).
  // Word-boundaried so it never matches "rice"/"juice" via a bare "ice".
  [/\bfrozen\b|\bice cream\b|\bice lolly\b/, 'frozen'],
  [/chicken|turkey|poultry|thigh|breast(?!.*milk)/, 'poultry'],
  [/beef|pork|lamb|mince|steak|bacon|sausage|ham/, 'red_meat'],
  [/salmon|tuna|cod|fish|prawn|shrimp|seafood/, 'fish'],
  [/milk|cream|buttermilk/, 'dairy_milk'],
  [/yogurt|yoghurt|quark|cottage|ricotta|mozzarella|feta/, 'dairy_soft'],
  [/cheddar|cheese|parmesan|halloumi|gouda/, 'dairy_hard'],
  [/\beggs?\b/, 'eggs'],
  [/spinach|lettuce|salad|kale|rocket|herb|coriander|basil|parsley|greens/, 'leafy'],
  // fresh beans/peas are veg; dried/canned pulses fall through to legume_dry
  [/green bean|runner bean|edamame|mangetout|sugar snap/, 'veg'],
  [/chickpea|lentil|dried bean|baked bean|black bean|kidney bean|butter bean|cannellini|pinto|borlotti|\bbeans?\b|hummus/, 'legume_dry'],
  [/eggplant|aubergine|broccoli|carrot|pepper|courgette|zucchini|cauliflower|\bpeas?\b|corn|tomato|cucumber|mushroom|\bveg/, 'veg'],
  [/potato|onion|garlic|ginger|beetroot|swede|turnip/, 'root'],
  [/banana|apple|orange|berry|berries|grape|mango|pear|fruit|avocado|lemon|lime/, 'fruit'],
  [/bread|toast|bagel|roll|tortilla|wrap|pitta/, 'bread'],
  [/tofu|tempeh|seitan/, 'tofu'],
  [/leftover|cooked rice|cooked/, 'cooked'],
  [/tin|tinned|canned|can of/, 'tinned'],
  [/rice|pasta|oats|flour|noodle|couscous|quinoa|cereal|granola|sugar/, 'dry'],
  [/almond|peanut|cashew|walnut|nut butter|nuts/, 'nut'],
  [/oil|ketchup|mayo|mustard|vinegar|honey|jam|salsa/, 'condiment'],
];

export function categoryFor(token: string): keyof typeof TABLE | null {
  const t = token.toLowerCase();
  for (const [re, cat] of RULES) if (re.test(t)) return cat;
  return null;
}

/** Days fresh for a token in a zone (falls back to a sensible default).
 * The counter is room temperature — treat it like the cupboard shelf. */
export function shelfLifeDays(token: string, zone: Zone): number {
  const col: keyof ShelfLife = zone === 'counter' ? 'cupboard' : zone;
  const cat = categoryFor(token);
  return (cat ? TABLE[cat] : DEFAULT)[col];
}

/** Best default zone to drop a new item into. Hardy produce (root veg, fruit) and
 * shelf-stable goods live in the cupboard; only chilled/perishable defaults to the
 * fridge. Any of these is user-overridable per item. */
const CUPBOARD_CATS = new Set<keyof typeof TABLE>(['tinned', 'dry', 'legume_dry', 'nut', 'condiment', 'root', 'fruit']);
export function defaultZone(token: string): Zone {
  const cat = categoryFor(token);
  if (!cat) return 'cupboard';
  if (CUPBOARD_CATS.has(cat)) return 'cupboard';
  if (cat === 'frozen') return 'freezer';
  return 'fridge';
}
