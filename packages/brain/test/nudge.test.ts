import { describe, it, expect, beforeEach } from 'vitest';
import { canNudge, slotIsQuiet, foodSuppressed } from '../src/nudge';
import { DEFAULT_CONFIG } from '../src/config';
import { NOW, accept, decline, resetIds } from './_fixtures';

beforeEach(resetIds);
const cfg = DEFAULT_CONFIG;

describe('nudge budget', () => {
  it('allows a nudge with a clean history', () => {
    expect(canNudge([], 'x', 'lunch', NOW, 0, cfg).allowed).toBe(true);
  });

  it('blocks once the daily budget is spent', () => {
    const events = [accept('a', 'breakfast', 0, 7), accept('b', 'lunch', 0, 9), accept('c', 'snack', 0, 10)];
    const d = canNudge(events, 'x', 'dinner', NOW, 0, cfg);
    expect(d.allowed).toBe(false);
    expect(d.reasons.some((r) => r.includes('daily'))).toBe(true);
  });

  it('blocks a second nudge in the same slot on the same day', () => {
    const events = [accept('a', 'lunch', 0, 9)];
    const d = canNudge(events, 'x', 'lunch', NOW, 0, cfg);
    expect(d.allowed).toBe(false);
    expect(d.reasons.some((r) => r.includes('slot'))).toBe(true);
  });

  it('goes quiet after two consecutive declines in a slot', () => {
    const events = [decline('x', 'dinner', 2, 18), decline('x', 'dinner', 1, 18)];
    expect(slotIsQuiet(events, 'dinner', NOW, cfg)).toBe(true);
    expect(canNudge(events, 'x', 'dinner', NOW, 0, cfg).reasons.some((r) => r.includes('quiet'))).toBe(true);
  });

  it('reopens the slot once a later acceptance breaks the decline streak', () => {
    const events = [decline('x', 'dinner', 2, 18), decline('x', 'dinner', 1, 18), accept('x', 'dinner', 0, 9)];
    expect(slotIsQuiet(events, 'dinner', NOW, cfg)).toBe(false);
  });

  it('suppresses a specific food after repeated declines (independent of quiet)', () => {
    // spread >48h apart so the slot is NOT quiet, but 3 declines land within 14d
    const events = [
      decline('salad', 'lunch', 11, 12),
      decline('salad', 'lunch', 7, 12),
      decline('salad', 'lunch', 3, 12),
    ];
    expect(foodSuppressed(events, 'salad', 'lunch', NOW, cfg)).toBe(true);
    expect(slotIsQuiet(events, 'lunch', NOW, cfg)).toBe(false);
    const d = canNudge(events, 'salad', 'lunch', NOW, 0, cfg);
    expect(d.reasons.some((r) => r.includes('suppressed'))).toBe(true);
  });
});
