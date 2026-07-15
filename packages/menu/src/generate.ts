import type { MealSlot } from '@yumo/shared';
import { SLOT_ENVELOPE, MEAL_SLOTS } from '@yumo/shared';
import type { MenuRecipe, UserProfile, WeekMenuPlan, MenuDay, MenuSlotPick, PantryFit } from './types';
import { isAllowed, containsToken } from './filter';
import { softScore } from './scoring';
import { mulberry32, hashSeed, weightedPick } from './rng';
import {
  PROTEIN_FLOOR_PER_KG,
  PROTEIN_SLOT_SPLIT,
  DAY_BUDGET_TOLERANCE,
  MAX_HARD_DINNERS_PER_WEEK,
  PORTION_SCALE_RANGE,
  CLEAN_PORTION_STEPS,
  SNACK_SCALE_RANGE,
  ENGINE_VERSION,
} from './config';

const SLOTS = MEAL_SLOTS;
const EFFORT_MIN = PORTION_SCALE_RANGE[0];
const EFFORT_MAX = PORTION_SCALE_RANGE[1];
const CLEAN_MIN = CLEAN_PORTION_STEPS[0]!;
const CLEAN_MAX = CLEAN_PORTION_STEPS[CLEAN_PORTION_STEPS.length - 1]!;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** §5.1 the day's protein goal: explicit target, else the 1.6 g/kg floor. */
export function resolveProteinTargetG(profile: UserProfile): number {
  return profile.proteinTargetG ?? Math.round(PROTEIN_FLOOR_PER_KG * profile.targetWeightKg);
}

export interface GenerateOptions {
  /** stable seed → identical menu (per-user + week). */
  seed?: string;
  days?: number;
  /** recipe ids to up-weight — the user's swap/pick history (§4.3.3). */
  boostIds?: string[];
  /** §8 learned per-user recipe weights (recipeWeights output) → re-rank. */
  userWeights?: Map<string, number>;
  /** §7 live kitchen match → re-rank toward ready/near-miss + annotate each pick. */
  pantryFit?: PantryFit;
}

function applyScale(p: MenuSlotPick, scale: number): void {
  p.portionScale = scale;
  p.kcal = p.recipe.perServing.kcal * scale;
  p.protein_g = p.recipe.perServing.protein_g * scale;
}

/** §5.5 scale a recipe to a slot: fit the slot's kcal, but pull the portion UP
 * toward the slot's protein target when the dish is protein-light (closed-form
 * quadratic min of kcal-gap² + 0.5·protein-shortfall², then clamp). */
function buildPick(slot: MealSlot, recipe: MenuRecipe, budgetKcal: number, proteinTargetG: number, reasons: string[]): MenuSlotPick {
  const kcalS = budgetKcal * SLOT_ENVELOPE[slot];
  const protS = proteinTargetG * PROTEIN_SLOT_SPLIT[slot];
  const K = Math.max(1, recipe.perServing.kcal);
  const P = Math.max(0, recipe.perServing.protein_g);
  const sKcal = kcalS / K;
  // if kcal-fit already meets the slot protein, don't stretch further; else pull up.
  const s = P > 0 && sKcal * P < protS ? (K * kcalS + 0.5 * P * protS) / (K * K + 0.5 * P * P) : sKcal;
  const portionScale = clamp(s, EFFORT_MIN, EFFORT_MAX);
  const pick: MenuSlotPick = { slot, recipe, portionScale, kcal: 0, protein_g: 0, reasons };
  applyScale(pick, portionScale);
  return pick;
}

/** §5.6 day repair: first a uniform factor to land kcal within ±5%; then, if the
 * day is short on protein, scale up the most protein-dense meals within bounds,
 * accepting kcal up to the relaxed +7.5% ceiling. Never breaks scale bounds. */
