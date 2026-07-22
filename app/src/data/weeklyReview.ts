/**
 * Weekly review generation (Overview §3) — the warm headline + exactly three
 * bullets (✓ win / ▲ watch-out / ✦ suggestion) + the 7-row day detail. Pure and
 * RN-free (tested under node): the caller (Overview) aggregates the last 7 days of
 * logs + per-slot totals into the plain input below; this turns them into copy.
 *
 * Rules (brief §3): the win is the best real adherence stat; the watch-out is the
 * weakest area stated NEUTRALLY (never punitive/shaming); the suggestion points at
 * the user's OWN trickiest slot/dish, never generic advice. Every number appears
 * once. Logged days only — an unlogged day is missing data, not a zero.
 */

export type BulletTone = 'win' | 'watch' | 'tip';
export interface ReviewBullet {
  tone: BulletTone;
  text: string;
}

/** One day of the review week (chronological Mon→Sun). */
export interface ReviewDayInput {
  label: string; // 'Mon'
  dow: number; // 0=Sun … 6=Sat
  kcal: number; // 0 when unlogged
  protein: number;
  logged: boolean;
}

/** Per-slot totals across the review week (for the watch-out + suggestion). */
export interface ReviewSlotInput {
  slot: string; // 'lunch'
  label: string; // 'Lunch'
  loggedDays: number;
  avgKcal: number; // mean kcal in this slot over the logged days
  envelopeKcal: number; // this slot's share of the daily budget
  avgProtein: number;
  /** the slot's worst single day, if the caller identified one ('Sunday'). */
  worstDayLabel?: string;
  /** the dish most often logged in this slot ('chicken pasta'), if known. */
  topDish?: string;
}

export interface WeeklyReviewInput {
  days: ReviewDayInput[]; // 7 rows, chronological
  budget: number;
  proteinTarget: number;
  slots: ReviewSlotInput[];
}

export interface ReviewRow {
  label: string;
  kcal: number;
  protein: number;
  logged: boolean;
  over: boolean;
  proteinOk: boolean;
  /** '128 under' | '140 over' | '' when unlogged. */
  deltaText: string;
}

