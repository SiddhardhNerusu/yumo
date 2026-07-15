import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { UserProfile } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { useTheme } from '../theme';
import { WeightChart } from '../components/WeightChart';
import { Settings } from '../components/Settings';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { computeStreak, weeklyLogged } from '../data/streak';
import { MEAL_OUT_BASELINE, TYPICAL_MEAL_COST, gbp } from '../data/kitchenMoney';
import { Serif, Kicker, Card } from '../components/kit';
import { WEIGHTS } from '../data/progress-seed';

const num = { fontVariant: ['tabular-nums' as const] };

export function Progress({
  profile,
  onReset,
  onUpdateProfile,
}: {
  profile: UserProfile;
  onReset: () => void;
  onUpdateProfile: (p: UserProfile) => void;
}) {
  const { c } = useTheme();
  const { events } = useEventStore();
  const kitchen = useKitchen();
  const [showSettings, setShowSettings] = useState(false);
  const [now] = useState(() => Date.now());

  // §8 "from your kitchen" recap (money stays on Progress, off Today).
  const kUsedPct = kitchen.usedPct != null ? Math.round(kitchen.usedPct * 100) : null;
  const kSaved = Math.round(kitchen.stats.cooked * Math.max(0, MEAL_OUT_BASELINE - TYPICAL_MEAL_COST));
  const showKitchenRecap = kitchen.stats.cooked > 0 || kitchen.stats.wasted > 0;

  const current = WEIGHTS[WEIGHTS.length - 1]!;
  const start = WEIGHTS[0]!;
  const change = current - start; // negative = loss
  const kgThisWeek = current - (WEIGHTS[Math.max(0, WEIGHTS.length - 8)] ?? start);

  const streak = useMemo(() => computeStreak(events, now), [events, now]);
  const week = useMemo(() => weeklyLogged(events, now), [events, now]);
  const loggedCount = week.logged.filter(Boolean).length;

  // §6 weekly recap stats, computed from the event log.
  const { avgKcal, daysOnTarget } = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const e of logEvents(events)) {
      const day = localParts(e.ts, 0).epochDay;
      byDay.set(day, (byDay.get(day) ?? 0) + (e.kcal ?? 0));
    }
    const today = localParts(now, 0).epochDay;
    const last7: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = today - i;
      if (byDay.has(day)) last7.push(byDay.get(day)!);
    }
    const avg = last7.length ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : 0;
    const on = last7.filter((k) => k <= profile.budgetKcal).length;
    return { avgKcal: avg, daysOnTarget: on };
  }, [events, now, profile.budgetKcal]);

  const cardStat = (value: string, label: string, tint?: boolean) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[{ color: tint ? c('success') : c('textPrimary'), fontSize: 20, fontWeight: '800' }, num]}>{value}</Text>
      <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 4, textAlign: 'center' }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kicker>Last 3 weeks</Kicker>
            <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Progress</Serif>
          </View>
          <Pressable onPress={() => setShowSettings(true)} style={{ marginTop: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border') }}>
            <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>Settings</Text>
          </Pressable>
        </View>

        {/* Card 1 — streak + this week */}
        <Card style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 34, fontWeight: '800' }, num]}>{streak.current}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 14 }}> day streak</Text>
            </Text>
            {streak.frozen ? <Text style={{ color: c('textMuted'), fontSize: 13 }}>1 freeze banked</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
            {week.logged.map((on, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: on ? c('accent') : c('surfaceSunken'), borderWidth: on ? 0 : 1, borderColor: c('border'), alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: c('accentText'), fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Text style={{ color: c('textMuted'), fontSize: 11 }}>{week.labels[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 14 }}>{loggedCount} of 7 days logged — the habit's what counts.</Text>
        </Card>

        {/* Card 2 — weight */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Kicker>Weight</Kicker>
            <View style={{ backgroundColor: c('successFaint'), borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
              <Text style={[{ color: c('success'), fontSize: 13, fontWeight: '700' }, num]}>{change <= 0 ? '▾' : '▴'} {Math.abs(change).toFixed(1)} kg</Text>
            </View>
          </View>
          <Text style={{ marginTop: 8, marginBottom: 6 }}>
            <Text style={[{ color: c('textPrimary'), fontSize: 30, fontWeight: '800' }, num]}>{current.toFixed(1)}</Text>
            <Text style={{ color: c('textMuted'), fontSize: 14 }}> kg</Text>
          </Text>
          <WeightChart data={WEIGHTS} />
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>7-day trend · daily weigh-ins ghosted</Text>
        </Card>

        {/* Card 3 — weekly recap */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cardStat(avgKcal.toLocaleString(), 'avg kcal per day')}
            <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
            {cardStat(`${daysOnTarget} of 7`, 'days on target')}
            <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
            {cardStat(`${kgThisWeek <= 0 ? '−' : '+'}${Math.abs(kgThisWeek).toFixed(1)}`, 'kg this week', true)}
          </View>
        </Card>

        {/* §8 from-your-kitchen recap — used-% + money saved */}
        {showKitchenRecap ? (
          <Card>
            <Kicker>From your kitchen</Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              {cardStat(`${kUsedPct ?? 100}%`, 'used of what you stocked', true)}
              <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
              {cardStat(gbp(kSaved), 'saved vs eating out', true)}
              <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
              {cardStat(`${kitchen.stats.cooked}`, 'meals cooked in')}
            </View>
          </Card>
        ) : null}

        <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
          <Serif italic size={16} color={c('textSecondary')} style={{ textAlign: 'center', lineHeight: 23 }}>
            Down {Math.abs(change).toFixed(1)} kg over three weeks — steady as you like.
          </Serif>
        </View>
      </ScrollView>

      {showSettings ? (
        <Settings profile={profile} onClose={() => setShowSettings(false)} onSave={onUpdateProfile} onReset={onReset} />
      ) : null}
    </View>
  );
}