function repairDay(picks: MenuSlotPick[], budgetKcal: number, proteinTargetG: number): void {
  if (!picks.length) return;
  // Distribute the kcal correction across only the meals with headroom in the needed
  // direction, iterating so meals pinned at a clamp don't defeat a single factor.
  for (let iter = 0; iter < 5; iter++) {
    const total = picks.reduce((s, p) => s + p.kcal, 0);
    if (total <= 0) return;
    if (Math.abs(total - budgetKcal) / budgetKcal <= 0.005) break;
    const up = total < budgetKcal;
    const adj = picks.filter((p) => (up ? p.portionScale < EFFORT_MAX - 1e-6 : p.portionScale > EFFORT_MIN + 1e-6));
    if (!adj.length) break;
    const adjKcal = adj.reduce((s, p) => s + p.kcal, 0);
    const fixedKcal = total - adjKcal;
    const factor = (budgetKcal - fixedKcal) / Math.max(1, adjKcal);
    for (const p of adj) applyScale(p, clamp(p.portionScale * factor, EFFORT_MIN, EFFORT_MAX));
  }

  // protein one-sided: only top up when short (§5.3). Chase it WITHIN the ±5% kcal
  // budget (the ±7.5% relaxation is a later last-resort step, after a snack swap).
  let protein = picks.reduce((s, p) => s + p.protein_g, 0);
  if (protein >= proteinTargetG * 0.98) return;
  const kcalCap = budgetKcal * (1 + DAY_BUDGET_TOLERANCE);
  const dense = [...picks].sort((a, b) => b.recipe.perServing.protein_g / Math.max(1, b.recipe.perServing.kcal) - a.recipe.perServing.protein_g / Math.max(1, a.recipe.perServing.kcal));
  for (const p of dense) {
    if (protein >= proteinTargetG) break;
    const othersKcal = picks.reduce((s, q) => s + (q === p ? 0 : q.kcal), 0);
    const maxByKcal = (kcalCap - othersKcal) / Math.max(1, p.recipe.perServing.kcal);
    const newScale = clamp(Math.min(EFFORT_MAX, maxByKcal), p.portionScale, EFFORT_MAX);
    if (newScale > p.portionScale) { applyScale(p, newScale); protein = picks.reduce((s, q) => s + q.protein_g, 0); }
  }
}

const snapClean = (x: number): number =>
  CLEAN_PORTION_STEPS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

/** §5.4 pin cooked meals to clean portions (½ / 1 / 1½ / 2) so the amounts a
 * user reads are honest, then let the snack flex continuously to absorb the
 * day's kcal residual. Mains that snapped down are nudged back up a step when
 * the day is short on protein and the kcal cap allows. */
