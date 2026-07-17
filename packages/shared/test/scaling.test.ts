import { describe, it, expect } from 'vitest';
import { formatQty, roundQty, scaleIngredient, scaleStepText, portionLabel } from '../src/scaling';

// The ORIGINAL hand-written regex (verbatim from repo.ts before M8). The
// data-built one must accept/reject exactly the same tokens — this is the
// equivalence guarantee for moving the vocab into scaling-vocab.json.
const ORIGINAL_FIXED = /\b(salt|pepper|oil|butter|ghee|margarine|spice|spices|turmeric|cumin|paprika|masala|chilli powder|chili powder|cinnamon|oregano|basil|thyme|parsley|coriander|cilantro|mint|dill|bay|garlic|ginger|baking powder|yeast|vanilla|nutmeg|cardamom|clove|seasoning|stock cube)\b/i;

// A named ingredient is "fixed" iff scaleIngredient leaves it unchanged at 2×.
const isFixed = (name: string) => scaleIngredient({ name, qty_g: 100 }, 2).qty_g === 100;

describe('scaling: FIXED_WHEN_SCALED data == original regex', () => {
  const battery = [
    // the 4 multi-word alternatives (naive word-split would break these)
    'chilli powder', 'chili powder', 'baking powder', 'stock cube',
    // plurals: FALSE (no s? in the regex; only the explicit spice|spices pair)
    'stock cubes', 'cloves', 'peppers', 'baking powders',
    // \b guards: FALSE (substring, not a whole word)
    'boiled', 'salted', 'peppermint', 'bayleaf', 'gingerbread', 'basilica',
    // real in-corpus FALSE POSITIVES that MUST survive (they legitimately match)
    'butter beans, cooked', 'red bell pepper', 'peanut butter', 'almond butter',
    'bell pepper', 'olive oil', 'garlic clove', 'sea salt', 'fresh basil',
    // plain single-word members
    'salt', 'pepper', 'turmeric', 'seasoning', 'spice', 'spices',
    // clear non-members
    'chicken', 'rice', 'tomato', 'onion', 'flour', 'sugar',
  ];

  for (const token of battery) {
    it(`"${token}" matches original ⇔ data-built`, () => {
      expect(isFixed(token)).toBe(ORIGINAL_FIXED.test(token));
    });
  }

  it('no accidental global flag (repeated .test on the same string is stable)', () => {
    // the regex is .test()ed inside a .replace() callback in scaleStepText — a
    // stray `g` flag would carry lastIndex and mis-scale on the 2nd call.
    expect(isFixed('salt')).toBe(true);
    expect(isFixed('salt')).toBe(true);
    expect(isFixed('salt')).toBe(true);
  });
});

describe('scaling: LIQUID / SPOONABLE / countable data == original regexes', () => {
  // verbatim originals from repo.ts @ 4a29136 (before M8 moved them to data)
  const ORIGINAL_LIQUID = /\b(milk|stock|broth|water|juice|cream(?!\s+cheese)|passata)\b/i;
  const ORIGINAL_SPOONABLE = /\b(oil|butter|honey|syrup|sauce|vinegar|mayonnaise|ketchup|mustard|paste|tahini)\b/i;
  // probes that isolate each data-built regex through formatQty's observable behaviour:
  // at 100g the spoonable branch (g<=45) is skipped, so only LIQUID decides ml-vs-g.
  const dataLiquid = (name: string) => formatQty(name, 100) === '100ml';
  const dataSpoonable = (name: string) => formatQty(name, 5) === '1 tsp';

  const liquidMembers = ['milk', 'stock', 'broth', 'water', 'juice', 'cream', 'passata', 'double cream'];
  const spoonableMembers = ['oil', 'butter', 'honey', 'syrup', 'sauce', 'vinegar', 'mayonnaise', 'ketchup', 'mustard', 'paste', 'tahini', 'olive oil'];
  const nonMembers = ['chicken', 'rice', 'tomato', 'cream cheese', 'flour', 'sugar', 'creamer'];

  for (const t of [...liquidMembers, ...spoonableMembers, ...nonMembers]) {
    it(`LIQUID "${t}": data == original`, () => expect(dataLiquid(t)).toBe(ORIGINAL_LIQUID.test(t)));
  }
  for (const t of [...spoonableMembers, ...liquidMembers, ...nonMembers]) {
    it(`SPOONABLE "${t}": data == original`, () => expect(dataSpoonable(t)).toBe(ORIGINAL_SPOONABLE.test(t)));
  }

  it('countable list scales whole-unit counts (and only those)', () => {
    // former inline (eggs?|tortillas?|slices?), now built from vocab.countable
    expect(scaleStepText('add 2 eggs and 3 bananas', 2)).toBe('add 4 eggs and 3 bananas'); // bananas NOT countable
    expect(scaleStepText('use 1 tortilla', 3)).toBe('use 3 tortillas');
    expect(scaleStepText('cut 2 slices', 0.5)).toBe('cut 1 slice');
    // range branch fires (1-2 → 2-4), then the single-count pass re-catches the
    // trailing "4 slices" and scales it again → "2-8". A pre-existing quirk of
    // repo.ts's two-pass replace, preserved verbatim (byte-identity, not "fixed").
    expect(scaleStepText('serve 1-2 slices', 2)).toBe('serve 2-8 slices');
  });
});

