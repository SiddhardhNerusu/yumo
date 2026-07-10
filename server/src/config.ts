import { DEFAULT_CONFIG as BRAIN_CONFIG } from '@yumo/brain';
import {
  PROTEIN_FLOOR_PER_KG,
  DAY_BUDGET_TOLERANCE,
  NOVELTY_WEIGHT,
  MAX_HARD_DINNERS_PER_WEEK,
  MIXUP,
} from '@yumo/menu';

export const BUILD = process.env['BUILD_STRING'] ?? 'dev-2026-07-10-server-scaffold';
export const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-insecure-secret-change-me';
export const IS_PROD = process.env['NODE_ENV'] === 'production';
export const PORT = Number(process.env['PORT'] ?? 8080);

/** Coach voice template pack (§7.3) — served & versioned centrally so copy is
 * A/B-tunable without an app release. Warm, brief, never punitive. */
export const COACH_PACK: Record<string, string | string[]> = {
  todayFresh: 'Fresh start — {remaining} kcal to play with today.',
  todayOnTrack: ['Nicely on track — {remaining} kcal left.', 'Looking good — {remaining} kcal to go.'],
  todayOver: "Big day — tomorrow's a clean slate.",
  mealReveal: "Your menu's ready — {needs} most days, never {hates}, ~{budget} kcal a day.",
  mealRevealPlain: "Your menu's ready — ~{budget} kcal a day, built around what you like.",
  learned: 'Got it — {note} 👍',
  mealOff: "All good — your streak's safe.",
  loggedConfirm: "Nice — that's in your day.",
  weeklyRecap: 'Down {delta} kg over three weeks — steady wins.',
};

/** Remote config served to clients (§8.1 GET /api/config): Brain weights/caps +
 * menu tunables + coach voice + build string. All engine defaults, centrally tunable. */
export function remoteConfig() {
  return {
    version: BUILD,
    brain: BRAIN_CONFIG,
    menu: {
      proteinFloorPerKg: PROTEIN_FLOOR_PER_KG,
      dayBudgetTolerance: DAY_BUDGET_TOLERANCE,
      novelty: NOVELTY_WEIGHT,
      maxHardDinnersPerWeek: MAX_HARD_DINNERS_PER_WEEK,
      mixup: MIXUP,
    },
    coach: COACH_PACK,
  };
}