function quantizePortions(picks: MenuSlotPick[], budgetKcal: number, proteinTargetG: number): void {
  if (!picks.length) return;
  const snack = picks.find((p) => p.slot === 'snack');
  const mains = picks.filter((p) => p !== snack);
  for (const p of mains) applyScale(p, clamp(snapClean(p.portionScale), CLEAN_MIN, CLEAN_MAX));

  const absorb = () => {
    if (!snack) return;
    const mainsKcal = picks.reduce((s, q) => s + (q === snack ? 0 : q.kcal), 0);
    const need = (budgetKcal - mainsKcal) / Math.max(1, snack.recipe.perServing.kcal);
    applyScale(snack, clamp(need, SNACK_SCALE_RANGE[0], SNACK_SCALE_RANGE[1]));
  };
  absorb();

  // When the snack alone can't swallow the residual (it clamped), step the single
  // main that best closes the day's kcal gap by one clean portion, then re-absorb.
  for (let iter = 0; iter < 4; iter++) {
    const total = picks.reduce((s, p) => s + p.kcal, 0);
    const err = total - budgetKcal;
    if (Math.abs(err) / budgetKcal <= DAY_BUDGET_TOLERANCE) break;
    const over = err > 0;
    let best: { p: MenuSlotPick; step: number } | null = null;
    let bestGap = Math.abs(err);
    for (const p of mains) {
      const idx = CLEAN_PORTION_STEPS.indexOf(p.portionScale);
      const j = over ? idx - 1 : idx + 1;
      if (idx < 0 || j < 0 || j >= CLEAN_PORTION_STEPS.length) continue;
      const step = CLEAN_PORTION_STEPS[j]!;
      const gap = Math.abs(err + p.recipe.perServing.kcal * (step - p.portionScale));
      if (gap < bestGap) { bestGap = gap; best = { p, step }; }
    }
    if (!best) break;
    applyScale(best.p, best.step);
    absorb();
  }

  let protein = picks.reduce((s, p) => s + p.protein_g, 0);
  if (protein >= proteinTargetG) return;
  const kcalCap = budgetKcal * (1 + DAY_BUDGET_TOLERANCE);
  const dense = [...mains].sort(
    (a, b) =>
      b.recipe.perServing.protein_g / Math.max(1, b.recipe.perServing.kcal) -
      a.recipe.perServing.protein_g / Math.max(1, a.recipe.perServing.kcal),
  );
  for (const p of dense) {
    if (protein >= proteinTargetG) break;
    const idx = CLEAN_PORTION_STEPS.indexOf(p.portionScale);
    if (idx < 0 || idx >= CLEAN_PORTION_STEPS.length - 1) continue;
    const next = CLEAN_PORTION_STEPS[idx + 1]!;
    const othersKcal = picks.reduce((s, q) => s + (q === p ? 0 : q.kcal), 0);
    if (othersKcal + p.recipe.perServing.kcal * next > kcalCap) continue;
    applyScale(p, next);
    absorb();
    protein = picks.reduce((s, q) => s + q.protein_g, 0);
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

  const proteinTarget = resolveProteinTargetG(profile);
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
      picks[slotIdx(slot)] = buildPick(slot, recipe, profile.budgetKcal, proteinTarget, reasons);
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
        const s = softScore(r, slot, profile, { slotTargetKcal: target, recentlyUsed, proteinPaceDeficit: 0.5, boostIds, userWeights: opts.userWeights, pantryFit: opts.pantryFit });
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
        const s = softScore(r, slot, profile, { slotTargetKcal: target, recentlyUsed, proteinPaceDeficit: deficit, boostIds, userWeights: opts.userWeights, pantryFit: opts.pantryFit });
        return { r, score: s.score, reasons: s.reasons };
      });
      const pick = weightedPick(scored, scored.map((x) => x.score), rand);
      if (pick) place(slot, pick.r, pick.reasons);
    }

    const finalPicks = picks.filter((p): p is MenuSlotPick => p !== null);
    repairDay(finalPicks, profile.budgetKcal, proteinTarget);
    quantizePortions(finalPicks, profile.budgetKcal, proteinTarget); // §5.4 clean portions
    if (opts.pantryFit) {
      for (const p of finalPicks) {
        const { state, missing } = opts.pantryFit(p.recipe); // §7 first-class near-miss
        p.pantryState = state;
        p.missing = missing;
      }
    }

    const totalKcal = finalPicks.reduce((s, p) => s + p.kcal, 0);
    const totalProtein = finalPicks.reduce((s, p) => s + p.protein_g, 0);
    if (Math.abs(totalKcal - profile.budgetKcal) / profile.budgetKcal > DAY_BUDGET_TOLERANCE) {
      warnings.push(`day ${d + 1} total ${Math.round(totalKcal)} kcal outside ±5% of ${profile.budgetKcal}`);
    }
    if (totalProtein < proteinTarget * 0.9) {
      // couldn't reach protein within the kcal budget → catalogue coverage hole (§12).
      warnings.push(`day ${d + 1} protein ${Math.round(totalProtein)}g under target ${proteinTarget}g`);
    }

    for (const p of finalPicks) usedEarlier.add(p.recipe.id);
    days.push({ dayOfWeek: d % 7, picks: finalPicks, totalKcal, totalProtein_g: totalProtein });
  }

  return { days, warnings, engineVersion: ENGINE_VERSION };
}
