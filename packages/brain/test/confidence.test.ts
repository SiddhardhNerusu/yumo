import { describe, it, expect } from 'vitest';
import { tierForScore, actionForTier } from '../src/confidence';
import { DEFAULT_LADDER } from '../src/config';

describe('confidence ladder', () => {
  it('maps scores to tiers at the §3.4 thresholds', () => {
    expect(tierForScore(0.8, DEFAULT_LADDER)).toBe('high');
    expect(tierForScore(0.75, DEFAULT_LADDER)).toBe('high');
    expect(tierForScore(0.5, DEFAULT_LADDER)).toBe('medium');
    expect(tierForScore(0.4, DEFAULT_LADDER)).toBe('medium');
    expect(tierForScore(0.39, DEFAULT_LADDER)).toBe('low');
  });

  it('maps tiers to actions', () => {
    expect(actionForTier('high')).toBe('nudge');
    expect(actionForTier('medium')).toBe('tiles');
    expect(actionForTier('low')).toBe('silent');
  });
});
