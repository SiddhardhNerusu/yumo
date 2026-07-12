import { describe, it, expect } from 'vitest';
import { parseAddUtterance, resolveFood, type FoodVocabEntry } from '../src/voiceAdd';

const vocab: FoodVocabEntry[] = [
  { token: 'chicken breast', label: 'Chicken breast' },
  { token: 'chicken', label: 'Chicken' },
  { token: 'rice', label: 'Rice' },
  { token: 'spinach', label: 'Spinach' },
  { token: 'milk', label: 'Milk' },
  { token: 'eggs', label: 'Eggs' },
  { token: 'bananas', label: 'Bananas' },
  { token: 'tinned tomatoes', label: 'Tinned tomatoes' },
];
const phrases = (t: string) => parseAddUtterance(t).map((i) => i.phrase);

describe('parseAddUtterance — segmentation', () => {
  it('splits the headline example into three items', () => {
    expect(phrases('add chicken, rice and a bag of spinach')).toEqual(['chicken', 'rice', 'spinach']);
  });
  it('strips a variety of lead verbs', () => {
    expect(phrases('i just bought milk and eggs')).toEqual(['milk', 'eggs']);
    expect(phrases('grab some spinach')).toEqual(['spinach']);
    expect(phrases('we need rice')).toEqual(['rice']);
  });
  it('handles plus / ampersand / semicolon connectives', () => {
    expect(phrases('milk plus eggs & rice; spinach')).toEqual(['milk', 'eggs', 'rice', 'spinach']);
  });
  it('drops empty fragments and pure filler', () => {
    expect(phrases('add , and please')).toEqual([]);
  });
});

describe('parseAddUtterance — quantity → level (fuzzy, never a count)', () => {
  it('container words imply "some"', () => {
    const [it0] = parseAddUtterance('a bag of spinach');
    expect(it0).toMatchObject({ phrase: 'spinach', level: 'some' });
  });
  it('lots/loads → plenty', () => {
    expect(parseAddUtterance('loads of rice')[0]!.level).toBe('plenty');
  });
  it('running low → low', () => {
    expect(parseAddUtterance('running low on milk')[0]).toMatchObject({ phrase: 'milk', level: 'low' });
  });
  it('parses spoken cardinals once, left-to-right (the Goyo bug class)', () => {
    // "a dozen" = 12, "half a dozen" = 6, "a couple" = 2 — not substitution-order garbage
    expect(parseAddUtterance('a dozen eggs')[0]).toMatchObject({ phrase: 'eggs', qty: 12, level: 'plenty' });
    expect(parseAddUtterance('half a dozen bananas')[0]).toMatchObject({ qty: 6, level: 'plenty' });
    expect(parseAddUtterance('a couple of bananas')[0]).toMatchObject({ qty: 2, level: 'some' });
  });
  it('"a"/"an" is an article, not a count of one', () => {
    expect(parseAddUtterance('a chicken')[0]).toMatchObject({ phrase: 'chicken', qty: null });
  });
  it('digit quantities work and scale the level', () => {
    expect(parseAddUtterance('add 6 eggs')[0]).toMatchObject({ qty: 6, level: 'plenty' });
  });
});

describe('resolveFood — catalog-anchored, never a dead-end', () => {
  it('exact token resolves canonically', () => {
    expect(resolveFood('rice', vocab)).toMatchObject({ token: 'rice', canonical: true });
  });
  it('a spoken sub-word canonicalises to the fuller token', () => {
    // "chicken" should reach a chicken token, not stay raw
    expect(resolveFood('chicken', vocab).canonical).toBe(true);
  });
  it('tolerates ASR typos via fuzzy similarity', () => {
    expect(resolveFood('chikn', vocab)).toMatchObject({ token: 'chicken', canonical: true });
    expect(resolveFood('spinnach', vocab)).toMatchObject({ token: 'spinach', canonical: true });
  });
  it('an unknown food is added as spoken, not dropped', () => {
    const r = resolveFood('dragonfruit', vocab);
    expect(r.canonical).toBe(false);
    expect(r.token).toBe('dragonfruit');
    expect(r.label).toBe('Dragonfruit');
  });
});
