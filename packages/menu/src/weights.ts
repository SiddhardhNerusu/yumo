/**
 * §8 per-user recipe weights — the learning loop. A multiplicative weight per
 * recipe, moved by the user's own signals and decaying back toward neutral (1.0)
 * so stale opinions fade. Generalises the old binary boostIds mechanism: the
 * menu scorer reads these instead of a boost set.
 *
 * Pure + deterministic (every call takes `now`) so it replays in tests. The app
 * maps its event log into WeightSignal[]; the engine never sees BrainEvent.
 */
export type WeightSignalKind = 'swap_away' | 'mixup_pick' | 'accept_log' | 'thumb_up' | 'thumb_down';

export interface WeightSignal {
  recipeId: string;
  kind: WeightSignalKind;
  /** epoch ms. */
  ts: number;
}

/** Per-signal multipliers (§8): explicit thumbs move hardest, plan edits softer. */
export const WEIGHT_MULTIPLIER: Record<WeightSignalKind, number> = {
  swap_away: 0.8,
  mixup_pick: 1.15,
  accept_log: 1.15,
  thumb_up: 1.3,
  thumb_down: 0.5,
};

export const WEIGHT_MIN = 0.1;
export const WEIGHT_MAX = 3.0;
/** decay 2%/week toward 1.0 (§8). */
export const WEIGHT_DECAY_PER_WEEK = 0.98;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const clampWeight = (w: number) => Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w));
/** relax the deviation from neutral by the elapsed weeks (compounding). */
const decayToward1 = (w: number, weeks: number) => 1 + (w - 1) * Math.pow(WEIGHT_DECAY_PER_WEEK, Math.max(0, weeks));

/** Fold a user's signals into a recipeId → weight map (neutral recipes omitted). */
export function recipeWeights(signals: WeightSignal[], now: number): Map<string, number> {
  const byRecipe = new Map<string, WeightSignal[]>();
  for (const s of signals) {
    const list = byRecipe.get(s.recipeId) ?? [];
    list.push(s);
    byRecipe.set(s.recipeId, list);
  }
  const out = new Map<string, number>();
  for (const [id, list] of byRecipe) {
    list.sort((a, b) => a.ts - b.ts);
    let w = 1.0;
    let last = list[0]!.ts;
    for (const s of list) {
      w = decayToward1(w, (s.ts - last) / WEEK_MS); // decay since the previous signal
      w = clampWeight(w * WEIGHT_MULTIPLIER[s.kind]); // then apply this one
      last = s.ts;
    }
    w = decayToward1(w, (now - last) / WEEK_MS); // decay from the last signal to now
    if (Math.abs(w - 1) > 1e-6) out.set(id, w);
  }
  return out;
}
