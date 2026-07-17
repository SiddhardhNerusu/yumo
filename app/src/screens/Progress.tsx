import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, Easing, Image, Modal } from 'react-native';
import Svg, { Circle, Rect, G } from 'react-native-svg';
import type { UserProfile } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { useTheme } from '../theme';
import { WeightChart } from '../components/WeightChart';
import { Settings } from '../components/Settings';
import { WeightSheet } from '../components/WeightSheet';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { useWeights, persistPhoto, type WeightEntry } from '../data/weightStore';
import { computeStreak, weeklyLogged } from '../data/streak';
import { MEAL_OUT_BASELINE, TYPICAL_MEAL_COST, gbp } from '../data/kitchenMoney';
import { Serif, Kicker, Card, PrimaryButton, TextLink } from '../components/kit';
import { useNow } from '../useNow';
import { track } from '../analytics';
import { haptics } from '../haptics';

const num = { fontVariant: ['tabular-nums' as const] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(epochDay: number): string {
  const d = new Date(epochDay * 86400000);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** Settings cog — a real gear that turns when tapped, then opens the sheet. */
function CogButton({ onOpen }: { onOpen: () => void }) {
  const { c } = useTheme();
  const turn = useRef(new Animated.Value(0)).current;
  const press = () => {
    haptics.tap();
    turn.setValue(0);
    Animated.timing(turn, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setTimeout(onOpen, 230); // the sheet rises while the cog is still turning
  };
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '150deg'] });
  return (
    <Pressable onPress={press} hitSlop={10} accessibilityRole="button" accessibilityLabel="Settings" style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          {Array.from({ length: 8 }).map((_, i) => (
            <G key={i} rotation={i * 45} origin="12, 12">
              <Rect x={10.5} y={1.6} width={3} height={4.6} rx={1.4} fill={c('textSecondary')} />
            </G>
          ))}
          <Circle cx={12} cy={12} r={6.8} fill={c('textSecondary')} />
          <Circle cx={12} cy={12} r={3} fill={c('chipSurface')} />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

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
  const now = useNow();
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [viewer, setViewer] = useState<WeightEntry | null>(null);
  const { entries, logWeight, removePhoto } = useWeights(now);

  // §8 "from your kitchen" recap (money stays on Progress, off Today).
  const kUsedPct = kitchen.usedPct != null ? Math.round(kitchen.usedPct * 100) : null;
  const kSaved = Math.round(kitchen.stats.cooked * Math.max(0, MEAL_OUT_BASELINE - TYPICAL_MEAL_COST));
  const showKitchenRecap = kitchen.stats.cooked > 0 || kitchen.stats.wasted > 0;

  // ── weight, from REAL weigh-ins ─────────────────────────────────────────────
  const kgs = entries.map((e) => e.kg);
  const latest = entries[entries.length - 1] ?? null;
  const first = entries[0] ?? null;
  const change = latest && first ? latest.kg - first.kg : 0;
  const todayEpoch = localParts(now, 0).epochDay;
  const weekAgo = entries.filter((e) => e.day <= todayEpoch - 7).pop();
  const kgThisWeek = latest && weekAgo ? latest.kg - weekAgo.kg : null;
  const spanDays = latest && first ? latest.day - first.day : 0;
  const photos = useMemo(() => entries.filter((e) => e.photoUri).reverse(), [entries]);
  const loggedTodayW = latest?.day === todayEpoch;

  const saveWeight = async (kg: number, photoUri?: string) => {
    const stored = photoUri ? await persistPhoto(photoUri) : undefined;
    logWeight(kg, stored);
    setShowLog(false);
    haptics.success();
    track('weight_logged', { withPhoto: !!stored });
  };

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
            <Kicker>Your journey</Kicker>
            <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Progress</Serif>
          </View>
          <View style={{ marginTop: 6 }}>
            <CogButton onOpen={() => setShowSettings(true)} />
          </View>
        </View>

        {/* ── Card 1 — WEIGHT, the hero ─────────────────────────────────────── */}
        <Card style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Kicker>Weight</Kicker>
            {latest && first && entries.length > 1 ? (
              <View style={{ backgroundColor: change <= 0 ? c('successFaint') : c('surfaceSunken'), borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={[{ color: change <= 0 ? c('success') : c('textSecondary'), fontSize: 13, fontWeight: '700' }, num]}>{change <= 0 ? '▾' : '▴'} {Math.abs(change).toFixed(1)} kg</Text>
              </View>
            ) : null}
          </View>

          {latest ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, marginBottom: entries.length > 1 ? 8 : 2 }}>
                <Text>
                  <Text style={[{ color: c('textPrimary'), fontSize: 38, fontWeight: '800', letterSpacing: -0.8 }, num]}>{latest.kg.toFixed(1)}</Text>
                  <Text style={{ color: c('textMuted'), fontSize: 15 }}> kg</Text>
                </Text>
                <Text style={{ color: c('textMuted'), fontSize: 12, marginBottom: 6 }}>{loggedTodayW ? 'logged today' : dateLabel(latest.day)}</Text>
              </View>
              {entries.length > 1 ? (
                <>
                  <WeightChart data={kgs} />
                  <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>7-day trend · daily weigh-ins ghosted</Text>
                </>
              ) : (
                <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 2 }}>Your trend line starts with the next weigh-in.</Text>
              )}
              <View style={{ marginTop: 14 }}>
                <PrimaryButton label={loggedTodayW ? "Update today's weight" : 'Log weight'} full onPress={() => setShowLog(true)} />
              </View>
            </>
          ) : (
            <>
              <Text style={{ marginTop: 10, marginBottom: 4 }}>
                <Text style={{ color: c('textSecondary'), fontSize: 15, lineHeight: 22 }}>The scale tells the story the ring can't. Weigh in most mornings and Yumo draws the trend that matters — not the daily noise.</Text>
              </Text>
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Log your first weigh-in" full onPress={() => setShowLog(true)} />
              </View>
            </>
          )}

          {/* progress photos — attached to weigh-ins, newest first */}
          {photos.length ? (
            <View style={{ marginTop: 16 }}>
              <Kicker>Progress photos</Kicker>
              <ScrollView horizontal showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
                {photos.map((e) => (
                  <Pressable key={e.day} onPress={() => setViewer(e)} accessibilityRole="imagebutton" accessibilityLabel={`Progress photo, ${dateLabel(e.day)}`}>
                    <Image source={{ uri: e.photoUri! }} style={{ width: 72, height: 96, borderRadius: 12, backgroundColor: c('surfaceSunken') }} />
                    <Text style={[{ color: c('textMuted'), fontSize: 10.5, marginTop: 4, textAlign: 'center' }, num]}>{e.kg.toFixed(1)} kg</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Card>

        {/* ── Card 2 — streak, compact ──────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 17, fontWeight: '800' }, num]}>{streak.current}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> day streak{streak.frozen ? ' · 1 freeze banked' : ''}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {week.logged.map((on, i) => (
                <View key={i} style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: on ? c('accent') : c('surfaceSunken'), borderWidth: on ? 0 : 1, borderColor: c('border') }} />
              ))}
            </View>
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 12.5, marginTop: 10 }}>{loggedCount} of 7 days logged — the habit's what counts.</Text>
        </Card>

        {/* ── Card 3 — weekly recap ─────────────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cardStat(avgKcal.toLocaleString(), 'avg kcal per day')}
            <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
            {cardStat(`${daysOnTarget} of 7`, 'days on target')}
            <View style={{ width: 1, height: 40, backgroundColor: c('divider') }} />
            {cardStat(kgThisWeek != null ? `${kgThisWeek <= 0 ? '−' : '+'}${Math.abs(kgThisWeek).toFixed(1)}` : '—', 'kg this week', kgThisWeek != null && kgThisWeek <= 0)}
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

        {entries.length > 1 && change < 0 ? (
          <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
            <Serif italic size={16} color={c('textSecondary')} style={{ textAlign: 'center', lineHeight: 23 }}>
              Down {Math.abs(change).toFixed(1)} kg in {spanDays} days — steady as you like.
            </Serif>
          </View>
        ) : null}
      </ScrollView>

      <WeightSheet visible={showLog} initialKg={latest?.kg ?? profile.targetWeightKg} onSave={saveWeight} onClose={() => setShowLog(false)} />

      {/* full-screen photo viewer */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          {viewer ? (
            <>
              <Image source={{ uri: viewer.photoUri! }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />
              <View style={{ alignItems: 'center', marginTop: 16, gap: 10 }}>
                <Text style={[{ color: '#F7F2EA', fontSize: 15, fontWeight: '600' }, num]}>{viewer.kg.toFixed(1)} kg · {dateLabel(viewer.day)}</Text>
                <View style={{ flexDirection: 'row', gap: 28 }}>
                  <TextLink label="Remove photo" tone="neutral" onPress={() => { removePhoto(viewer.day); setViewer(null); }} />
                  <TextLink label="Close" onPress={() => setViewer(null)} />
                </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {showSettings ? (
        <Settings profile={profile} onClose={() => setShowSettings(false)} onSave={onUpdateProfile} onReset={onReset} />
      ) : null}
    </View>
  );
}
