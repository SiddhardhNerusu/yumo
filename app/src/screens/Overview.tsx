import { useMemo } from 'react';
import { Modal, View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { UserProfile } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { useTheme } from '../theme';
import { useNow } from '../useNow';
import { useToday } from '../useToday';
import { useEventStore } from '../data/eventStore';
import { useWeights } from '../data/weightStore';
import { macroTargets } from '../data/macros';
import { Serif, Kicker, Card } from '../components/kit';

const num = { fontVariant: ['tabular-nums' as const] };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayTotals { kcal: number; p: number; c: number; f: number }

/** eaten totals per local epoch-day, from the soft-delete-aware log. */
function totalsByDay(events: ReturnType<typeof useEventStore>['events']): Map<number, DayTotals> {
  const m = new Map<number, DayTotals>();
  for (const e of logEvents(events)) {
    const day = localParts(e.ts, 0).epochDay;
    const t = m.get(day) ?? { kcal: 0, p: 0, c: 0, f: 0 };
    t.kcal += e.kcal ?? 0;
    t.p += e.proteinG ?? 0;
    t.c += e.carbsG ?? 0;
    t.f += e.fatG ?? 0;
    m.set(day, t);
  }
  return m;
}

/** averages + adherence over a trailing window, counting LOGGED days only —
 * an unlogged day is missing data, not a zero-calorie day. */
function windowStats(byDay: Map<number, DayTotals>, today: number, days: number, budget: number, proteinTarget: number) {
  let logged = 0, kcal = 0, p = 0, c = 0, f = 0, onTarget = 0, proteinHit = 0;
  for (let d = today - days + 1; d <= today; d++) {
    const t = byDay.get(d);
    if (!t || t.kcal <= 0) continue;
    logged++;
    kcal += t.kcal; p += t.p; c += t.c; f += t.f;
    if (t.kcal <= budget) onTarget++;
    if (t.p >= proteinTarget) proteinHit++;
  }
  return {
    logged,
    avgKcal: logged ? Math.round(kcal / logged) : 0,
    avgP: logged ? Math.round(p / logged) : 0,
    avgC: logged ? Math.round(c / logged) : 0,
    avgF: logged ? Math.round(f / logged) : 0,
    onTarget,
    proteinHit,
  };
}

/** last-7-days kcal bars with a budget guide line. Accent throughout — an
 * over-budget day is information, never a red state (ED rule). */
function WeekBars({ byDay, today, budget }: { byDay: Map<number, DayTotals>; today: number; budget: number }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560) - 40 - 36;
  const H = 110;
  const days = Array.from({ length: 7 }, (_, i) => today - 6 + i);
  const maxV = Math.max(budget * 1.15, ...days.map((d) => byDay.get(d)?.kcal ?? 0));
  const bw = Math.min(26, (W - 6 * 8) / 7);
  const gap = (W - bw * 7) / 6;
  const y = (v: number) => H - (v / maxV) * (H - 14);
  const budgetY = y(budget);
  return (
    <View>
      <Svg width={W} height={H + 18}>
        <Line x1={0} y1={budgetY} x2={W} y2={budgetY} stroke={c('textMuted')} strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />
        {days.map((d, i) => {
          const v = byDay.get(d)?.kcal ?? 0;
          const x = i * (bw + gap);
          if (v <= 0) return <Rect key={d} x={x} y={H - 4} width={bw} height={4} rx={2} fill={c('ringTrack')} />;
          return <Rect key={d} x={x} y={y(v)} width={bw} height={H - y(v)} rx={5} fill={c('accent')} opacity={d === today ? 1 : 0.75} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {days.map((d, i) => (
          <Text key={d} style={{ width: bw + (i < 6 ? gap : 0), textAlign: 'left', color: d === today ? c('textSecondary') : c('textMuted'), fontSize: 11, fontWeight: d === today ? '700' : '400' }}>
            {DAY_INITIALS[new Date(d * 86400000).getUTCDay()]}
          </Text>
        ))}
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 11.5, marginTop: 6 }}>dashed line = your {budget.toLocaleString()} kcal budget</Text>
    </View>
  );
}

function Meter({ label, got, want, accent }: { label: string; got: number; want: number; accent?: boolean }) {
  const { c } = useTheme();
  const frac = Math.max(0, Math.min(1, want > 0 ? got / want : 0));
  const toGo = want - got;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
        <Text>
          <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '700' }, num]}>{got}g</Text>
          <Text style={{ color: c('textMuted'), fontSize: 13 }}> of {want}g</Text>
          <Text style={[{ color: toGo <= 0 ? c('success') : c('textMuted'), fontSize: 13 }, num]}>{toGo <= 0 ? '  ✓ done' : `  ·  ${toGo}g to go`}</Text>
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
        <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 999, backgroundColor: accent ? c('accent') : c('textMuted') }} />
      </View>
    </View>
  );
}