export interface WeeklyReview {
  headline: string;
  bullets: ReviewBullet[];
  rows: ReviewRow[];
  loggedDays: number;
  /** false when there's too little logged to say anything meaningful. */
  hasData: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** ≥ this weekday/weekend protein gap (g) is worth calling out as the watch-out. */
const PROTEIN_GAP_G = 12;
/** ≥ this slot overrun (kcal above its envelope share) makes it "trickiest". */
const SLOT_OVERRUN_KCAL = 120;

function headline(loggedDays: number, onBudgetFrac: number): string {
  if (loggedDays < 2) return 'Just getting started this week.';
  if (onBudgetFrac >= 0.85) return 'A really strong week — you were dialled in.';
  if (onBudgetFrac >= 0.6) return 'A solid, steady week.';
  if (onBudgetFrac >= 0.35) return 'A bit of a mixed week — but you kept showing up.';
  return 'A tougher week — and you still logged it, which is what counts.';
}

function winBullet(input: WeeklyReviewInput, logged: ReviewDayInput[]): ReviewBullet {
  const onBudget = logged.filter((d) => d.kcal <= input.budget);
  const proteinHit = logged.filter((d) => d.protein >= input.proteinTarget);
  const budgetFrac = onBudget.length / logged.length;
  const proteinFrac = proteinHit.length / logged.length;

  if (budgetFrac >= 0.5 && budgetFrac >= proteinFrac) {
    // average the margin over the ON-BUDGET days only, so it always reads "N under"
    // (a whole-week mean could go negative after one blowout — never a win phrasing).
    const avgUnder = Math.round(mean(onBudget.map((d) => input.budget - d.kcal)));
    return { tone: 'win', text: `${onBudget.length} of ${logged.length} days on budget, averaging ${fmt(avgUnder)} kcal under.` };
  }
  if (proteinFrac >= 0.5) {
    return { tone: 'win', text: `Protein held up — you hit ${input.proteinTarget}g on ${proteinHit.length} of ${logged.length} days.` };
  }
  return { tone: 'win', text: `You logged ${logged.length} day${logged.length === 1 ? '' : 's'} this week — showing up is the hard part.` };
}

/** An always-warm affirming bullet, used to backfill to three on a clean week
 * (never a manufactured criticism — the brief forbids punitive framing). */
function affirmBullet(logged: ReviewDayInput[], idx: number): ReviewBullet {
  const opts = [
    'Nothing really slipped — a clean, consistent week.',
    `You logged ${logged.length} day${logged.length === 1 ? '' : 's'} this week — that consistency is the whole game.`,
  ];
  return { tone: 'win', text: opts[idx % opts.length]! };
}

function trickiestSlot(slots: ReviewSlotInput[]): ReviewSlotInput | null {
  const ranked = slots
    .filter((s) => s.loggedDays > 0)
    .map((s) => ({ s, overrun: s.avgKcal - s.envelopeKcal }))
    .sort((a, b) => b.overrun - a.overrun);
  return ranked.length && ranked[0]!.overrun >= SLOT_OVERRUN_KCAL ? ranked[0]!.s : null;
}

/** The watch-out bullet + which slot (if any) it consumed, so the tip can avoid
 * naming the same slot twice. */
function watchBullet(input: WeeklyReviewInput, logged: ReviewDayInput[], tricky: ReviewSlotInput | null): { bullet: ReviewBullet; usedSlot: string | null } | null {
  // 1) weekday vs weekend protein gap
  const weekend = logged.filter((d) => d.dow === 0 || d.dow === 6);
  const weekday = logged.filter((d) => d.dow >= 1 && d.dow <= 5);
  if (weekend.length && weekday.length) {
    const wknd = Math.round(mean(weekend.map((d) => d.protein)));
    const wkdy = Math.round(mean(weekday.map((d) => d.protein)));
    if (wkdy - wknd >= PROTEIN_GAP_G) {
      return { bullet: { tone: 'watch', text: `Protein dipped to ${wknd}g over the weekend — weekdays hit ${wkdy}g.` }, usedSlot: null };
    }
  }
  // 2) a slot that runs over its share
  if (tricky) {
    return { bullet: { tone: 'watch', text: `${tricky.label} ran about ${fmt(tricky.avgKcal - tricky.envelopeKcal)} kcal above its usual share.` }, usedSlot: tricky.slot };
  }
  // 3) days over budget
  const over = logged.filter((d) => d.kcal > input.budget);
  if (over.length) {
    return { bullet: { tone: 'watch', text: `${over.length} day${over.length === 1 ? '' : 's'} went a little over — usually the easiest to smooth out.` }, usedSlot: null };
  }
  return null;
}

function tipBullet(input: WeeklyReviewInput, excludeSlot: string | null): ReviewBullet | null {
  const pool = input.slots.filter((s) => s.slot !== excludeSlot);
  const tricky = trickiestSlot(pool);
  if (tricky) {
    const where = tricky.worstDayLabel ? `${tricky.worstDayLabel} ${tricky.label.toLowerCase()}` : `${tricky.label}`;
    const prep = tricky.topDish ? `a prepped ${tricky.topDish}` : 'a prepped usual';
    return { tone: 'tip', text: `${where} is your trickiest slot — ${prep} there would close the gap.` };
  }
  // lowest-protein slot as a gentle, still-personal nudge
  const withData = pool.filter((s) => s.loggedDays > 0);
  if (withData.length) {
    const low = [...withData].sort((a, b) => a.avgProtein - b.avgProtein)[0]!;
    return { tone: 'tip', text: `${low.label} is your lightest slot for protein — a small swap there adds up over a week.` };
  }
  return null;
}

function row(d: ReviewDayInput, budget: number, proteinTarget: number): ReviewRow {
  const over = d.logged && d.kcal > budget;
  const diff = budget - d.kcal;
  return {
    label: d.label,
    kcal: d.kcal,
    protein: d.protein,
    logged: d.logged,
    over,
    proteinOk: d.protein >= proteinTarget,
    deltaText: !d.logged ? '' : diff >= 0 ? `${fmt(diff)} under` : `${fmt(-diff)} over`,
  };
}

export function weeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const logged = input.days.filter((d) => d.logged);
  const loggedDays = logged.length;
  const rows = input.days.map((d) => row(d, input.budget, input.proteinTarget));

  if (loggedDays < 2) {
    return {
      headline: headline(loggedDays, 0),
      bullets: loggedDays === 1
        ? [{ tone: 'win', text: 'You got a day on the board — keep the streak going.' }]
        : [{ tone: 'tip', text: 'Log a few days and your first weekly review lands here.' }],
      rows,
      loggedDays,
      hasData: false,
    };
  }

  const onBudgetFrac = logged.filter((d) => d.kcal <= input.budget).length / loggedDays;
  const tricky = trickiestSlot(input.slots);
  const watch = watchBullet(input, logged, tricky);
  // Order ✓ win → ▲ watch (or an affirm on a clean week) → ✦ tip, always three.
  const bullets: ReviewBullet[] = [winBullet(input, logged)];
  bullets.push(watch ? watch.bullet : affirmBullet(logged, 0));
  const tip = tipBullet(input, watch?.usedSlot ?? null);
  bullets.push(tip ?? affirmBullet(logged, 1));

  return {
    headline: headline(loggedDays, onBudgetFrac),
    bullets: bullets.slice(0, 3),
    rows,
    loggedDays,
    hasData: true,
  };
}
