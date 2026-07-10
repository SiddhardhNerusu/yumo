import { describe, it, expect, beforeEach } from 'vitest';
import { learnedPortion, portionChips } from '../src/portion';
import type { WeekMenu } from '../src/menu';
import { log, resetIds } from './_fixtures';

beforeEach(resetIds);

describe('portion learning', () => {
  it('medians the last 5 logged portions', () => {
    const events = [
      log('rice', 'lunch', 6, 12, 100),
      log('rice', 'lunch', 5, 12, 120),
      log('rice', 'lunch', 4, 12, 110),
      log('rice', 'lunch', 3, 12, 130),
      log('rice', 'lunch', 2, 12, 200),
      log('rice', 'lunch', 1, 12, 140), // most recent 5 = 120,110,130,200,140 → median 130
    ];
    expect(learnedPortion(events, 'rice', { sampleSize: 5 })).toBe(130);
  });

  it('seeds from the menu quantity before any logs', () => {
    const menu: WeekMenu = [{ dayOfWeek: 1, slot: 'lunch', foodId: 'rice', portionG: 180 }];
    expect(learnedPortion([], 'rice', { menu, dayOfWeek: 1, slot: 'lunch' })).toBe(180);
  });

  it('falls back to the food-graph default with no logs or menu', () => {
    expect(learnedPortion([], 'rice', { fallbackG: 200 })).toBe(200);
  });

  it('offers −25% / usual / +25% chips rounded to 5g', () => {
    expect(portionChips(200)).toEqual({ less: 150, usual: 200, more: 250 });
  });
});
