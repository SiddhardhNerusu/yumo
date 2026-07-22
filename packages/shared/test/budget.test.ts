import { describe, it, expect } from 'vitest';
import { mifflinStJeorBMR, tdee, dailyBudget } from '../src/budget';

describe('Mifflin-St Jeor + budget', () => {
  it('computes BMR for a man', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(mifflinStJeorBMR({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780);
  });

  it('computes BMR for a woman', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25 → 1320
    expect(mifflinStJeorBMR({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBe(1320);
  });

  it('applies the activity multiplier for TDEE', () => {
    expect(tdee({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }, 'desk')).toBe(2136); // 1780 × 1.2
  });

  it('subtracts a sensible daily deficit for a loss goal', () => {
    const r = dailyBudget({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'desk', goal: 'lose', rateKgPerWeek: 0.5 });
    expect(r.tdee).toBe(2136);
    expect(r.dailyDelta).toBe(-550); // 0.5 × 7700 / 7
    expect(r.target).toBe(1586);
    expect(r.floored).toBe(false);
  });

  it('never renders below the floor and flags the signpost', () => {
    // aggressive loss for a small person → would fall under 1200
    const r = dailyBudget({ weightKg: 60, heightCm: 165, age: 30, sex: 'female', activity: 'desk', goal: 'lose', rateKgPerWeek: 1.0 });
    expect(r.rawTarget).toBeLessThan(1200);
    expect(r.target).toBe(1200);
    expect(r.floored).toBe(true);
    expect(r.edSignpost).toBe(true);
  });

  it('maintain = TDEE with no delta', () => {
    const r = dailyBudget({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'active', goal: 'maintain', rateKgPerWeek: 0.5 });
    expect(r.dailyDelta).toBe(0);
    expect(r.target).toBe(r.tdee);
  });

  it('maintenanceOverride (True burn) replaces the Mifflin base; pace deficit + floor still apply', () => {
    const r = dailyBudget({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'desk', goal: 'lose', rateKgPerWeek: 0.5, maintenanceOverride: 2340 });
    expect(r.tdee).toBe(2340); // echoes the measured burn, NOT 2136 Mifflin
    expect(r.dailyDelta).toBe(-550); // pace deficit unchanged
    expect(r.target).toBe(1790); // 2340 − 550
    expect(r.floored).toBe(false);
  });

  it('maintenanceOverride still respects the ED floor', () => {
    const r = dailyBudget({ weightKg: 60, heightCm: 165, age: 30, sex: 'female', activity: 'desk', goal: 'lose', rateKgPerWeek: 1.0, maintenanceOverride: 1300 });
    expect(r.rawTarget).toBe(200); // 1300 − 1100
    expect(r.target).toBe(1200); // clamped up to the female floor
    expect(r.floored).toBe(true);
  });
});
