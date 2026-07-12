import type { MealSlot } from '@yumo/shared';
import { SLOT_ENVELOPE, MEAL_SLOTS } from '@yumo/shared';
import type { MenuRecipe, UserProfile, WeekMenuPlan, MenuDay, MenuSlotPick } from './types';
import { isAllowed, containsToken } from './filter';
import { softScore } from './scoring';
import { mulberry32, hashSeed, weightedPick } from './rng';
import {
  PROTEIN_FLOOR_PER_KG,
  DAY_BUDGET_TOLERANCE,
  MAX_HARD_DINNERS_PER_WEEK,
  PORTION_SCALE_RANGE,
} from './config';

const SLOTS = MEAL_SLOTS;
const EFFORT_MIN = PORTION_SCALE_RANGE[0];
const EFFORT_MAX = PORTION_SCALE_RANGE[1];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface GenerateOptions {
  /** stable seed → identical menu (per-user + week). */
  seed?: string;
  days?: number;
  /** recipe ids to up-weight — the user's swap/pick history (§4.3.3). */
  boostIds?: string[];
}

function buildPick(slot: MealSlot, recipe: MenuRecipe, budgetKcal: number, reasons: string[]): MenuSlotPick {
  const target = budgetKcal * SLOT_ENVELOPE[slot];
  const portionScale = clamp(target / Math.max(1, recipe.perServing.kcal), EFFORT_MIN, EFFORT_MAX);
  return {
    slot,
    recipe,
    portionScale,
    kcal: recipe.perServing.kcal * portionScale,
    protein_g: recipe.perServing.protein_g * portionScale,
    reasons,
  };
}

/** After per-slot scaling, nudge all portions by one uniform factor so the day
 * total lands within ±5% of budget (§4.3). */
function repairDayTotal(picks: MenuSlotPick[], budgetKcal: number): void {
  const total = picks.reduce((s, p) => s + p.kcal, 0);
  if (total <= 0) return;
  const factor = budgetKcal / total;
  for (const p of picks) {
    const scale = clamp(p.portionScale * factor, EFFORT_MIN, EFFORT_MAX);
    p.portionScale = scale;
    p.kcal = p.recipe.perServing.kcal * scale;
    p.protein_g = p.recipe.perServing.protein_g * scale;
  }
}

/**
 * Template-based weekly menu generation (§4.3 v1). Hard constraints filter the
 * pool; needs are pinned first; remaining slots are weighted-sampled by soft
 * preference; the day total is repaired to ±5%.
 */
export function generateWeekMenu(
  pool: MenuRecipe[],
  profile: UserProfile,
  opts: GenerateOptions = {},
): WeekMenuPlan {
  const rand = mulberry32(hashSeed(opts.seed ?? 'week-0'));
  const numDays = opts.days ?? 7;
  const boostIds = new Set(opts.boostIds ?? []);
  const warnings: string[] = [];

  const allowed = pool.filter((r) => isAllowed(r, profile));
  if (allowed.length < SLOTS.length) {
    warnings.push('thin candidate pool after allergy/hate filtering');
  }

  const proteinTarget = PROTEIN_FLOOR_PER_KG * profile.targetWeightKg;
  let hardDinners = 0;
  const days: MenuDay[] = [];
  const usedEarlier = new Set<string>(); // recipes used on previous days this week

  for (let d = 0; d < numDays; d++) {
    const picks: Array<MenuSlotPick | null> = SLOTS.map(() => null);
    const usedToday = new Set<string>();
    const recentlyUsed = new Set<string>(usedEarlier);

    const slotIdx = (slot: MealSlot) => SLOTS.indexOf(slot);
    const emptySlots = () => SLOTS.filter((_, i) => picks[i] === null);

    const place = (slot: MealSlot, recipe: MenuRecipe, reasons: string[]) => {
      picks[slotIdx(slot)] = buildPick(slot, recipe, profile.budgetKcal, reasons);
      usedToday.add(recipe.id);
      if (slot === 'dinner' && recipe.effort === '30min+') hardDinners++;
    };

    // 1. Needs pinned 1×/day, in a natural (affinity) slot.
    for (const need of profile.needs) {
      if (picks.some((p) => p && containsToken(p.recipe, need))) continue;
      const open = new Set(emptySlots());
      const cands = allowed.filter(
        (r) =>
          containsToken(r, need) &&
          !usedToday.has(r.id) &&
          r.slotAffinity.some((s) => open.has(s)),
      );
      if (cands.length === 0) {
        warnings.push(`could not place need "${need}" on day ${d + 1}`);
        continue;
      }
      const scored = cands.map((r) => {
        const slot = r.slotAffinity.find((s) => open.has(s)) as MealSlot;
        const target = profile.budgetKcal * SLOT_ENVELOPE[slot];
        const s = softScore(r, slot, profile, { slotTargetKcal: target, recentlyUsed, proteinPaceDeficit: 0.5, boostIds });
        return { r, slot, score: s.score, reasons: [`your must-have: ${need}`, ...s.reasons] };
      });
      const pick = weightedPick(scored, scored.map((x) => x.score), rand);
      if (pick) place(pick.slot, pick.r, pick.reasons);
    }

    // 2. Fill remaining slots by weighted preference.
    for (const slot of SLOTS) {
      if (picks[slotIdx(slot)]) continue;
      const target = profile.budgetKcal * SLOT_ENVELOPE[slot];
      const proteinSoFar = picks.reduce((s, p) => s + (p?.protein_g ?? 0), 0);
      const deficit = clamp((proteinTarget - proteinSoFar) / Math.max(1, proteinTarget), 0, 1);

      let cands = allowed.filter((r) => r.slotAffinity.includes(slot) && !usedToday.has(r.id));
      if (slot === 'dinner' && hardDinners >= MAX_HARD_DINNERS_PER_WEEK) {
        cands = cands.filter((r) => r.effort !== '30min+');
      }
      if (cands.length === 0) {
        cands = allowed.filter((r) => r.slotAffinity.includes(slot)); // relax "not used today"
        if (cands.length === 0) {
          warnings.push(`no ${slot} candidate on day ${d + 1}`);
          continue;
        }
      }
      const scored = cands.map((r) => {
        const s = softScore(r, slot, profile, { slotTargetKcal: target, recentlyUsed, proteinPaceDeficit: deficit, boostIds });
        return { r, score: s.score, reasons: s.reasons };
      });
      const pick = weightedPick(scored, scored.map((x) => x.score), rand);
      if (pick) place(slot, pick.r, pick.reasons);
    }

    const finalPicks = picks.filter((p): p is MenuSlotPick => p !== null);
    repairDayTotal(finalPicks, profile.budgetKcal);

    const totalKcal = finalPicks.reduce((s, p) => s + p.kcal, 0);
    const totalProtein = finalPicks.reduce((s, p) => s + p.protein_g, 0);
    if (Math.abs(totalKcal - profile.budgetKcal) / profile.budgetKcal > DAY_BUDGET_TOLERANCE) {
      warnings.push(`day ${d + 1} total ${Math.round(totalKcal)} kcal outside ±5% of ${profile.budgetKcal}`);
    }

    for (const p of finalPicks) usedEarlier.add(p.recipe.id);
    days.push({ dayOfWeek: d % 7, picks: finalPicks, totalKcal, totalProtein_g: totalProtein });
  }

  return { days, warnings };
}
