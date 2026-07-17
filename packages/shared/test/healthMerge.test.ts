import { describe, it, expect } from 'vitest';
import { mergeHealthEntries, type DayWeight } from '../src/healthMerge';

describe('mergeHealthEntries (Apple Health → weigh-ins)', () => {
  it('adds a health sample on a day with no entry', () => {
    const out = mergeHealthEntries([], [{ day: 10, kg: 74.2, ts: 100 }]);
    expect(out).toEqual([{ day: 10, kg: 74.2, ts: 100, source: 'health' }]);
  });

  it('collapses many samples per day to the LATEST by ts', () => {
    const out = mergeHealthEntries([], [
      { day: 10, kg: 74.5, ts: 100 },
      { day: 10, kg: 74.2, ts: 300 }, // latest
      { day: 10, kg: 74.9, ts: 200 },
    ]);
    expect(out).toEqual([{ day: 10, kg: 74.2, ts: 300, source: 'health' }]);
  });

  it('NEVER clobbers a manual entry (absent source == manual)', () => {
    const existing: DayWeight[] = [{ day: 10, kg: 73.0, ts: 50 }]; // no source → manual
    const out = mergeHealthEntries(existing, [{ day: 10, kg: 99.9, ts: 999 }]);
    expect(out).toEqual([{ day: 10, kg: 73.0, ts: 50 }]); // unchanged
  });

  it('DOES replace a previously-imported health day with a corrected sample', () => {
    const existing: DayWeight[] = [{ day: 10, kg: 74.0, ts: 50, source: 'health' }];
    const out = mergeHealthEntries(existing, [{ day: 10, kg: 74.3, ts: 999 }]);
    expect(out).toEqual([{ day: 10, kg: 74.3, ts: 999, source: 'health' }]);
  });

  it('merges across a mix of manual and health days, sorted by day', () => {
    const existing: DayWeight[] = [
      { day: 8, kg: 75.0, ts: 10 }, // manual
      { day: 9, kg: 74.5, ts: 20, source: 'health' }, // prior import
    ];
    const out = mergeHealthEntries(existing, [
      { day: 8, kg: 60.0, ts: 999 }, // manual day → skipped
      { day: 9, kg: 74.4, ts: 999 }, // health day → replaced
      { day: 10, kg: 74.1, ts: 999 }, // new day → added
    ]);
    expect(out).toEqual([
      { day: 8, kg: 75.0, ts: 10 },
      { day: 9, kg: 74.4, ts: 999, source: 'health' },
      { day: 10, kg: 74.1, ts: 999, source: 'health' },
    ]);
  });

  it('is a no-op when there are no samples', () => {
    const existing: DayWeight[] = [{ day: 10, kg: 73.0, ts: 50 }];
    expect(mergeHealthEntries(existing, [])).toEqual(existing);
  });
});
