import { describe, it, expect } from 'vitest';
import { verifyEnergyConsistency } from '../src/verify';

describe('energy consistency (Atwater cross-check)', () => {
  it('passes when FDC energy agrees with 4/4/9 from macros', () => {
    // 20p + 50c + 11f → 379 Atwater; 388 measured → 2.3% deviation
    const v = verifyEnergyConsistency({ kcal: 388, protein_g: 20, carbs_g: 50, fat_g: 11 });
    expect(v.passes).toBe(true);
    expect(v.deviationPct).toBeLessThan(0.05);
  });

  it('fails when energy and macros are inconsistent', () => {
    const v = verifyEnergyConsistency({ kcal: 200, protein_g: 20, carbs_g: 50, fat_g: 11 });
    expect(v.passes).toBe(false);
  });
});
