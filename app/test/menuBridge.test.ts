import { describe, it, expect } from 'vitest';
import { weekMenuFor } from '../src/data/menuBridge';
import type { WeekMenuPlan } from '@yumo/menu';

// Minimal WeekMenuPlan shape — weekMenuFor only reads day.dayOfWeek, pick.slot,
// pick.recipe.id. Regression guard: a type-correct logic swap (array index for
// dayOfWeek, or recipe.name for recipe.id) would compile but silently zero
// menuPrior for real users; TypeScript alone can't catch it.
const plan = (): WeekMenuPlan => ({
  days: [
    { dayOfWeek: 0, picks: [{ slot: 'breakfast', recipe: { id: 'fdc:171705' } }], totalKcal: 0, totalProtein_g: 0 },
    { dayOfWeek: 3, picks: [
      { slot: 'lunch', recipe: { id: 'oats_bowl' } },
      { slot: 'dinner', recipe: { id: 'salmon_veg' } },
    ], totalKcal: 0, totalProtein_g: 0 },
  ],
  warnings: [],
}) as unknown as WeekMenuPlan;

describe('weekMenuFor (WeekMenuPlan → Brain WeekMenu)', () => {
  it('maps each pick to {dayOfWeek, slot, foodId: recipe.id}', () => {
    expect(weekMenuFor(plan())).toEqual([
      { dayOfWeek: 0, slot: 'breakfast', foodId: 'fdc:171705' },
      { dayOfWeek: 3, slot: 'lunch', foodId: 'oats_bowl' },
      { dayOfWeek: 3, slot: 'dinner', foodId: 'salmon_veg' },
    ]);
  });

  it('uses the day OWN dayOfWeek, not the array index', () => {
    // day index 1 has dayOfWeek 3 — a `days.map((d,i)=>i)` bug would emit 0/1 here.
    const out = weekMenuFor(plan());
    expect(out.filter((e) => e.slot !== 'breakfast').every((e) => e.dayOfWeek === 3)).toBe(true);
  });

  it('empty plan → empty menu (no crash, menuPrior stays 0)', () => {
    expect(weekMenuFor({ days: [], warnings: [] } as unknown as WeekMenuPlan)).toEqual([]);
  });
});
