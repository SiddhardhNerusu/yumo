import { describe, it, expect } from 'vitest';
import { parseProfileEnvelope } from '../src/data/goalPrefs';

const profile = { budgetKcal: 2000, targetWeightKg: 72, allergies: [], hates: [], needs: [], likes: [], pantry: [], variation: 'balanced' };

describe('parseProfileEnvelope', () => {
  it('reads the pre-prefs envelope (backwards compatible) with prefs undefined', () => {
    const env = parseProfileEnvelope(JSON.stringify({ profile, goal: 'lose' }));
    expect(env?.goal).toBe('lose');
    expect(env?.prefs).toBeUndefined();
    expect(env?.profile.budgetKcal).toBe(2000);
  });

  it('reads the new envelope with prefs', () => {
    const prefs = { heightCm: 180, age: 30, sex: 'male', activity: 'active', rateKgPerWeek: 0.5 };
    const env = parseProfileEnvelope(JSON.stringify({ profile, goal: 'gain', prefs }));
    expect(env?.goal).toBe('gain');
    expect(env?.prefs).toEqual(prefs);
  });

  it('defaults an invalid/missing goal to maintain', () => {
    expect(parseProfileEnvelope(JSON.stringify({ profile }))?.goal).toBe('maintain');
    expect(parseProfileEnvelope(JSON.stringify({ profile, goal: 'nonsense' }))?.goal).toBe('maintain');
  });

  it('returns null for null / empty / corrupt / profile-less input', () => {
    expect(parseProfileEnvelope(null)).toBeNull();
    expect(parseProfileEnvelope('')).toBeNull();
    expect(parseProfileEnvelope('{not json')).toBeNull();
    expect(parseProfileEnvelope(JSON.stringify({ goal: 'lose' }))).toBeNull();
    expect(parseProfileEnvelope(JSON.stringify({ profile: 'nope', goal: 'lose' }))).toBeNull();
  });
});
