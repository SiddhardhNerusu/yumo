import { describe, it, expect, beforeEach } from 'vitest';
import { rankSlot, topPrediction, nextNudge, type PredictInput } from '../src/predict';
import { DEFAULT_CONFIG } from '../src/config';
import type { WeekMenu } from '../src/menu';
import { NOW, habit, accept, resetIds } from './_fixtures';

beforeEach(resetIds);

const chickenMenu: WeekMenu = [{ dayOfWeek: 1, slot: 'lunch', foodId: 'chicken_rice' }]; // Monday

function input(over: Partial<PredictInput>): PredictInput {
  return {
    events: [],
    candidates: ['chicken_rice'],
    slot: 'lunch',
    now: NOW,
    tzOffsetMin: 0,
    config: DEFAULT_CONFIG,
    ...over,
  };
}

describe('prediction replay', () => {
  it('FLAGSHIP: a habitual, menu-aligned lunch fires a confident "the usual?" nudge', () => {
    const plan = nextNudge(input({ events: habit('chicken_rice', 'lunch', 20, 12), menu: chickenMenu }));
    expect(plan.fire).toBe(true);
    expect(plan.framing).toBe('confident');
    expect(plan.prediction?.foodId).toBe('chicken_rice');
    expect(plan.prediction?.tier).toBe('high');
    expect(plan.prediction?.action).toBe('nudge');
  });

  it('a habit with no menu backing lands in tiles, not a proactive nudge', () => {
    const plan = nextNudge(input({ events: habit('chicken_rice', 'lunch', 20, 12) }));
    expect(plan.fire).toBe(false);
    expect(topPrediction(input({ events: habit('chicken_rice', 'lunch', 20, 12) }))?.tier).toBe('medium');
  });

  it('COLD START: day 0 offers a menu-framed confirmation nudge', () => {
    const menu: WeekMenu = [{ dayOfWeek: 1, slot: 'breakfast', foodId: 'oats', portionG: 50 }];
    const plan = nextNudge(input({ events: [], candidates: ['oats'], slot: 'breakfast', menu }));
    expect(plan.fire).toBe(true);
    expect(plan.framing).toBe('menu');
    expect(plan.prediction?.foodId).toBe('oats');
    expect(plan.prediction?.portionG).toBe(50); // seeded from the menu quantity
  });

  it('learned portion rides along on the prediction', () => {
    const events = habit('chicken_rice', 'lunch', 6, 12, 220);
    const top = topPrediction(input({ events, menu: chickenMenu }));
    expect(top?.portionG).toBe(220);
  });

  it('the nudge budget blocks even a high-confidence prediction', () => {
    const events = [
      ...habit('chicken_rice', 'lunch', 20, 12),
      accept('a', 'breakfast', 0, 7),
      accept('b', 'lunch', 0, 9),
      accept('c', 'snack', 0, 10),
    ];
    const plan = nextNudge(input({ events, menu: chickenMenu }));
    expect(plan.prediction?.tier).toBe('high'); // still confident…
    expect(plan.fire).toBe(false); // …but budget-blocked
  });
});
