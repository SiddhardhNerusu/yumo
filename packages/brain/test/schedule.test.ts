import { describe, it, expect } from 'vitest';
import { medianLogMinute, nextFireTs } from '../src/schedule';
import { localParts } from '../src/time';
import type { BrainEvent } from '../src/events';

const DAY = 86_400_000;
const ev = (id: string, day: number, hour: number, minute: number, slot: string): BrainEvent => ({
  id,
  ts: day * DAY + (hour * 60 + minute) * 60_000,
  tzOffsetMin: 0,
  kind: 'log',
  foodId: 'x',
  slot: slot as BrainEvent['slot'],
});

describe('medianLogMinute', () => {
  it('returns null when the slot has no history (never schedule at midnight)', () => {
    expect(medianLogMinute([], 'breakfast')).toBeNull();
    expect(medianLogMinute([ev('a', 10, 8, 0, 'lunch')], 'breakfast')).toBeNull();
  });

  it('is the median minute-of-day for that slot only', () => {
    const events = [
      ev('a', 10, 8, 0, 'breakfast'), // 480
      ev('b', 11, 8, 30, 'breakfast'), // 510
      ev('c', 12, 9, 0, 'breakfast'), // 540 (median)
      ev('d', 12, 13, 0, 'lunch'), // other slot, ignored
    ];
    expect(medianLogMinute(events, 'breakfast')).toBe(510); // median of 480,510,540
  });
});

describe('nextFireTs', () => {
  it('fires leadMin before the target, later today when the target is ahead', () => {
    const now = 20000 * DAY + 7 * 60 * 60_000; // 07:00 UTC
    const ts = nextFireTs(now, 8 * 60 + 30, 10, 0); // target 08:30, lead 10 → 08:20 today
    const p = localParts(ts, 0);
    expect(p.epochDay).toBe(20000);
    expect(p.minutesOfDay).toBe(8 * 60 + 20);
    expect(ts).toBeGreaterThan(now);
  });

  it('rolls to tomorrow when the fire moment already passed today', () => {
    const now = 20000 * DAY + 12 * 60 * 60_000; // 12:00 UTC
    const ts = nextFireTs(now, 8 * 60 + 30, 10, 0); // 08:20 already passed → tomorrow
    const p = localParts(ts, 0);
    expect(p.epochDay).toBe(20001);
    expect(p.minutesOfDay).toBe(8 * 60 + 20);
  });

  it('round-trips localParts in the UTC frame (no double-localisation)', () => {
    const now = 20000 * DAY + 6 * 60 * 60_000;
    const ts = nextFireTs(now, 19 * 60, 10, 0); // dinner 19:00 − 10 = 18:50
    expect(localParts(ts, 0).minutesOfDay).toBe(18 * 60 + 50);
  });
});
