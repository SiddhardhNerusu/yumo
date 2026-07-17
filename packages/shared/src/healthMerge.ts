/**
 * Apple Health → weigh-in merge (§M7, pure core). HealthKit returns many
 * bodyMass samples per day; this collapses them and merges into the existing
 * weigh-ins under two rules (D15):
 *   - never clobber a MANUAL entry (a weight the user hand-logged wins);
 *   - a day previously imported from Health CAN be updated by a corrected sample.
 * `source` distinguishes them ('manual' is the absent-field default, so every
 * pre-M7 row is treated as manual — backwards-compatible).
 *
 * Kept free of `localParts`/AsyncStorage so it lives in @yumo/shared and is
 * unit-tested: the app computes each sample's `day` (epochDay) and re-attaches
 * progress photos around this.
 */
export interface DayWeight {
  day: number;
  kg: number;
  ts: number;
  source?: 'manual' | 'health';
}

export function mergeHealthEntries(existing: DayWeight[], samples: DayWeight[]): DayWeight[] {
  // 1. collapse many samples per day to the latest by ts
  const byDay = new Map<number, DayWeight>();
  for (const s of samples) {
    const cur = byDay.get(s.day);
    if (!cur || s.ts > cur.ts) byDay.set(s.day, { day: s.day, kg: s.kg, ts: s.ts, source: 'health' });
  }
  // 2. merge, honoring the manual-wins rule
  const out = existing.slice();
  for (const s of byDay.values()) {
    const idx = out.findIndex((e) => e.day === s.day);
    if (idx < 0) {
      out.push(s);
      continue;
    }
    const existingSource = out[idx]!.source ?? 'manual';
    if (existingSource === 'manual') continue; // never overwrite a hand-logged weight
    out[idx] = s; // replace a prior import with the corrected sample
  }
  return out.sort((a, b) => a.day - b.day);
}
