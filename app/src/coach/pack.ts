/**
 * Coach voice (§7.3). Warm, brief, never punitive copy — as versioned template
 * packs with {var} placeholders. The client ships a default pack and swaps in a
 * server-served one (A/B-able, tunable) when available. No LLM at runtime.
 */
export type CoachPack = Record<string, string | string[]>;

export const DEFAULT_COACH: CoachPack = {
  todayFresh: 'Fresh day — {remaining} kcal to work with.',
  todayOnTrack: ['Nicely on track — {remaining} kcal left.', 'Cruising along — {remaining} kcal to go.'],
  todayOver: "Big day today — tomorrow's a fresh one.",
  mealReveal: "Your menu's ready — {needs} most days, never {hates}, around {budget} kcal a day.",
  mealRevealPlain: "Your menu's ready — around {budget} kcal a day, built around what you like.",
  learned: 'Got it — {note} 👍',
  mealOff: "No worries — your streak's safe.",
  loggedConfirm: 'Nice one — it’s in your day.',
  weeklyRecap: 'Down {delta} kg over three weeks, steady as you like. Keep going.',
};

let activePack: CoachPack = DEFAULT_COACH;

/** Swap in a server pack (merged over the defaults so missing keys still work). */
export function setCoachPack(p: CoachPack | undefined | null): void {
  if (p && typeof p === 'object' && !Array.isArray(p)) activePack = { ...DEFAULT_COACH, ...p };
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function coach(key: string, vars: Record<string, string | number> = {}): string {
  const t = activePack[key] ?? DEFAULT_COACH[key] ?? '';
  const tpl = Array.isArray(t) ? (t[0] ?? '') : t;
  return fill(tpl, vars);
}
