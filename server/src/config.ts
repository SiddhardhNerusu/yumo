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

/** §4.4 / decision 4: "Mix it up" is UNLIMITED during beta. Gating later is a
 * config flip (set false), not a code change — the endpoint reads this flag. */
export const MIXUP_UNLIMITED = process.env['MIXUP_UNLIMITED'] !== 'false';

/** §4.2 / decision 5: min live recipes for a cuisine to surface in the picker.
 * Production target is 20; kept lower here while the catalogue is at spike scale
 * so the data-driven picker isn't empty (config-with-defaults — tuned, not hardcoded). */
export const CUISINE_MIN_RECIPES = Number(process.env['CUISINE_MIN_RECIPES'] ?? 3);

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
  nudge: 'The usual?',
  nudgeMenuFramed: 'Your menu says {meal} — did you have it?',
  coldStart: 'I get sharper every day you log — give me a week.',
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
      mixupUnlimited: MIXUP_UNLIMITED,
      cuisineMinRecipes: CUISINE_MIN_RECIPES,
    },
    coach: COACH_PACK,
  };
}
