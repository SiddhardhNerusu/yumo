/**
 * Macro split as whole-integer percentages. The shipped Settings editor is
 * MFP-style **free movement + strict 100% gating**: each macro slider moves
 * independently (so the sum CAN be off 100), a live badge shows the total, and
 * Save is disabled until it reads exactly 100. `balanceMacroPct` powers the
 * "Balance for me" one-tap fix, and `pctToGrams` derives grams from the current
 * budget at read time (so changing the calorie goal moves the grams without
 * touching the percentages). `rebalanceMacroPct` (auto-rebalance) and
 * `defaultMacroPct` (via normalizeToClamped) still guarantee sum===100 for
 * callers that want it, but the editor no longer auto-rebalances.
 */
export interface MacroPct {
  protein: number;
  carbs: number;
  fat: number;
}

/** AMDR-derived clamps; protein ceiling raised to 45 per fitness-app norm (a
 * lean lifter at 2.2 g/kg routinely exceeds the 35% population range). */
export const MACRO_PCT_CLAMP = {
  protein: [10, 45],
  carbs: [5, 65],
  fat: [15, 45],
} as const;

/** Mirrors @yumo/menu PROTEIN_FLOOR_PER_KG (1.6). Duplicated as a literal because
 * this package is the leaf — it cannot import from @yumo/menu. */
const PROTEIN_G_PER_KG = 1.6;

const clampInt = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(x)));

/** Force protein/carbs/fat into their clamps while preserving sum === 100, by
 * moving any deficit/excess between the three (carbs is the swing macro). */
function normalizeToClamped(p0: number, c0: number, f0: number): MacroPct {
  let protein = clampInt(p0, MACRO_PCT_CLAMP.protein[0], MACRO_PCT_CLAMP.protein[1]);
  let fat = clampInt(f0, MACRO_PCT_CLAMP.fat[0], MACRO_PCT_CLAMP.fat[1]);
  let carbs = 100 - protein - fat;
  const [clo, chi] = MACRO_PCT_CLAMP.carbs;
  if (carbs < clo) {
    let deficit = clo - carbs;
    carbs = clo;
    const fatRoom = fat - MACRO_PCT_CLAMP.fat[0];
    const takeFat = Math.min(deficit, Math.max(0, fatRoom));
    fat -= takeFat;
    deficit -= takeFat;
    protein = Math.max(MACRO_PCT_CLAMP.protein[0], protein - deficit);
    carbs = 100 - protein - fat;
  } else if (carbs > chi) {
    let excess = carbs - chi;
    carbs = chi;
    const proteinRoom = MACRO_PCT_CLAMP.protein[1] - protein;
    const takeP = Math.min(excess, Math.max(0, proteinRoom));
    protein += takeP;
    excess -= takeP;
    fat = Math.min(MACRO_PCT_CLAMP.fat[1], fat + excess);
    carbs = 100 - protein - fat;
  }
  return { protein, carbs, fat };
}

/**
 * The default split, from today's gram derivation (protein 1.6 g/kg, fat 30% of
 * budget, carbs the remainder) — or from explicit gram targets when present —
 * expressed as clamped percentages summing to 100.
 */
export function defaultMacroPct(
  budgetKcal: number,
  targetWeightKg: number,
  proteinTargetG?: number,
  fatTargetG?: number,
): MacroPct {
  const pG = proteinTargetG ?? Math.round(PROTEIN_G_PER_KG * targetWeightKg);
  const fG = fatTargetG ?? Math.round((budgetKcal * 0.3) / 9);
  const pK = pG * 4;
  const fK = fG * 9;
  const cK = Math.max(0, budgetKcal - pK - fK);
  const total = pK + fK + cK || 1;
  const protein = Math.round((pK / total) * 100);
  const fat = Math.round((fK / total) * 100);
  return normalizeToClamped(protein, 100 - protein - fat, fat);
}