/**
 * The Overview page — a full screen you push in from Today and back out of.
 * Three altitudes, per what genuinely helps (MacroFactor's weekly-averages
 * pattern + adherence + weight-vs-intake): TODAY in detail, THIS WEEK as
 * averages + a bar chart, THIS MONTH as consistency + the weight cross-read.
 * Grams and days, never percentages-of-percentages.
 */
export function Overview({ visible, onClose, profile }: { visible: boolean; onClose: () => void; profile: UserProfile }) {
  const { c } = useTheme();
  const { events } = useEventStore();
  const now = useNow();
  const tokens = useMemo(() => [...profile.needs, ...profile.likes], [profile.needs, profile.likes]);
  const state = useToday(events, now, profile.budgetKcal, tokens);
  const { entries: weights } = useWeights(now);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const today = localParts(now, 0).epochDay;
  const byDay = useMemo(() => totalsByDay(events), [events]);

  const week = useMemo(() => windowStats(byDay, today, 7, profile.budgetKcal, targets.proteinG), [byDay, today, profile.budgetKcal, targets.proteinG]);
  const month = useMemo(() => windowStats(byDay, today, 30, profile.budgetKcal, targets.proteinG), [byDay, today, profile.budgetKcal, targets.proteinG]);

  // today's eaten macros from the slot items (matches the Day screen exactly)
  const eaten = useMemo(() => {
    let p = 0, cg = 0, f = 0;
    for (const sl of state.slots) for (const it of sl.items) { p += it.proteinG ?? 0; cg += it.carbsG ?? 0; f += it.fatG ?? 0; }
    return { p: Math.round(p), c: Math.round(cg), f: Math.round(f) };
  }, [state.slots]);
  const left = state.budget - state.eaten;
  const loggedMeals = state.slots.filter((s) => s.items.length > 0);

  // month weight cross-read: change between the oldest and newest entries in-window
  const monthWeights = weights.filter((w) => w.day > today - 30);
  const wFirst = monthWeights[0];
  const wLast = monthWeights[monthWeights.length - 1];
  const wDelta = wFirst && wLast && monthWeights.length > 1 ? wLast.kg - wFirst.kg : null;

  const weekDelta = week.logged ? week.avgKcal - profile.budgetKcal : 0;
  const weekLine = !week.logged ? null
    : weekDelta <= 0
      ? `Averaging ${Math.abs(weekDelta).toLocaleString()} kcal under budget across ${week.logged} logged day${week.logged === 1 ? '' : 's'}.`
      : `Averaging ${weekDelta.toLocaleString()} kcal over budget — Mix it up for lighter picks.`;
  const monthLine = !month.logged ? null
    : wDelta != null
      ? `${month.logged} of 30 days logged · weight ${wDelta <= 0 ? 'down' : 'up'} ${Math.abs(wDelta).toFixed(1)} kg${wDelta <= 0 && month.avgKcal <= profile.budgetKcal ? ' — the maths is working' : ''}.`
      : `${month.logged} of 30 days logged. Add weigh-ins on Progress to see intake and weight side by side.`;

  const statRow = (cols: Array<[string, string, boolean?]>) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {cols.map(([v, label, tint], i) => (
        <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c('divider'), paddingVertical: 2 }}>
          <Text style={[{ color: tint ? c('success') : c('textPrimary'), fontSize: 19, fontWeight: '800' }, num]}>{v}</Text>
          <Text style={{ color: c('textMuted'), fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>{label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 48, gap: 12 }}>
          {/* header — back to Today */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Today" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('accentSoft'), fontSize: 22, fontWeight: '600', marginTop: -2 }}>‹</Text>
              <Text style={{ color: c('accentSoft'), fontSize: 15, fontWeight: '600' }}>Today</Text>
            </Pressable>
          </View>
          <View style={{ marginBottom: 2 }}>
            <Kicker>How you're eating</Kicker>
            <Serif size={34} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Overview</Serif>
          </View>

          {/* ── TODAY ─────────────────────────────────────────────────────── */}
          <Card>
            <Kicker>Today</Kicker>
            <View style={{ marginTop: 12, backgroundColor: c('surfaceSunken'), borderRadius: 14, paddingVertical: 12 }}>
              {statRow([
                [Math.round(state.eaten).toLocaleString(), 'eaten'],
                [Math.abs(Math.round(left)).toLocaleString(), left >= 0 ? 'left' : 'over'],
                [state.budget.toLocaleString(), 'budget'],
              ])}
            </View>
            <View style={{ marginTop: 16, gap: 13 }}>
              <Meter label="Protein" got={eaten.p} want={targets.proteinG} accent />
              <Meter label="Carbs" got={eaten.c} want={targets.carbsG} />
              <Meter label="Fat" got={eaten.f} want={targets.fatG} />
            </View>
            {loggedMeals.length ? (
              <View style={{ marginTop: 18 }}>
                <Kicker>By meal</Kicker>
                <View style={{ marginTop: 4 }}>
                  {loggedMeals.map((m, i) => (
                    <View key={m.slot} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Text style={{ color: c('textPrimary'), fontSize: 14.5, fontWeight: '600' }}>{cap(m.slot)}</Text>
                        <Text>
                          <Text style={[{ color: c('textSecondary'), fontSize: 13.5, fontWeight: '700' }, num]}>{Math.round(m.kcal).toLocaleString()}</Text>
                          <Text style={{ color: c('textMuted'), fontSize: 11.5 }}> kcal</Text>
                        </Text>
                      </View>
                      <Text style={[{ color: c('textMuted'), fontSize: 12, marginTop: 2 }, num]}>
                        {Math.round(m.items.reduce((a, it) => a + (it.proteinG ?? 0), 0))}g protein · {m.items.map((it) => it.name).join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Card>

          {/* ── THIS WEEK ─────────────────────────────────────────────────── */}
          <Card>
            <Kicker>This week</Kicker>
            <View style={{ marginTop: 12 }}>
              <WeekBars byDay={byDay} today={today} budget={profile.budgetKcal} />
            </View>
            {week.logged ? (
              <>
                <View style={{ marginTop: 16, backgroundColor: c('surfaceSunken'), borderRadius: 14, paddingVertical: 12 }}>
                  {statRow([
                    [week.avgKcal.toLocaleString(), 'avg kcal / day'],
                    [`${week.onTarget} of ${week.logged}`, 'days on budget', week.onTarget >= Math.ceil(week.logged * 0.7)],
                    [`${week.proteinHit} of ${week.logged}`, 'protein goal hit', week.proteinHit >= Math.ceil(week.logged * 0.7)],
                  ])}
                </View>
                <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 12 }, num]}>
                  Weekly averages: {week.avgP}g protein · {week.avgC}g carbs · {week.avgF}g fat per day
                </Text>
                {weekLine ? <Text style={{ color: c('textSecondary'), fontSize: 13.5, marginTop: 8, lineHeight: 19 }}>{weekLine}</Text> : null}
              </>
            ) : (
              <Text style={{ color: c('textMuted'), fontSize: 13.5, marginTop: 12 }}>Nothing logged in the last 7 days yet.</Text>
            )}
          </Card>

          {/* ── THIS MONTH ────────────────────────────────────────────────── */}
          <Card>
            <Kicker>This month</Kicker>
            {month.logged ? (
              <>
                <View style={{ marginTop: 12, backgroundColor: c('surfaceSunken'), borderRadius: 14, paddingVertical: 12 }}>
                  {statRow([
                    [`${month.logged} of 30`, 'days logged', month.logged >= 21],
                    [month.avgKcal.toLocaleString(), 'avg kcal / day'],
                    [wDelta != null ? `${wDelta <= 0 ? '−' : '+'}${Math.abs(wDelta).toFixed(1)}` : '—', 'kg change', wDelta != null && wDelta <= 0],
                  ])}
                </View>
                <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 12 }, num]}>
                  Monthly averages: {month.avgP}g protein per day · protein goal hit {month.proteinHit} of {month.logged} days
                </Text>
                {monthLine ? <Text style={{ color: c('textSecondary'), fontSize: 13.5, marginTop: 8, lineHeight: 19 }}>{monthLine}</Text> : null}
              </>
            ) : (
              <Text style={{ color: c('textMuted'), fontSize: 13.5, marginTop: 12 }}>Your first month starts with today's first log.</Text>
            )}
          </Card>

          <Text style={{ color: c('textMuted'), fontSize: 11.5, textAlign: 'center', marginTop: 6, lineHeight: 17 }}>
            Averages count logged days only — a day you didn't log is missing data, not a zero.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
