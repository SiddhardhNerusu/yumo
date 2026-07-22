import { describe, it, expect } from 'vitest';
import { weeklyReview, type WeeklyReviewInput, type ReviewDayInput, type ReviewSlotInput } from '../src/data/weeklyReview';

const DOW = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 } as const;

// A representative week: 6 of 7 on a 2,000 budget, protein strong on weekdays, weak on the weekend.
const WEEK: ReviewDayInput[] = [
  { label: 'Mon', dow: DOW.Mon, kcal: 1890, protein: 102, logged: true },
  { label: 'Tue', dow: DOW.Tue, kcal: 1810, protein: 108, logged: true },
  { label: 'Wed', dow: DOW.Wed, kcal: 1960, protein: 104, logged: true },
  { label: 'Thu', dow: DOW.Thu, kcal: 1850, protein: 101, logged: true },
  { label: 'Fri', dow: DOW.Fri, kcal: 2140, protein: 96, logged: true },
  { label: 'Sat', dow: DOW.Sat, kcal: 1920, protein: 74, logged: true },
  { label: 'Sun', dow: DOW.Sun, kcal: 1780, protein: 68, logged: true },
];

const SLOTS: ReviewSlotInput[] = [
  { slot: 'breakfast', label: 'Breakfast', loggedDays: 7, avgKcal: 480, envelopeKcal: 500, avgProtein: 24 },
  { slot: 'lunch', label: 'Lunch', loggedDays: 7, avgKcal: 820, envelopeKcal: 650, avgProtein: 34, worstDayLabel: 'Sunday', topDish: 'chicken pasta' },
  { slot: 'dinner', label: 'Dinner', loggedDays: 7, avgKcal: 700, envelopeKcal: 650, avgProtein: 38 },
];

const base = (over: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput => ({ days: WEEK, budget: 2000, proteinTarget: 90, slots: SLOTS, ...over });

describe('weeklyReview', () => {
  it('produces a warm headline + exactly 3 bullets (✓ win, ▲ watch, ✦ tip) with data', () => {
    const r = weeklyReview(base());
    expect(r.hasData).toBe(true);
    expect(r.bullets).toHaveLength(3);
    expect(r.bullets.map((b) => b.tone)).toEqual(['win', 'watch', 'tip']);
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it('win = budget adherence when most days land under', () => {
    const r = weeklyReview(base());
    // 6 of 7 ≤ 2000; avg under across all logged = 650/7 ≈ 93
    expect(r.bullets[0]!.text).toBe('6 of 7 days on budget, averaging 93 kcal under.');
  });

  it('watch-out surfaces the weekend protein dip, stated neutrally', () => {
    const r = weeklyReview(base());
    // weekend protein mean(74,68)=71; weekday mean(102,108,104,101,96)=102
    expect(r.bullets[1]!.text).toBe('Protein dipped to 71g over the weekend — weekdays hit 102g.');
  });

  it('suggestion references the user’s own trickiest slot + dish, never generic', () => {
    const r = weeklyReview(base());
    expect(r.bullets[2]!.text).toBe('Sunday lunch is your trickiest slot — a prepped chicken pasta there would close the gap.');
  });

  it('falls back to a protein win when budget adherence is poor but protein is strong', () => {
    const overDays = WEEK.map((d) => ({ ...d, kcal: 2300, protein: 120 }));
    const r = weeklyReview(base({ days: overDays }));
    expect(r.bullets[0]!.tone).toBe('win');
    expect(r.bullets[0]!.text).toContain('Protein held up');
    expect(r.bullets[0]!.text).toContain('7 of 7');
  });

  it('rows carry over/under, protein-ok and blank delta for unlogged days', () => {
    const withGap = [...WEEK];
    withGap[2] = { label: 'Wed', dow: DOW.Wed, kcal: 0, protein: 0, logged: false };
    const r = weeklyReview(base({ days: withGap }));
    const fri = r.rows.find((x) => x.label === 'Fri')!;
    expect(fri.over).toBe(true);
    expect(fri.deltaText).toBe('140 over');
    const mon = r.rows.find((x) => x.label === 'Mon')!;
    expect(mon.deltaText).toBe('110 under');
    expect(mon.proteinOk).toBe(true);
    const sun = r.rows.find((x) => x.label === 'Sun')!;
    expect(sun.proteinOk).toBe(false); // 68 < 90
    const wed = r.rows.find((x) => x.label === 'Wed')!;
    expect(wed.logged).toBe(false);
    expect(wed.deltaText).toBe('');
  });

  it('is graceful with too little data', () => {
    const oneDay = WEEK.map((d, i) => ({ ...d, logged: i === 0 }));
    const r = weeklyReview(base({ days: oneDay }));
    expect(r.hasData).toBe(false);
    expect(r.loggedDays).toBe(1);
    expect(r.bullets.length).toBeGreaterThan(0);
  });
});
