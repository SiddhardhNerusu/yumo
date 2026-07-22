import { useMemo } from 'react';
import type { UserProfile } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { trueBurn, tdee, type TrueBurnResult, type BodyStats, type ActivityTier, type DayKcal } from '@yumo/shared';
import type { GoalPrefs } from './goalPrefs';
import { useEventStore } from './eventStore';
import { useWeights } from './weightStore';

export interface UseTrueBurn {
  result: TrueBurnResult;
  body: BodyStats;
  activity: ActivityTier;
  /** weight used for the estimate (latest weigh-in, else the onboarding weight). */
  currentKg: number;
}

/**
 * The one place True burn is computed (Overview card + Settings budget both read
 * it). Pulls logged intake from the event store and weigh-ins from the weight
 * store, builds the body stats + formula fallback from GoalPrefs, and runs the
 * pure `trueBurn` energy balance. The previous accepted estimate (for the stability
 * blend) rides in prefs.trueBurnEstimate.
 */
export function useTrueBurn(profile: UserProfile, prefs: GoalPrefs | undefined, nowMs: number): UseTrueBurn {
  const { events } = useEventStore();
  const { entries: weighIns } = useWeights(nowMs);
  return useMemo(() => {
    const today = localParts(nowMs, 0).epochDay;
    const byDay = new Map<number, number>();
    for (const e of logEvents(events)) {
      const day = localParts(e.ts, 0).epochDay;
      byDay.set(day, (byDay.get(day) ?? 0) + (e.kcal ?? 0));
    }
    const intake: DayKcal[] = [...byDay.entries()].filter(([, k]) => k > 0).map(([day, kcal]) => ({ day, kcal: Math.round(kcal) }));
    const currentKg = weighIns.length ? weighIns[weighIns.length - 1]!.kg : profile.targetWeightKg;
    const body: BodyStats = { weightKg: currentKg, heightCm: prefs?.heightCm ?? 175, age: prefs?.age ?? 30, sex: prefs?.sex ?? 'male' };
    const activity: ActivityTier = prefs?.activity ?? 'onfeet';
    const formulaTdee = tdee(body, activity);
    const result = trueBurn({ intake, weighIns, todayEpoch: today, body, formulaTdee, previousEstimate: prefs?.trueBurnEstimate ?? null });
    return { result, body, activity, currentKg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, weighIns, nowMs, profile.targetWeightKg, prefs?.heightCm, prefs?.age, prefs?.sex, prefs?.activity, prefs?.trueBurnEstimate]);
}
