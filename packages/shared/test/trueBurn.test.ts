import { describe, it, expect } from 'vitest';
import { trueBurn, type DayKcal } from '../src/trueBurn';
import { mifflinStJeorBMR, type BodyStats } from '../src/budget';
import type { DayKg } from '../src/weightWindows';

const TODAY = 20000;
const BODY: BodyStats = { weightKg: 74, heightCm: 178, age: 32, sex: 'male' };
const FORMULA = 2355;

/** logged intake at a flat kcal for the last `n` days ending today. */
function intake(n: number, kcal: number): DayKcal[] {
  return Array.from({ length: n }, (_, i) => ({ day: TODAY - i, kcal }));
}

/**
 * A continuous weigh-in history ending at `kgToday`, one every `everyDays`, where
 * `lossKgPerDay` is the daily loss rate (so the past is heavier: kg(back) =
 * kgToday + lossKgPerDay·back). History runs `historyDays` back so the EWMA is
 * WARMED at the 28-day window edge — the real app always passes full history, so
 * the trend delta over the window is unbiased (both edges carry the same lag).
 */
function history(kgToday: number, lossKgPerDay: number, historyDays = 70, everyDays = 3): DayKg[] {
  const out: DayKg[] = [];
  for (let back = historyDays; back >= 0; back -= everyDays) {
    out.push({ day: TODAY - back, kg: Math.round((kgToday + lossKgPerDay * back) * 10) / 10 });
  }
  return out;
}

describe('trueBurn — learning gates', () => {
  it('learning when fewer than 10 logged days', () => {
    const r = trueBurn({ intake: intake(9, 1846), weighIns: history(74.0, 1.8 / 27), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learning');
    expect(r.burn).toBe(FORMULA);
    expect(r.intakeAvg).toBeNull();
    expect(r.dailyBalance).toBeNull();
  });

  it('learning when fewer than 8 weigh-ins in the window', () => {
    // one weigh-in every 30 days → 0–1 inside the 28-day window
    const r = trueBurn({ intake: intake(20, 1846), weighIns: history(74.0, 1.8 / 27, 120, 30), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learning');
    expect(r.burn).toBe(FORMULA);
    expect(r.loggedDays).toBe(20);
    expect(r.weighInsUsed).toBeLessThan(8);
  });
});

describe('trueBurn — learned energy balance', () => {
  it('measures burn = intake + deficit when the trend falls', () => {
    // ate 1,846/day; trend falling ~1.8 kg / 27 days → deficit ≈ −510 kcal/day → burn ≈ 2,356
    const r = trueBurn({ intake: intake(20, 1846), weighIns: history(74.0, 1.8 / 27), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learned');
    expect(r.intakeAvg).toBe(1846);
    expect(r.dailyBalance).toBeLessThan(0); // a deficit
    expect(r.trendDelta!).toBeGreaterThan(-1.9); // warmed EWMA recovers the bulk of the true ~1.8 kg move
    expect(r.trendDelta!).toBeLessThan(-1.5); //   (not the ~1.0 cold-start artifact)
    expect(r.burn).toBeGreaterThan(2300);
    expect(r.burn).toBeLessThan(2410);
    expect(r.paceKgPerWeek!).toBeCloseTo(-0.47, 1);
  });

  it('blends 0.7×current + 0.3×previous for stability', () => {
    const wi = history(74.0, 1.8 / 27);
    const noBlend = trueBurn({ intake: intake(20, 1846), weighIns: wi, todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    const blended = trueBurn({ intake: intake(20, 1846), weighIns: wi, todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA, previousEstimate: 2200 });
    // blended sits between the previous estimate and the raw estimate, and (0.7 weight) nearer the raw
    expect(blended.burn).toBeGreaterThan(2200);
    expect(blended.burn).toBeLessThan(noBlend.burn);
    expect(noBlend.burn - blended.burn).toBeLessThan(blended.burn - 2200);
    expect(Math.abs(blended.burn - Math.round(0.7 * noBlend.burn + 0.3 * 2200))).toBeLessThanOrEqual(1);
  });

  it('clamps to 2.5× BMR when the raw estimate is implausibly high', () => {
    const hi = Math.round(2.5 * mifflinStJeorBMR(BODY));
    // ate 3,800 while the trend fell 3 kg → raw burn ≫ 2.5× BMR
    const r = trueBurn({ intake: intake(20, 3800), weighIns: history(74.0, 3 / 27), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learned');
    expect(r.clamped).toBe(true);
    expect(r.burn).toBe(hi);
  });

  it('a stable trend with steady intake reads burn ≈ intake', () => {
    const r = trueBurn({ intake: intake(20, 2100), weighIns: history(74.0, 0), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learned');
    expect(r.dailyBalance).toBe(0);
    expect(r.burn).toBe(2100);
  });
});

describe('trueBurn — guardrails', () => {
  it('rejects a window containing a fat-fingered weigh-in (>1.5 kg trend jump)', () => {
    const good = history(74.0, 1.8 / 27);
    // corrupt one in-window weigh-in (day TODAY−13 exists in the every-3-days series) to a gross value
    const bad = good.map((w) => (w.day === TODAY - 13 ? { ...w, kg: w.kg + 30 } : w));
    const r = trueBurn({ intake: intake(20, 1846), weighIns: bad, todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learning'); // window thrown out despite enough data
    expect(r.burn).toBe(FORMULA);
  });

  it('rejects a fat-finger in the EWMA warm-up zone JUST BEFORE the window (leaks into startKg)', () => {
    const good = history(74.0, 1.8 / 27);
    // corrupt a weigh-in a few days before the 28-day window start (T-27) — outside
    // the window interior but inside the EWMA lead-in that feeds startKg.
    const bad = good.map((w) => (w.day === TODAY - 28 ? { ...w, kg: w.kg + 45 } : w));
    const r = trueBurn({ intake: intake(20, 1846), weighIns: bad, todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learning'); // must NOT accept a corrupted startKg as learned
  });

  it('exposes the unblended rawBurn for the next blend anchor', () => {
    const r = trueBurn({ intake: intake(20, 1846), weighIns: history(74.0, 1.8 / 27), todayEpoch: TODAY, body: BODY, formulaTdee: FORMULA });
    expect(r.state).toBe('learned');
    expect(r.rawBurn).not.toBeNull();
    // with no previousEstimate, burn == round(rawBurn) (within the clamp band)
    expect(r.burn).toBe(r.rawBurn);
  });
});
