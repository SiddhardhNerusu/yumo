import { describe, it, expect } from 'vitest';
import { buildPantryRows, cousinsFor, hasCousins } from '../src/data/pantryCousins';

const labels = (r: { rows: { label: string }[] }) => r.rows.map((x) => x.label);

describe('cousinsFor / hasCousins', () => {
  it('returns the versioned cousins for a base staple', () => {
    expect(cousinsFor('Rice').map((c) => c.label)).toEqual(['Basmati rice', 'Brown rice', 'Jasmine rice', 'Microwave rice']);
    expect(cousinsFor('Rice')[0]!.token).toBe('basmati rice'); // lowercased token
  });
  it('is empty for a base with no cousins', () => {
    expect(cousinsFor('Garlic')).toEqual([]);
    expect(hasCousins('Garlic')).toBe(false);
    expect(hasCousins('Rice')).toBe(true);
  });
});

describe('buildPantryRows — no query (fan-out)', () => {
  it('shows only base staples when nothing is selected (no cousins leak in)', () => {
    const { rows, freeAddToken } = buildPantryRows([], '');
    expect(freeAddToken).toBe(null);
    expect(rows.every((r) => !r.cousin)).toBe(true);
    expect(rows.length).toBe(18); // PANTRY_STAPLES
    expect(labels({ rows })).toContain('Rice');
  });

  it('fans a selected staple’s cousins in immediately after it', () => {
    const { rows } = buildPantryRows(['rice'], '');
    const riceIdx = rows.findIndex((r) => r.token === 'rice');
    expect(rows[riceIdx + 1]?.label).toBe('Basmati rice');
    expect(rows[riceIdx + 1]?.cousin).toBe(true);
    // the next base staple (Pasta) comes after all of rice's 4 cousins
    expect(rows[riceIdx + 5]?.token).toBe('pasta');
  });

  it('keeps a selected cousin visible even when its base is not selected', () => {
    const { rows } = buildPantryRows(['basmati rice'], ''); // cousin selected, base 'rice' not
    const bas = rows.find((r) => r.token === 'basmati rice');
    expect(bas).toBeDefined();
    expect(bas!.cousin).toBe(true);
    // its siblings (unselected cousins of unselected base) do NOT show
    expect(rows.find((r) => r.token === 'brown rice')).toBeUndefined();
  });

  it('appends user customs (tokens not in base or cousin lists)', () => {
    const { rows } = buildPantryRows(['quinoa'], '');
    const q = rows.find((r) => r.token === 'quinoa');
    expect(q).toBeDefined();
    expect(q!.label).toBe('Quinoa'); // capitalized
    expect(q!.cousin).toBe(false);
  });
});

describe('buildPantryRows — search', () => {
  it('flat-filters base + cousins + customs by label substring', () => {
    const { rows } = buildPantryRows([], 'chick');
    const ls = rows.map((r) => r.label);
    expect(ls).toContain('Chicken'); // base
    expect(ls).toContain('Chicken breast'); // cousin
    expect(ls).toContain('Chickpeas'); // cousin of Beans
  });

  it('offers a free-add chip when nothing matches (query > 1 char)', () => {
    const { rows, freeAddToken } = buildPantryRows([], 'kimchi');
    expect(rows.length).toBe(0);
    expect(freeAddToken).toBe('kimchi');
  });

  it('does NOT free-add when the query exactly matches an existing label', () => {
    const { freeAddToken } = buildPantryRows([], 'rice');
    expect(freeAddToken).toBe(null);
  });

  it('does not free-add for a single character', () => {
    expect(buildPantryRows([], 'z').freeAddToken).toBe(null);
  });
});