/**
 * Move `key` to `nextVal` (clamped to its range) and absorb the delta across the
 * other two, in proportion to their current share, each kept within its own
 * clamp. Always returns integers summing to exactly 100 — the larger of the
 * other two absorbs the rounding remainder. Idempotent when nothing changes.
 */
export function rebalanceMacroPct(cur: MacroPct, key: keyof MacroPct, nextVal: number): MacroPct {
  // the larger current value absorbs the rounding remainder ("goes to the larger")
  const rest = (['protein', 'carbs', 'fat'] as const).filter((x) => x !== key).sort((x, y) => cur[x] - cur[y]);
  const a = rest[0]!; // smaller — takes the proportional (rounded) share
  const b = rest[1]!; // larger  — takes whatever's left (exact)
  const [aLo, aHi] = MACRO_PCT_CLAMP[a];
  const [bLo, bHi] = MACRO_PCT_CLAMP[b];
  const kClamp = MACRO_PCT_CLAMP[key];

  // `key` can only move where the other two can still absorb the remainder within
  // THEIR clamps (e.g. carbs can't drop below 10, since protein+fat cap at 90) —
  // so intersect key's own clamp with the feasible band.
  const k = clampInt(nextVal, Math.max(kClamp[0], 100 - (aHi + bHi)), Math.min(kClamp[1], 100 - (aLo + bLo)));
  if (k === cur[key]) return { ...cur };

  const remaining = 100 - k;
  const curSum = cur[a] + cur[b];
  const targetA = curSum > 0 ? (remaining * cur[a]) / curSum : remaining / 2;
  // A's feasible range so that B (= remaining − A) also lands in its clamp. k's
  // feasibility above guarantees aMin ≤ aMax.
  const aMin = Math.max(aLo, remaining - bHi);
  const aMax = Math.min(aHi, remaining - bLo);
  const valA = clampInt(targetA, aMin, aMax);
  const valB = remaining - valA;

  const out: MacroPct = { ...cur };
  out[key] = k;
  out[a] = valA;
  out[b] = valB;
  return out;
}

/** The slider range for the free-movement (MFP-style) macro editor: a uniform
 * 5–65 per macro (the asymmetric MACRO_PCT_CLAMP is kept only for defaultMacroPct
 * normalization, per the design brief). */
export const MACRO_SLIDER = { min: 5, max: 65 } as const;

/**
 * "Balance for me": keep protein and fat as the user set them and give carbs the
 * remainder so the three sum to exactly 100. Overflow (when 100−protein−fat lands
 * outside carbs' 5–65 band) spills into fat, then — only in the pathological case
 * where both sliders are cranked — protein absorbs the last residual. Always
 * returns a valid split summing to 100.
 */
export function balanceMacroPct(pct: MacroPct): MacroPct {
  const { min: LO, max: HI } = MACRO_SLIDER;
  const clampU = (x: number) => Math.max(LO, Math.min(HI, Math.round(x)));
  let protein = clampU(pct.protein);
  let fat = clampU(pct.fat);
  let carbs = 100 - protein - fat;
  if (carbs > HI) { fat = clampU(fat + (carbs - HI)); }      // overflow spills into fat
  else if (carbs < LO) { fat = clampU(fat - (LO - carbs)); } // (rare: both cranked)
  carbs = clampU(100 - protein - fat);
  // reconcile to exactly 100: any residual goes to protein (last resort)
  protein = 100 - carbs - fat;
  if (protein < LO) { protein = LO; fat = 100 - protein - carbs; }
  return { protein, carbs, fat };
}

/** Percentages → gram targets at a given budget (protein/carbs ×4, fat ×9). */
export function pctToGrams(pct: MacroPct, budgetKcal: number): { proteinG: number; carbsG: number; fatG: number } {
  return {
    proteinG: Math.max(1, Math.round(((pct.protein / 100) * budgetKcal) / 4)),
    carbsG: Math.max(1, Math.round(((pct.carbs / 100) * budgetKcal) / 4)),
    fatG: Math.max(1, Math.round(((pct.fat / 100) * budgetKcal) / 9)),
  };
}
