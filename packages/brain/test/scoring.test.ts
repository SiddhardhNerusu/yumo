import { describe, it, expect, beforeEach } from 'vitest';
import { scoreCandidates } from '../src/scoring';
import { DEFAULT_CONFIG } from '../src/config';
import type { WeekMenu } from '../src/menu';
import { NOW, habit, resetIds } from './_fixtures';

beforeEach(resetIds);

const base = {
  slot: 'lunch' as const,
  now: NOW,
  tzOffsetMin: 0,
  config: DEFAULT_CONFIG,
};

describe('scoring', () => {
  it('ranks a strong daily habit first with maxed freq/tod', () => {
    const events = habit('chicken_rice', 'lunch', 20, 12);
    const ranked = scoreCandidates({ ...base, events, candidates: ['chicken_rice', 'pizza'] });
    expect(ranked[0]?.foodId).toBe('chicken_rice');
    expect(ranked[0]?.breakdown.freq).toBe(1); // every lunch was this food
    expect(ranked[0]?.breakdown.tod).toBeGreaterThan(0.99); // logged at noon, scored at noon
    // A pure habit (no menu) tops out in the "tiles" band, not a proactive nudge.
    expect(ranked[0]?.score).toBeGreaterThan(0.6);
    expect(ranked[0]?.score).toBeLessThan(DEFAULT_CONFIG.ladder.nudge);
  });

  it('habit + menu alignment clears the high-confidence threshold', () => {
    const events = habit('chicken_rice', 'lunch', 20, 12);
    const menu: WeekMenu = [{ dayOfWeek: 1, slot: 'lunch', foodId: 'chicken_rice' }]; // Monday
    const ranked = scoreCandidates({ ...base, events, candidates: ['chicken_rice'], menu });
    expect(ranked[0]?.breakdown.menuPrior).toBe(1);
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.ladder.nudge);
  });

  it('a recent decline drives the score down', () => {
    const events = habit('chicken_rice', 'lunch', 20, 12);
    const withDecline = [
      ...events,
      { id: 'd', ts: NOW - 3_600_000, tzOffsetMin: 0, kind: 'nudge_decline' as const, foodId: 'chicken_rice', slot: 'lunch' as const },
    ];
    const a = scoreCandidates({ ...base, events, candidates: ['chicken_rice'] })[0]!.score;
    const b = scoreCandidates({ ...base, events: withDecline, candidates: ['chicken_rice'] })[0]!.score;
    expect(b).toBeLessThan(a);
  });

  it('cold-start scales data-driven terms by days_active/7', () => {
    const events = habit('oats', 'breakfast', 2, 8); // earliest log is 2 days + 4h ago
    const ranked = scoreCandidates({
      ...base,
      slot: 'breakfast',
      events,
      candidates: ['oats'],
    });
    // days_active = 2 + (12:00 now − 08:00 log)/24h = 2.167 → 2.167/7
    expect(ranked[0]?.breakdown.dataFactor).toBeCloseTo((2 + 4 / 24) / 7, 4);
    expect(ranked[0]?.breakdown.dataFactor).toBeLessThan(1); // still scaling up
  });
});
