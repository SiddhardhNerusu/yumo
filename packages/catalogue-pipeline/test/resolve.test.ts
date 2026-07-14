import { describe, it, expect } from 'vitest';
import { store, byId } from './_helpers';
import { resolveIngredient, tokenize, isStateMismatch } from '../src/fdc/resolve';

const kcalOf = (q: string) => byId.get(resolveIngredient(q, undefined, store, byId).fdcId as number)?.per100g.kcal ?? 0;
const descOf = (q: string) => (resolveIngredient(q, undefined, store, byId).matchedDescription ?? '').toLowerCase();

describe('ingredient resolver', () => {
  it('singularizes for matching (banana → Bananas)', () => {
    expect(tokenize('bananas, raw')).toEqual(tokenize('banana raw'));
  });

  it('prefers the food itself over a composite that merely contains it', () => {
    const r = resolveIngredient('olive oil', undefined, store, byId);
    const food = r.fdcId != null ? byId.get(r.fdcId) : null;
    // Should be an oil (~fat only), not mayonnaise/dressing.
    expect(food?.per100g.fat_g ?? 0).toBeGreaterThan(80);
    expect(food?.description.toLowerCase()).not.toMatch(/mayonnaise|dressing|sausage/);
  });

  it('resolves a plain whole food with high confidence', () => {
    const r = resolveIngredient('banana, raw', undefined, store, byId);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(byId.get(r.fdcId as number)?.description.toLowerCase()).toMatch(/banana/);
  });

  it('honours a valid pin deterministically', () => {
    const r = resolveIngredient('anything at all', 168878, store, byId);
    expect(r.method).toBe('pinned');
    expect(r.fdcId).toBe(168878);
    expect(r.confidence).toBe(1);
    expect(r.needsReview).toBe(false);
  });

  it('flags an invalid pin for review instead of trusting it', () => {
    const r = resolveIngredient('white rice, cooked', 999999999, store, byId);
    expect(r.needsReview).toBe(true);
  });

  // §6.3 cooked-weight accuracy — a "cooked" query must reach the cooked entry,
  // never the dry one (dry chickpeas ~378 vs cooked ~164 kcal, a 2.5x error).
  it('resolves "chickpeas, cooked" to a cooked entry, not the dry one', () => {
    expect(descOf('chickpeas, cooked')).not.toMatch(/\bdry\b/);
    expect(kcalOf('chickpeas, cooked')).toBeLessThan(220); // cooked ~164, dry ~378
  });

  it('resolves cooked grains/legumes on the cooked basis', () => {
    expect(kcalOf('white rice, cooked')).toBeLessThan(180); // cooked ~130, dry ~360
    expect(kcalOf('black beans, cooked')).toBeLessThan(200); // cooked ~132, dry ~341
  });

  // §6.2 prefer the generic form over a special preparation (sprouted/cured/fat).
  it('prefers plain cooked over sprouted, and lean over fat/cured', () => {
    expect(descOf('lentils, cooked')).not.toMatch(/sprouted/);
    expect(kcalOf('kidney beans, cooked')).toBeGreaterThan(90); // plain ~127, not sprouted ~33
    expect(descOf('beef, cooked')).not.toMatch(/separable fat|cured|breakfast strips/);
  });

  it('isStateMismatch flags cooked→raw but not aligned states', () => {
    expect(isStateMismatch('chickpeas, cooked', 'Chickpeas, dry')).toBe(true);
    expect(isStateMismatch('chickpeas, cooked', 'Chickpeas, cooked, boiled')).toBe(false);
    expect(isStateMismatch('onion', 'Onions, raw')).toBe(false); // query has no state
  });

  // Whole foods must not resolve to processed derivatives (egg→dried-powder 888,
  // cod→cod-liver-oil 1624, walnuts→walnut-oil) — a whole class of ~10x errors.
  it('resolves whole foods to the food, not a derivative', () => {
    expect(kcalOf('egg')).toBeLessThan(200); // fresh ~143, not dried powder ~888
    expect(descOf('egg')).not.toMatch(/dried/);
    expect(kcalOf('cod')).toBeLessThan(150); // fish ~82, not cod-liver-oil ~1624
    expect(descOf('walnuts')).not.toMatch(/\boil\b/); // whole nut, not walnut oil
  });

  it('the query-asks-for-it guard still reaches special forms', () => {
    expect(descOf('dried apricots')).toMatch(/dried/); // query says dried → not penalised
    expect(descOf('olive oil')).toMatch(/oil/);
    expect(descOf('goat cheese')).toMatch(/goat/);
  });

  // British→US normalisation so a UK recipe term reaches the FDC entry.
  it('normalises British ingredient names to their US FDC term', () => {
    expect(descOf('courgette')).toMatch(/zucchini/);
    expect(descOf('prawns')).toMatch(/shrimp/);
    expect(descOf('rocket')).toMatch(/arugula/);
    expect(descOf('sweetcorn')).toMatch(/corn/);
  });

  it('does not treat freeze-dried as fresh-raw for the state bonus', () => {
    expect(descOf('parsley, raw')).not.toMatch(/dried/); // fresh parsley ~36, not freeze-dried ~271
  });
});
