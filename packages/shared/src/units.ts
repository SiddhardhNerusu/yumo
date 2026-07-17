/**
 * Weight units (§M3). Storage is ALWAYS kg (canonical, 2dp — see weightStore);
 * these are pure display/parse helpers so lb/st are a presentation choice only.
 * A single joined string can't format every surface (the Progress hero is two
 * Text nodes; deltas are signed magnitudes), so `weightParts` / `weightDelta`
 * return `{ value, suffix }` and callers compose.
 */
export type WeightUnit = 'kg' | 'lb' | 'st';

const LB_PER_KG = 2.2046226218;

/** The unit weights are edited/typed in for a given display unit — stones are
 * entered at lb granularity (one field, not a st+lb pair), so 'st' edits in lb. */
export function editUnitFor(unit: WeightUnit): 'kg' | 'lb' {
  return unit === 'kg' ? 'kg' : 'lb';
}

/** Absolute weight → display parts. kg: "74.2"/"kg"; lb: "163.6"/"lb";
 * st: "11 st 9.6"/"lb" (value carries the "st", suffix is the trailing lb). */
export function weightParts(kg: number, unit: WeightUnit): { value: string; suffix: string } {
  if (unit === 'lb') return { value: (kg * LB_PER_KG).toFixed(1), suffix: 'lb' };
  if (unit === 'st') {
    const lb = kg * LB_PER_KG;
    const st = Math.floor(lb / 14);
    const rem = lb - st * 14;
    return { value: `${st} st ${rem.toFixed(1)}`, suffix: 'lb' };
  }
  return { value: kg.toFixed(1), suffix: 'kg' };
}

/** Convenience join for the surfaces that want one string. */
export function kgToDisplay(kg: number, unit: WeightUnit): string {
  const p = weightParts(kg, unit);
  return `${p.value} ${p.suffix}`;
}

/** A signed *delta* (magnitude only — the caller supplies ▾/▴ or +/−). Deltas
 * render in lb when the unit is st: "−0 st 2.2 lb" is nonsense (D10). */
export function weightDelta(kgDelta: number, unit: WeightUnit): { value: string; suffix: string } {
  const u: WeightUnit = unit === 'st' ? 'lb' : unit;
  return weightParts(Math.abs(kgDelta), u);
}

/** Parse a number typed in the edit unit back to canonical kg. For 'st' the
 * value is in lb (see editUnitFor), so both non-kg cases divide by LB_PER_KG. */
export function displayToKg(value: number, unit: WeightUnit): number {
  return editUnitFor(unit) === 'kg' ? value : value / LB_PER_KG;
}

/** kg → the number to seed/type in the edit unit (kg or lb). */
export function kgToEditValue(kg: number, unit: WeightUnit): number {
  return editUnitFor(unit) === 'kg' ? kg : kg * LB_PER_KG;
}

/** Canonical storage rounding: 2dp kg. 1dp (0.22 lb) was too coarse for lb/st to
 * round-trip — half of all 1dp lb values were unreachable and shifted on save. */
export function roundStorageKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}
