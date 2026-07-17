import { describe, it, expect } from 'vitest';
import { parseReceipt } from '../src/receipt';
import type { FoodVocabEntry } from '../src/voiceAdd';

// A realistic kitchen vocab. Plain produce tokens (tomato/onion/potato) are
// present — i.e. D17 part (a), "add the plain staple tokens", is done. The
// separate VARIANT_ONLY_VOCAB below simulates the gap D17 fixes.
const VOCAB: FoodVocabEntry[] = (
  [
    ['banana', 'Banana'], ['apple', 'Apple'], ['egg', 'Eggs'], ['milk', 'Milk'],
    ['bread', 'Bread'], ['tomato', 'Tomato'], ['onion', 'Onion'], ['potato', 'Potato'],
    ['carrot', 'Carrot'], ['chicken breast', 'Chicken breast'], ['cheddar cheese', 'Cheddar cheese'],
    ['spinach', 'Spinach'], ['rice', 'Rice'], ['pasta', 'Pasta'], ['yogurt', 'Yogurt'],
    ['salmon', 'Salmon'], ['cucumber', 'Cucumber'], ['butter', 'Butter'], ['orange juice', 'Orange juice'],
  ] as const
).map(([token, label]) => ({ token, label }));

const lines = (text: string) => text.trim().split('\n').map((t) => ({ text: t.trim() }));

// Three UK-supermarket-shaped fixtures: item + price, plurals, qty prefixes,
// weights, and TOTAL/CARD/CHANGE noise.
const FIXTURES: { receipt: string; foods: { line: string; token: string }[] }[] = [
  {
    receipt: `
      BANANAS                0.72
      MILK 2 PINTS           1.15
      FREE RANGE EGGS        2.20
      CHICKEN BREAST 500G    4.50
      TOMATOES               0.89
      SPINACH 200G           1.00
      TOTAL                 10.46
      VISA DEBIT            10.46
      CHANGE                 0.00`,
    foods: [
      { line: 'BANANAS', token: 'banana' }, { line: 'MILK', token: 'milk' },
      { line: 'FREE RANGE EGGS', token: 'egg' }, { line: 'CHICKEN BREAST', token: 'chicken breast' },
      { line: 'TOMATOES', token: 'tomato' }, { line: 'SPINACH', token: 'spinach' },
    ],
  },
  {
    receipt: `
      2 x APPLES             1.30
      WHOLEMEAL BREAD        1.10
      CHEDDAR CHEESE 400G    3.25
      SALMON FILLET          5.75
      ORANGE JUICE 1L        1.40
      SUBTOTAL              12.80
      MASTERCARD            12.80`,
    foods: [
      { line: 'APPLES', token: 'apple' }, { line: 'WHOLEMEAL BREAD', token: 'bread' },
      { line: 'CHEDDAR CHEESE', token: 'cheddar cheese' }, { line: 'SALMON FILLET', token: 'salmon' },
      { line: 'ORANGE JUICE', token: 'orange juice' },
    ],
  },
  {
    receipt: `
      CARROTS 1KG            0.55
      POTATOES               1.00
      RED ONIONS             0.68
      GREEK YOGURT 500G      1.20
      CUCUMBER               0.55
      TOTAL                  3.98
      CASH                   5.00
      CHANGE                 1.02
      POINTS EARNED           40`,
    foods: [
      { line: 'CARROTS', token: 'carrot' }, { line: 'POTATOES', token: 'potato' },
      { line: 'RED ONIONS', token: 'onion' }, { line: 'GREEK YOGURT', token: 'yogurt' },
      { line: 'CUCUMBER', token: 'cucumber' },
    ],
  },
];

describe('receipt parser', () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    const { receipt, foods } = FIXTURES[i]!;
    it(`fixture ${i + 1}: ≥80% of food lines match the CORRECT token`, () => {
      const { matches } = parseReceipt(lines(receipt), VOCAB);
      let correct = 0;
      for (const f of foods) {
        // a wrong-variant match (variant:true) counts as a MISS, per the D17 bar
        const hit = matches.find((m) => m.line.toUpperCase().includes(f.line) && m.token === f.token && !m.variant);
        if (hit) correct++;
      }
      const rate = correct / foods.length;
      expect(rate, `${correct}/${foods.length} correct`).toBeGreaterThanOrEqual(0.8);
    });
  }

  it('excludes receipt-structure noise (TOTAL / CARD / CHANGE / POINTS)', () => {
    const { matches } = parseReceipt(lines(FIXTURES[2]!.receipt), VOCAB);
    const badWords = ['total', 'cash', 'change', 'points'];
    for (const m of matches) {
      for (const bad of badWords) expect(m.line.toLowerCase()).not.toContain(bad);
    }
  });

  it('parses the trailing price', () => {
    const { matches } = parseReceipt([{ text: 'BANANAS                0.72' }], VOCAB);
    expect(matches[0]?.price).toBeCloseTo(0.72, 2);
  });

  it('strips a "2 x" quantity prefix and a weight', () => {
    const { matches } = parseReceipt([{ text: '2 x APPLES 1.30' }, { text: 'CARROTS 1KG 0.55' }], VOCAB);
    expect(matches.map((m) => m.token)).toEqual(['apple', 'carrot']);
  });

  it('D17: a plain plural that only resolves to a QUALIFIED variant is flagged, not silently stocked', () => {
    const VARIANT_ONLY: FoodVocabEntry[] = [
      { token: 'tinned tomatoes', label: 'Tinned tomatoes' },
      { token: 'spring onions', label: 'Spring onions' },
    ];
    const { matches } = parseReceipt([{ text: 'TOMATOES 0.89' }, { text: 'ONIONS 0.68' }], VARIANT_ONLY);
    expect(matches.length).toBe(2);
    for (const m of matches) expect(m.variant, `${m.line} -> ${m.token}`).toBe(true);
    // and with the plain tokens present (D17 part a), the same lines are NOT variants
    const clean = parseReceipt([{ text: 'TOMATOES 0.89' }, { text: 'ONIONS 0.68' }], VOCAB);
    for (const m of clean.matches) expect(m.variant).toBe(false);
  });

  it('an unreadable / non-food line goes to unmatched, never a bad stock', () => {
    const { matches, unmatched } = parseReceipt([{ text: 'ZXCV QWERTY 9.99' }], VOCAB);
    expect(matches).toEqual([]);
    expect(unmatched).toEqual(['ZXCV QWERTY 9.99']);
  });
});
