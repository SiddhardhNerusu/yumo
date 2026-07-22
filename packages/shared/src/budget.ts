/**
 * Calorie-budget math for the onboarding number reveal (§2.1). Deterministic,
 * server-usable. The ED floor is a non-negotiable guardrail (§7.4).
 */
export type Sex = 'male' | 'female';
export type ActivityTier = 'desk' | 'onfeet' | 'active' | 'veryactive';
export type Goal = 'lose' | 'maintain' | 'gain';

export const ACTIVITY_MULTIPLIER: Record<ActivityTier, number> = {
  desk: 1.2,
  onfeet: 1.375,
  active: 1.55,
  veryactive: 1.725,
};

export const ACTIVITY_LABEL: Record<ActivityTier, string> = {
  desk: 'Mostly at a desk',
  onfeet: 'On my feet a fair bit',
  active: 'Active most days',
  veryactive: 'Training hard / very active',
};

/** Rate of loss, kg/week (§2.1). */
export const RATE_MIN = 0.25;
export const RATE_MAX = 1.0;
export const KCAL_PER_KG = 7700;

/** Never render a target below these (§2.1 / §7.4). */
export const FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

export interface BodyStats {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function mifflinStJeorBMR(b: BodyStats): number {
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  return Math.round(base + (b.sex === 'male' ? 5 : -161));
}

/** Total daily energy expenditure = BMR × activity multiplier. */
export function tdee(b: BodyStats, activity: ActivityTier): number {
  return Math.round(mifflinStJeorBMR(b) * ACTIVITY_MULTIPLIER[activity]);
}

export interface BudgetInput extends BodyStats {
  activity: ActivityTier;
  goal: Goal;
  /** kg/week; ignored for 'maintain'. Clamped to [RATE_MIN, RATE_MAX]. */
  rateKgPerWeek: number;
  /**
   * Measured maintenance (True burn) to use in place of the Mifflin estimate,
   * once it's `learned` (§6). When set, the pace deficit and ED floor still
   * apply on top — only the maintenance base changes. `tdee` in the result then
   * echoes this value so the provenance line can read "≈ {tdee} true burn − {delta}".
   */
  maintenanceOverride?: number;
}

export interface BudgetResult {
  bmr: number;
  tdee: number;
  /** daily kcal added (gain) or removed (lose). */
  dailyDelta: number;
  /** target before the floor is applied. */
  rawTarget: number;
  target: number;
  floor: number;
  /** true when the requested target fell below the floor and was clamped up. */
  floored: boolean;
  /** show the gentle ED signpost (§7.4). */
  edSignpost: boolean;
}

/** The number-reveal calculation (§2.1). */
export function dailyBudget(input: BudgetInput): BudgetResult {
  const bmr = mifflinStJeorBMR(input);
  const maintenance = input.maintenanceOverride != null
    ? Math.round(input.maintenanceOverride)
    : Math.round(bmr * ACTIVITY_MULTIPLIER[input.activity]);
  const rate = input.goal === 'maintain' ? 0 : clamp(input.rateKgPerWeek, RATE_MIN, RATE_MAX);
  const perDay = Math.round((rate * KCAL_PER_KG) / 7);
  const dailyDelta = input.goal === 'lose' ? -perDay : input.goal === 'gain' ? perDay : 0;
  const rawTarget = maintenance + dailyDelta;
  const floor = FLOOR[input.sex];
  const target = Math.max(rawTarget, floor);
  const floored = rawTarget < floor;
  return { bmr, tdee: maintenance, dailyDelta, rawTarget, target, floor, floored, edSignpost: floored };
}