describe('scaling: byte-identity behaviours', () => {
  it('returns the SAME object reference on the fixed/1× path', () => {
    const o = { name: 'salt', qty_g: 5 };
    expect(scaleIngredient(o, 2)).toBe(o); // fixed
    const o2 = { name: 'chicken', qty_g: 100 };
    expect(scaleIngredient(o2, 1)).toBe(o2); // 1×
  });

  it('scales a non-fixed ingredient with clean rounding', () => {
    expect(scaleIngredient({ name: 'chicken', qty_g: 100 }, 2)).toEqual({ name: 'chicken', qty_g: 200 });
    expect(scaleIngredient({ name: 'rice', qty_g: 92 }, 2).qty_g).toBe(180); // 184 → nearest 10
  });

  it('roundQty tiers: <20 nearest 1, 20-99 nearest 5, ≥100 nearest 10', () => {
    expect(roundQty(3)).toBe(3);
    expect(roundQty(22)).toBe(20);
    expect(roundQty(185)).toBe(190);
  });
});

describe('scaling: formatQty unit choice', () => {
  it('liquid → ml, but "cream cheese" → g (negative lookahead survives data build)', () => {
    expect(formatQty('milk', 130)).toBe('130ml');
    expect(formatQty('double cream', 50)).toBe('50ml');
    expect(formatQty('cream cheese', 50)).toBe('50g'); // lookahead: not a liquid
    expect(formatQty('chicken', 150)).toBe('150g');
  });
  it('spoonable → tsp/tbsp at small amounts', () => {
    expect(formatQty('olive oil', 5)).toBe('1 tsp');
    expect(formatQty('olive oil', 15)).toBe('1 tbsp');
  });
});

describe('scaling: scaleStepText + portionLabel', () => {
  it('scales grams in prose but leaves fixed seasonings and units alone', () => {
    expect(scaleStepText('Add 150g chicken and 2 tbsp oil, cook for 20 min at 200C', 2))
      .toContain('300g chicken');
    // the "20 min" and "200C" are not g/ml amounts → untouched
    expect(scaleStepText('cook for 20 min at 200C', 2)).toBe('cook for 20 min at 200C');
  });
  it('pluralises whole-unit counts', () => {
    expect(scaleStepText('crack 1 egg', 2)).toBe('crack 2 eggs');
    expect(scaleStepText('use 2 tortillas', 0.5)).toBe('use 1 tortilla');
  });
  it('portionLabel: blank at 1×, fractions otherwise', () => {
    expect(portionLabel(1)).toBeUndefined();
    expect(portionLabel(0.5)).toBe('½ portion');
    expect(portionLabel(1.5)).toBe('1½ portions');
    expect(portionLabel(2)).toBe('2 portions');
    expect(portionLabel(2.3)).toBe('2.3× portions');
  });
});
