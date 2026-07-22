import { describe, it, expect } from 'vitest';
import { trendSeries, trendAt, maxTrendJump, TREND_HALFLIFE_DAYS } from '../src/trend';
import type { DayKg } from '../src/weightWindows';

const T = 20000; // arbitrary epoch-day anchor

describe('trendSeries', () => {
  it('empty in → empty out', () => {
    expect(trendSeries([])).toEqual([]);
  });

  it('a single weigh-in is a one-point flat series', () => {
    expect(trendSeries([{ day: T, kg: 80 }])).toEqual([{ day: T, kg: 80 }]);
  });

  it('emits one point per day between the first and last weigh-in', () => {
    const s = trendSeries([{ day: T, kg: 80 }, { day: T + 10, kg: 80 }]);
    expect(s).toHaveLength(11);
    expect(s[0]!.day).toBe(T);
    expect(s[10]!.day).toBe(T + 10);
    // flat input → flat trend
    expect(s.every((p) => p.kg === 80)).toBe(true);
  });

  it('linearly interpolates gaps before smoothing (no step function)', () => {
    // weighed only on day 0 and day 4; the raw daily series ramps 80→84
    const s = trendSeries([{ day: T, kg: 80 }, { day: T + 4, kg: 84 }]);
    expect(s).toHaveLength(5);
    // strictly increasing, and the EWMA lags the raw ramp so it ends below 84
    for (let i = 1; i < s.length; i++) expect(s[i]!.kg).toBeGreaterThan(s[i - 1]!.kg);
    expect(s[s.length - 1]!.kg).toBeLessThan(84);
    expect(s[0]!.kg).toBe(80);
  });

  it('smooths a noisy scale spike (trend barely moves)', () => {
    // steady 80 with one 85 spike on the last day
    const raw: DayKg[] = [];
    for (let i = 0; i < 20; i++) raw.push({ day: T + i, kg: 80 });
    raw.push({ day: T + 20, kg: 85 });
    const s = trendSeries(raw);
    const last = s[s.length - 1]!.kg;
    // a +5 kg raw spike moves the trend by only ~alpha*5 (≈0.33), never the full 5
    expect(last).toBeGreaterThan(80);
    expect(last).toBeLessThan(80.6);
  });

  it('weights recent weigh-ins more (trend lags a monotonic climb)', () => {
    const raw: DayKg[] = [];
    for (let i = 0; i <= 30; i++) raw.push({ day: T + i, kg: 80 + i * 0.1 }); // 80 → 83
    const s = trendSeries(raw);
    const rawLast = 83;
    // EWMA of a rising series sits below the latest raw value but tracks it (lags ~1.2 kg over 30d)
    expect(s[s.length - 1]!.kg).toBeLessThan(rawLast);
    expect(s[s.length - 1]!.kg).toBeGreaterThan(81);
  });

  it('half-life constant is a sane ~10 days', () => {
    expect(TREND_HALFLIFE_DAYS).toBe(10);
  });
});

describe('trendAt', () => {
  const s = trendSeries([{ day: T, kg: 80 }, { day: T + 10, kg: 79 }]);

  it('null on an empty series', () => {
    expect(trendAt([], T)).toBeNull();
  });

  it('clamps to the domain endpoints', () => {
    expect(trendAt(s, T - 50)).toBe(s[0]!.kg);
    expect(trendAt(s, T + 999)).toBe(s[s.length - 1]!.kg);
  });

  it('reads the in-domain daily value by O(1) index', () => {
    expect(trendAt(s, T + 5)).toBe(s[5]!.kg);
  });
});

describe('maxTrendJump', () => {
  it('is small for a clean series', () => {
    const s = trendSeries([{ day: T, kg: 80 }, { day: T + 27, kg: 78 }]);
    expect(maxTrendJump(s, T, T + 27)).toBeLessThan(0.2);
  });

  it('flags a fat-fingered weigh-in (gross single-day jump)', () => {
    // 78 kg mistyped as 108 kg on one day — even damped, the trend step exceeds 1.5
    const raw: DayKg[] = [];
    for (let i = 0; i < 10; i++) raw.push({ day: T + i, kg: 78 });
    raw.push({ day: T + 10, kg: 108 });
    const s = trendSeries(raw);
    expect(maxTrendJump(s, T, T + 10)).toBeGreaterThan(1.5);
  });
});
