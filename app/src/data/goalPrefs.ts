import type { UserProfile } from '@yumo/menu';
import type { Sex, ActivityTier, Goal } from '@yumo/shared';

/**
 * Per-user goal inputs that drive the budget engine but are NOT part of the pure
 * `UserProfile` the menu engine consumes. Captured at onboarding (previously
 * discarded after computing the budget number) and editable in Settings, so the
 * budget can be recomputed from a changed goal / rate / activity / body.
 */
export interface GoalPrefs {
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityTier;
  /** kg/week; meaningful when goal !== 'maintain'. */
  rateKgPerWeek: number;
  /** macro split as whole-integer percentages that sum to 100. Absent → derived. */
  macroPct?: { protein: number; carbs: number; fat: number };
  /** true → the manual kcal stepper is the budget source (bypasses the engine). */
  customBudget?: boolean;
  /** goal weight in kg — drives the Weight-card goal line (Overview §5). Absent → no goal line. */
  goalWeightKg?: number;
  /** last accepted True-burn estimate, for the 0.7/0.3 stability blend (Overview §6). */
  trueBurnEstimate?: number;
}

/** The persisted `usual.profile.v1` envelope. `prefs` is optional for backwards
 * compatibility with saves written before this wave. */
export interface ProfileEnvelope {
  profile: UserProfile;
  goal: Goal;
  prefs?: GoalPrefs;
}

/** Rate-of-change presets, shared by onboarding and Settings so a user always
 * sees the rate they picked. Labels double as loss/gain copy (kg/wk is neutral). */
export const RATE_PRESETS: { rate: number; label: string }[] = [
  { rate: 0.25, label: 'Gentle · 0.25 kg/wk' },
  { rate: 0.5, label: 'Steady · 0.5 kg/wk' },
  { rate: 0.75, label: 'Focused · 0.75 kg/wk' },
  { rate: 1.0, label: 'Fast · 1 kg/wk' },
];

/**
 * Tolerant parse of the persisted envelope. Accepts the pre-prefs shape
 * (`{ profile, goal }`) and returns `prefs: undefined` for it; rejects anything
 * without a plausible `profile`. Pure + RN-free (testable in app/test).
 */
export function parseProfileEnvelope(raw: string | null | undefined): ProfileEnvelope | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === 'object' && 'profile' in o) {
      const rec = o as { profile?: unknown; goal?: unknown; prefs?: unknown };
      if (rec.profile && typeof rec.profile === 'object') {
        const goal = (rec.goal === 'lose' || rec.goal === 'gain' || rec.goal === 'maintain') ? rec.goal : 'maintain';
        return {
          profile: rec.profile as UserProfile,
          goal: goal as Goal,
          prefs: (rec.prefs && typeof rec.prefs === 'object') ? (rec.prefs as GoalPrefs) : undefined,
        };
      }
    }
  } catch {
    /* corrupt JSON — treat as no saved profile */
  }
  return null;
}
