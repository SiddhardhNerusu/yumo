import { DEFAULT_CONFIG as BRAIN_CONFIG } from '@usual/brain';
import {
  PROTEIN_FLOOR_PER_KG,
  DAY_BUDGET_TOLERANCE,
  NOVELTY_WEIGHT,
  MAX_HARD_DINNERS_PER_WEEK,
  MIXUP,
} from '@usual/menu';

export const BUILD = process.env['BUILD_STRING'] ?? 'dev-2026-07-10-server-scaffold';
export const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-insecure-secret-change-me';
export const IS_PROD = process.env['NODE_ENV'] === 'production';
export const PORT = Number(process.env['PORT'] ?? 8080);

/** Remote config served to clients (§8.1 GET /api/config): Brain weights/caps +
 * menu tunables + build string. All engine defaults, centrally tunable. */
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
  };
}
