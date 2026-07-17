import type { WeekMenuPlan } from '@yumo/menu';
import type { WeekMenu } from '@yumo/brain';

/**
 * Adapt the menu engine's `WeekMenuPlan` into the Brain's `WeekMenu` so the REAL
 * generated menu feeds `menuPrior` (§3.3) — the term that lets a habit reach a
 * proactive nudge. This replaces the demo-only `SEED_MENU` for real users:
 * without it the only menu the Brain ever saw was four hard-coded demo foods, so
 * a real user's own foods could never earn `menuPrior` and a day-0 user got
 * nudged about food they'd never eaten.
 *
 * `plan.days[i].dayOfWeek === i` always (generate.ts, fixed Sun…Sat), and a
 * pick's `recipe.id` is exactly the `foodId` that gets logged (Day logs
 * `logFood(cur.recipe.id, …)`), so the adapter is a straight field map.
 * `portionG` is intentionally omitted — the plan carries a scaled kcal, not an
 * authored gram weight, and `MenuEntry.portionG` is optional (it only seeds
 * portion learning; the Brain falls back to PORTION_FALLBACK / learned).
 */
export function weekMenuFor(plan: WeekMenuPlan): WeekMenu {
  return plan.days.flatMap((day) =>
    day.picks.map((pick) => ({ dayOfWeek: day.dayOfWeek, slot: pick.slot, foodId: pick.recipe.id })),
  );
}
