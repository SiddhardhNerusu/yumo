import { describe, it, expect } from 'vitest';
import { weightParts, kgToDisplay, weightDelta, displayToKg, kgToEditValue, roundStorageKg, editUnitFor } from '../src/units';

describe('weight units', () => {
  it('formats kg as one decimal', () => {
    expect(weightParts(74.2, 'kg')).toEqual({ value: '74.2', suffix: 'kg' });
    expect(kgToDisplay(74.2, 'kg')).toBe('74.2 kg');
  });

  it('formats lb', () => {
    expect(weightParts(74.2, 'lb')).toEqual({ value: '163.6', suffix: 'lb' });
    expect(kgToDisplay(74.2, 'lb')).toBe('163.6 lb');
  });

  it('formats st as "N st R.r" + lb suffix', () => {
    // 74.2 kg = 163.583 lb = 11 st (154) + 9.6 lb
    expect(weightParts(74.2, 'st')).toEqual({ value: '11 st 9.6', suffix: 'lb' });
    expect(kgToDisplay(74.2, 'st')).toBe('11 st 9.6 lb');
  });

  it("the plan's acceptance case: 163.6 lb -> ~74.2 kg", () => {
    const kg = roundStorageKg(displayToKg(163.6, 'lb'));
    expect(kg).toBeCloseTo(74.2, 1);
    expect(weightParts(kg, 'lb').value).toBe('163.6'); // round-trips at 2dp storage
  });

  it('lb round-trips at 2dp storage across a swept range (the 1dp bug)', () => {
    for (let lb = 100; lb <= 260; lb += 0.1) {
      const shown = Number(lb.toFixed(1));
      const kg = roundStorageKg(displayToKg(shown, 'lb'));
      expect(weightParts(kg, 'lb').value).toBe(shown.toFixed(1));
    }
  });

  it('delta renders in lb when the unit is st (D10)', () => {
    // −1.0 kg = −2.2 lb; in st mode we still want lb, not "0 st 2.2"
    expect(weightDelta(-1.0, 'st')).toEqual({ value: '2.2', suffix: 'lb' });
    expect(weightDelta(-1.0, 'lb')).toEqual({ value: '2.2', suffix: 'lb' });
    expect(weightDelta(-1.2, 'kg')).toEqual({ value: '1.2', suffix: 'kg' });
  });

  it('edit-unit + seed value: st edits in lb', () => {
    expect(editUnitFor('st')).toBe('lb');
    expect(editUnitFor('lb')).toBe('lb');
    expect(editUnitFor('kg')).toBe('kg');
    expect(kgToEditValue(74.2, 'st')).toBeCloseTo(163.583, 2);
    expect(kgToEditValue(74.2, 'kg')).toBe(74.2);
  });

  it('displayToKg inverts kgToEditValue', () => {
    for (const unit of ['kg', 'lb', 'st'] as const) {
      const kg = displayToKg(kgToEditValue(80, unit), unit);
      expect(kg).toBeCloseTo(80, 6);
    }
  });
});
