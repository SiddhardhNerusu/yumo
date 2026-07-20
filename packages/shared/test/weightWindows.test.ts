import { describe, it, expect } from 'vitest';
import { windowWeights, type DayKg } from '../src/weightWindows';

const today = 20000;
// one weigh-in per day for the last 400 days, drifting down 0.02/day
const long: DayKg[] = Array.from({ length: 400 }, (_, i) => ({ day: today - 399 + i, kg: Math.round((80 - i * 0.02) * 100) / 100 }));

describe('windowWeights', () => {
  it('w keeps only the last 7 days', () => {
    const { points } = windowWeights(long, 'w', today);
    expect(points.length).toBe(7);
    expect(points[0]!.day).toBe(today - 6);
    expect(points[points.length - 1]!.day).toBe(today);
  });

  it('m keeps the last 30 days, raw (not aggregated)', () => {
    const { points } = windowWeights(long, 'm', today);
    expect(points.length).toBe(30);
  });

  it('delta is last − first WITHIN the window', () => {
    const { delta } = windowWeights(long, 'w', today);
    // 7 raw points spanning 6 days at −0.02/day ≈ −0.12
    expect(delta).toBeCloseTo(long[long.length - 1]!.kg - long[long.length - 7]!.kg, 5);
  });

  it('delta is null when the window has fewer than 2 points', () => {
    expect(windowWeights([{ day: today, kg: 74 }], 'w', today).delta).toBeNull();
    expect(windowWeights([], 'all', today).delta).toBeNull();
  });

  it('y/all aggregate to weekly means once over 60 points', () => {
    const { points } = windowWeights(long, 'all', today);
    expect(points.length).toBeLessThan(long.length); // aggregated
    expect(points.length).toBeGreaterThanOrEqual(57); // ~400/7
    // aggregated points stay in the plausible weight band
    expect(points.every((p) => p.kg >= 71 && p.kg <= 81)).toBe(true);
  });

  it('y with few points stays raw (no aggregation under the threshold)', () => {
    const sparse: DayKg[] = [{ day: today - 200, kg: 78 }, { day: today - 100, kg: 76 }, { day: today, kg: 74 }];
    const { points, delta } = windowWeights(sparse, 'y', today);
    expect(points.length).toBe(3);
    expect(delta).toBe(-4);
  });

  it('handles unsorted input', () => {
    const messy: DayKg[] = [{ day: today, kg: 74 }, { day: today - 6, kg: 75 }, { day: today - 3, kg: 74.5 }];
    const { points, delta } = windowWeights(messy, 'w', today);
    expect(points.map((p) => p.day)).toEqual([today - 6, today - 3, today]);
    expect(delta).toBe(74 - 75);
  });
});
