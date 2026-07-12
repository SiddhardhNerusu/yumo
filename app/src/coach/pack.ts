/**
 * Coach voice (§7.3). Warm, brief, never punitive copy — as versioned template
 * packs with {var} placeholders. The client ships a default pack and swaps in a
 * server-served one (A/B-able, tunable) when available. No LLM at runtime.
 *
 * Values may be a single string or an array of variants. `coach(key, vars, pick)`
 * rotates through variants deterministically by the `pick` seed (e.g. the epoch
 * day), so the line stays stable within a day but changes day-to-day — variety
 * without breaking replay-tests.
 */
export type CoachPack = Record<string, string | string[]>;

export const DEFAULT_COACH: CoachPack = {
  // Time-of-day greeting kicker (§7.1).
  greetMorning: ['Good morning', 'Morning', 'Rise and shine'],
  greetAfternoon: ['Good afternoon', 'Afternoon', 'Midday check-in'],
  greetEvening: ['Good evening', 'Evening', 'Winding down'],
  greetNight: ['Late one', 'Still up', 'Night owl'],

  // Today coach line, by state.
  todayFresh: ['Fresh day — {remaining} kcal to work with.', 'Clean slate. {remaining} kcal for today.', 'New day — {remaining} kcal to play with.'],
  todayOnTrack: ['Nicely on track — {remaining} kcal left.', 'Cruising along — {remaining} kcal to go.', 'Looking good — {remaining} kcal in hand.', 'Steady — {remaining} kcal left for later.'],
  todayNearBudget: ['Almost at your day — about {remaining} kcal left. Easy does it.', 'Nearly there — {remaining} kcal to spare.'],
  todayOver: ["Big day today — tomorrow's a fresh one.", 'Over a touch today — no drama, tomorrow resets.', 'Went over today. Happens — back to it tomorrow.'],

  mealReveal: "Your menu's ready — {needs} most days, never {hates}, around {budget} kcal a day.",
  mealRevealPlain: "Your menu's ready — around {budget} kcal a day, built around what you like.",

  // Nudge surfaces (§7.1). 'nudge' = confident; 'nudgeMenuFramed' = cold-start (§3.8).
  nudge: 'The usual?',
  nudgeMenuFramed: 'Your menu says {meal} — did you have it?',
  coldStart: 'I get sharper every day you log — give me a week.',

  // Learning visibility — the magic moment (§3.9).
  learned: ['Got it — {note} 👍', 'Noticed — {note} 👍', 'Learned it — {note} 👍'],

  mealOff: "No worries — your streak's safe.",
  loggedConfirm: ['Nice one — it’s in your day.', 'Logged — nicely done.', 'In the bag.'],
  weeklyRecap: 'Down {delta} kg over three weeks, steady as you like. Keep going.',

  // ED guardrail signpost (§7.4) — gentle, never punitive.
  signpostTitle: 'A quiet check-in',
  signpostBody: "You've been eating quite light the last few days. If that's on purpose, all good. If it's not, talking to someone can help — no pressure.",
};

let activePack: CoachPack = DEFAULT_COACH;

/** Swap in a server pack (merged over the defaults so missing keys still work). */
export function setCoachPack(p: CoachPack | undefined | null): void {
  if (p && typeof p === 'object' && !Array.isArray(p)) activePack = { ...DEFAULT_COACH, ...p };
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * Resolve a coach line. When the key holds variants, `pick` selects one
 * deterministically (stable input ⇒ stable output); omit `pick` to always take
 * the first variant.
 */
export function coach(key: string, vars: Record<string, string | number> = {}, pick?: number): string {
  const t = activePack[key] ?? DEFAULT_COACH[key] ?? '';
  let tpl: string;
  if (Array.isArray(t)) {
    const n = t.length;
    if (n === 0) tpl = '';
    else if (pick == null) tpl = t[0] ?? '';
    else tpl = t[((Math.trunc(pick) % n) + n) % n] ?? t[0] ?? '';
  } else {
    tpl = t;
  }
  return fill(tpl, vars);
}
