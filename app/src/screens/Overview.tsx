import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, View, Text, ScrollView, Pressable, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { UserProfile } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { weightDelta, weightParts, trendSeries, trueBurn, dailyBudget, SLOT_ENVELOPE, type MealSlot, type Goal, type DayKg } from '@yumo/shared';
import { useTheme } from '../theme';
import { useWeightUnit } from '../data/weightUnit';
import { useNow } from '../useNow';
import { useToday } from '../useToday';
import { useEventStore } from '../data/eventStore';
import { useWeights } from '../data/weightStore';
import { macroTargets } from '../data/macros';
import { useTrueBurn } from '../data/useTrueBurn';
import { weeklyReview, type ReviewSlotInput } from '../data/weeklyReview';
import type { GoalPrefs } from '../data/goalPrefs';
import { Serif, Card, withAlpha } from '../components/kit';

const num = { fontVariant: ['tabular-nums' as const] };
const DAY_MS = 86_400_000;
const asDate = (epochDay: number) => new Date(epochDay * DAY_MS);
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const shortDate = (day: number) => `${asDate(day).getUTCDate()} ${MON_SHORT[asDate(day).getUTCMonth()]}`;
const weekdayFull = (day: number) => WEEKDAY_FULL[asDate(day).getUTCDay()]!;

type Range = 'w' | 'm' | 'y';
const CAL_MAX_FLOOR = 2400; // chart ceiling never dips below this; grows for big budgets/days
const CHART_W = 340;

interface DayTotals { kcal: number; protein: number }
type Stat = [value: string, label: string];

/** eaten kcal + protein per local epoch-day, from the soft-delete-aware log. */
function totalsByDay(events: ReturnType<typeof useEventStore>['events']): Map<number, DayTotals> {
  const m = new Map<number, DayTotals>();
  for (const e of logEvents(events)) {
    const day = localParts(e.ts, 0).epochDay;
    const t = m.get(day) ?? { kcal: 0, protein: 0 };
    t.kcal += e.kcal ?? 0;
    t.protein += e.proteinG ?? 0;
    m.set(day, t);
  }
  return m;
}

// ── shared UI atoms ──────────────────────────────────────────────────────────

/** §1 kicker — 11/700/1.3 uppercase textMuted (tighter than kit's Kicker). */
function Kick({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>{children}</Text>;
}

function CardHead({ kicker, right }: { kicker: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Kick>{kicker}</Kick>
      {right}
    </View>
  );
}

/** §4 W/M/Y segmented toggle — surfaceSunken pill, selected accent/accentText. */
function Segmented({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 999, padding: 2 }}>
      {(['w', 'm', 'y'] as Range[]).map((r) => {
        const on = r === value;
        return (
          <Pressable key={r} onPress={() => onChange(r)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: on ? c('accent') : 'transparent' }}>
            <Text style={{ color: on ? c('accentText') : c('textMuted'), fontSize: 12, fontWeight: '700' }}>{r.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** hairline-divided stat strip (3 stats, §4/§5/§6). */
function StatStrip({ stats }: { stats: Stat[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c('divider'), paddingTop: 12 }}>
      {stats.map(([v, l], i) => (
        <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c('divider') }}>
          <Text style={[{ color: c('textPrimary'), fontSize: 18, fontWeight: '800' }, num]}>{v}</Text>
          <Text style={{ color: c('textMuted'), fontSize: 11.5, marginTop: 1, textAlign: 'center' }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** ✦ insight line in an accentFaint rounded box (§4/§5/§6). */
function Insight({ children }: { children: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c('accentFaint'), borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={{ color: c('accentSoft'), fontSize: 12.5, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/** A scrub layer: maps a drag's pageX → a bar/point index (clamped), clears on
 * release. Ported from RangeSlider's View-responder pattern so a wrapping
 * ScrollView can't steal the gesture (onResponderTerminationRequest → false). */
function useScrub() {
  const [sel, setSel] = useState<number | null>(null);
  const geom = useRef({ left: 0, width: 1 });
  const viewRef = useRef<View>(null);
  const nRef = useRef(1);
  const measure = () => viewRef.current?.measureInWindow((x, _y, w) => { geom.current = { left: x, width: w || 1 }; });
  const apply = (pageX: number) => {
    const n = nRef.current;
    const frac = (pageX - geom.current.left) / geom.current.width;
    setSel(Math.max(0, Math.min(n - 1, Math.floor(frac * n))));
  };
  const bind = (count: number) => {
    nRef.current = Math.max(1, count);
    return {
      onLayout: measure,
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e: GestureResponderEvent) => { measure(); apply(e.nativeEvent.pageX); },
      onResponderMove: (e: GestureResponderEvent) => apply(e.nativeEvent.pageX),
      onResponderRelease: () => setSel(null),
      onResponderTerminate: () => setSel(null),
    };
  };
  return { sel, viewRef, bind };
}

// ── Calories dataset ─────────────────────────────────────────────────────────

interface CalBar { label: string; kcal: number | null; today: boolean }
interface CalData { bars: CalBar[]; labels: string[]; boldLast: boolean; gap: number; stats: Stat[]; insight: string; def: string; unlogged: number }

function calorieData(byDay: Map<number, DayTotals>, today: number, range: Range, budget: number, proteinTarget: number, joinDay: number | null): CalData {
  const stripStats = (days: number[]): { stats: Stat[]; avg: number } => {
    let logged = 0, kcal = 0, protein = 0, onBudget = 0;
    for (const d of days) { const t = byDay.get(d); if (!t || t.kcal <= 0) continue; logged++; kcal += t.kcal; protein += t.protein; if (t.kcal <= budget) onBudget++; }
    const avg = logged ? Math.round(kcal / logged) : 0;
    return { avg, stats: [[fmt(avg), 'avg kcal / day'], [`${onBudget} of ${logged}`, 'days on budget'], [`${logged ? Math.round(protein / logged) : 0}g`, 'avg protein']] };
  };
  const insightFor = (avg: number, span: string): string => {
    if (!avg) return 'Log a few days and your patterns land here.';
    const d = budget - avg;
    return d >= 0 ? `✦ Averaging ${fmt(d)} kcal under budget ${span} — steady, sustainable progress.` : `✦ Averaging ${fmt(-d)} kcal over ${span} — small trims will close it.`;
  };

  if (range === 'w') {
    const days = Array.from({ length: 7 }, (_, i) => today - 6 + i);
    const bars: CalBar[] = days.map((d) => ({ label: shortDate(d), kcal: byDay.has(d) ? byDay.get(d)!.kcal : null, today: d === today }));
    const { stats, avg } = stripStats(days);
    return { bars, labels: days.map((d) => DAY_LETTER[asDate(d).getUTCDay()]!), boldLast: true, gap: 8, stats, insight: insightFor(avg, 'this week'), def: 'Drag across the days to inspect', unlogged: bars.filter((b) => b.kcal == null).length };
  }
  if (range === 'm') {
    const days = Array.from({ length: 30 }, (_, i) => today - 29 + i);
    const bars: CalBar[] = days.map((d) => ({ label: shortDate(d), kcal: byDay.has(d) ? byDay.get(d)!.kcal : null, today: d === today }));
    const { stats, avg } = stripStats(days);
    const unlogged = bars.filter((b) => b.kcal == null).length;
    const labels = [0, 7, 14, 21, 29].map((i, idx) => (idx === 4 ? 'Today' : shortDate(days[i]!)));
    return { bars, labels, boldLast: false, gap: 2, stats, insight: insightFor(avg, 'this month'), def: unlogged ? `Drag across the days · ${unlogged} unlogged` : 'Drag across the days to inspect', unlogged };
  }
  // Y — 12 calendar-month averages for the current year
  const year = asDate(today).getUTCFullYear();
  const curMonth = asDate(today).getUTCMonth();
  const monthAgg = Array.from({ length: 12 }, () => ({ kcal: 0, n: 0 }));
  let logged = 0, protein = 0, kcalAll = 0;
  for (const [d, t] of byDay) {
    if (t.kcal <= 0) continue;
    const dt = asDate(d);
    if (dt.getUTCFullYear() !== year) continue;
    const mi = dt.getUTCMonth();
    monthAgg[mi]!.kcal += t.kcal; monthAgg[mi]!.n += 1;
    logged++; protein += t.protein; kcalAll += t.kcal;
  }
  const bars: CalBar[] = monthAgg.map((mo, mi) => ({ label: `${MON_FULL[mi]} avg`, kcal: mo.n ? Math.round(mo.kcal / mo.n) : null, today: mi === curMonth }));
  const avg = logged ? Math.round(kcalAll / logged) : 0;
  const stats: Stat[] = [[fmt(avg), 'avg kcal / day'], [`${logged}`, 'days logged'], [`${logged ? Math.round(protein / logged) : 0}g`, 'avg protein']];
  const joinLabel = joinDay != null ? MON_FULL[asDate(joinDay).getUTCMonth()]! : MON_FULL[curMonth]!;
  return { bars, labels: MON_LETTER, boldLast: false, gap: 6, stats, insight: logged ? `✦ ${logged} days logged this year — consistency is the whole game.` : 'Your yearly view fills in as you log.', def: `Monthly averages since you joined in ${joinLabel}`, unlogged: 0 };
}

// ── Weight dataset ───────────────────────────────────────────────────────────

interface WeightData {
  line: string; area: string; rawDots: { x: number; y: number }[]; trendPts: { x: number; y: number; day: number; kg: number }[];
  goalY: number | null; goalLabel: string | null; delta: string; deltaAligned: boolean; stats: Stat[]; insight: string; startLabel: string; endLabel: string; def: string; hasData: boolean;
}

function weightData(entries: DayKg[], trendAll: DayKg[], range: Range, today: number, goalKg: number | undefined, goal: Goal, unit: ReturnType<typeof useWeightUnit>['unit']): WeightData {
  const empty: WeightData = { line: '', area: '', rawDots: [], trendPts: [], goalY: null, goalLabel: null, delta: '', deltaAligned: false, stats: [], insight: '', startLabel: '', endLabel: '', def: 'Add weigh-ins on Progress to see the trend.', hasData: false };
  const windowDays = range === 'w' ? 7 : range === 'm' ? 30 : 100000;
  const startDay = today - windowDays + 1;
  const trendWin = trendAll.filter((p) => p.day >= startDay && p.day <= today);
  const rawWin = entries.filter((p) => p.day >= startDay && p.day <= today);
  if (trendWin.length < 2) return empty;

  const domainStart = trendWin[0]!.day;
  const domainEnd = trendWin[trendWin.length - 1]!.day;
  const span = Math.max(1, domainEnd - domainStart);
  // goal line only on the Year range, and only for an active lose/gain goal.
  const showGoal = range === 'y' && goalKg != null && goal !== 'maintain';
  const GOAL_PAD = 1.5;
  const vals = [...trendWin.map((p) => p.kg), ...rawWin.map((p) => p.kg)];
  // when showing the goal, extend the domain to enclose it (with headroom) so the
  // dashed line sits at the true goal weight whether it's below or above the data.
  const lo = showGoal ? Math.min(...vals, goalKg! - GOAL_PAD) : Math.min(...vals);
  const hi = showGoal ? Math.max(...vals, goalKg! + GOAL_PAD) : Math.max(...vals);
  const pad = 8, H = 72;
  const X = (day: number) => ((day - domainStart) / span) * CHART_W;
  const Y = (v: number) => (hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2));

  const trendPts = trendWin.map((p) => ({ x: X(p.day), y: Y(p.kg), day: p.day, kg: p.kg }));
  const linePath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${linePath} L${CHART_W},${H} L0,${H} Z`;
  const rawDots = rawWin.map((p) => ({ x: X(p.day), y: Y(p.kg) }));

  const deltaKg = trendWin[trendWin.length - 1]!.kg - trendWin[0]!.kg;
  const dparts = weightDelta(deltaKg, unit);
  const deltaStr = `${deltaKg <= 0 ? '−' : '+'}${dparts.value} ${dparts.suffix}`;
  const aligned = (goal === 'lose' && deltaKg <= 0) || (goal === 'gain' && deltaKg >= 0) || (goal === 'maintain' && Math.abs(deltaKg) < 0.5);
  const paceKgWk = (deltaKg / span) * 7;
  const paceParts = weightDelta(paceKgWk, unit);
  const weighCount = rawWin.length;
  const changeLabel = range === 'w' ? 'this week' : range === 'm' ? 'this month' : 'change';
  const stats: Stat[] = [
    [deltaStr, changeLabel],
    [`${paceParts.value} ${paceParts.suffix}/wk`, range === 'y' ? 'avg pace' : 'pace'],
    [`${weighCount}`, 'weigh-ins'],
  ];

  // insight
  const trendNow = trendWin[trendWin.length - 1]!.kg;
  let insight: string;
  if (range === 'm' && Math.abs(paceKgWk) > 0.02) {
    const weeks = 6;
    const predicted = weightParts(trendNow + paceKgWk * weeks, unit);
    const future = asDate(today + weeks * 7);
    insight = `✦ ${deltaKg <= 0 ? 'Down' : 'Up'} ${dparts.value} ${dparts.suffix} this month — at this pace, about ${predicted.value} ${predicted.suffix} by ${MON_FULL[future.getUTCMonth()]}.`;
  } else if (Math.abs(paceKgWk) > 0.02) {
    insight = `✦ Trending ${deltaKg <= 0 ? 'down' : 'up'} about ${paceParts.value} ${paceParts.suffix} a week.`;
  } else {
    insight = '✦ Holding steady — the trend is flat this window.';
  }

  const startParts = weightParts(trendWin[0]!.kg, unit);
  const startLabel = `${startParts.value} ${startParts.suffix} · ${range === 'y' ? MON_SHORT[asDate(domainStart).getUTCMonth()] : shortDate(domainStart)}`;
  const endParts = weightParts(trendNow, unit);
  const endLabel = `${endParts.value} ${endParts.suffix} · today`;
  // goalKg now sits inside [lo,hi], so Y(goalKg) is on-chart; clamp for float safety.
  const goalY = showGoal ? Math.max(pad, Math.min(H - pad, Y(goalKg!))) : null;
  const goalParts = showGoal ? weightParts(goalKg!, unit) : null;
  const goalLabel = goalParts ? `Goal ${goalParts.value} ${goalParts.suffix}` : null;

  return { line: linePath, area, rawDots, trendPts, goalY, goalLabel, delta: deltaStr, deltaAligned: aligned, stats, insight, startLabel, endLabel, def: 'Trend weight — pale dots are raw weigh-ins', hasData: true };
}

// ── weekly-review per-slot aggregation ───────────────────────────────────────

function weeklySlots(events: ReturnType<typeof useEventStore>['events'], startDay: number, endDay: number, budget: number): ReviewSlotInput[] {
  const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const agg = new Map<MealSlot, { kcalByDay: Map<number, number>; protByDay: Map<number, number> }>();
  for (const s of SLOTS) agg.set(s, { kcalByDay: new Map(), protByDay: new Map() });
  for (const e of logEvents(events)) {
    if (!e.slot) continue;
    const day = localParts(e.ts, 0).epochDay;
    if (day < startDay || day > endDay) continue;
    const a = agg.get(e.slot);
    if (!a) continue;
    a.kcalByDay.set(day, (a.kcalByDay.get(day) ?? 0) + (e.kcal ?? 0));
    a.protByDay.set(day, (a.protByDay.get(day) ?? 0) + (e.proteinG ?? 0));
  }
  const out: ReviewSlotInput[] = [];
  for (const s of SLOTS) {
    const a = agg.get(s)!;
    const days = [...a.kcalByDay.keys()];
    if (!days.length) continue;
    const kcals = [...a.kcalByDay.values()];
    const avgKcal = Math.round(kcals.reduce((x, y) => x + y, 0) / kcals.length);
    const prots = [...a.protByDay.values()];
    const avgProtein = Math.round(prots.reduce((x, y) => x + y, 0) / prots.length);
    let worstDay = days[0]!, worstKcal = -1;
    for (const [d, k] of a.kcalByDay) if (k > worstKcal) { worstKcal = k; worstDay = d; }
    out.push({ slot: s, label: s.charAt(0).toUpperCase() + s.slice(1), loggedDays: days.length, avgKcal, envelopeKcal: Math.round(budget * SLOT_ENVELOPE[s]), avgProtein, worstDayLabel: weekdayFull(worstDay) });
  }
  return out;
}

/**
 * The Overview page — a full screen pushed in from Today. Every number appears
 * once; two charts are scrubbable; each card ends with one ✦ insight. Adds the
 * Weekly review + True burn (adaptive TDEE) intelligence cards.
 */
export function Overview({ visible, onClose, profile, goal, prefs }: { visible: boolean; onClose: () => void; profile: UserProfile; goal: Goal; prefs?: GoalPrefs }) {
  const { c } = useTheme();
  const { unit } = useWeightUnit();
  const { events } = useEventStore();
  const now = useNow();
  const tokens = useMemo(() => [...profile.needs, ...profile.likes], [profile.needs, profile.likes]);
  const state = useToday(events, now, profile.budgetKcal, tokens);
  const { entries: weights } = useWeights(now);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const today = localParts(now, 0).epochDay;
  const byDay = useMemo(() => totalsByDay(events), [events]);
  const trendAll = useMemo(() => trendSeries(weights), [weights]);
  const tb = useTrueBurn(profile, prefs, now);

  const [calRange, setCalRange] = useState<Range>('w');
  const [wRange, setWRange] = useState<Range>('m');
  const cal = useScrub();
  const wt = useScrub();

  const budget = state.budget;
  const left = Math.round(state.budget - state.eaten);
  const eatenMac = useMemo(() => {
    let p = 0, cg = 0, f = 0;
    for (const sl of state.slots) for (const it of sl.items) { p += it.proteinG ?? 0; cg += it.carbsG ?? 0; f += it.fatG ?? 0; }
    return { p: Math.round(p), c: Math.round(cg), f: Math.round(f) };
  }, [state.slots]);

  const joinDay = useMemo(() => { let min: number | null = null; for (const [d, t] of byDay) if (t.kcal > 0 && (min == null || d < min)) min = d; return min; }, [byDay]);
  const calData = useMemo(() => calorieData(byDay, today, calRange, budget, targets.proteinG, joinDay), [byDay, today, calRange, budget, targets.proteinG, joinDay]);
  const wData = useMemo(() => weightData(weights, trendAll, wRange, today, prefs?.goalWeightKg, goal, unit), [weights, trendAll, wRange, today, prefs?.goalWeightKg, goal, unit]);

  // Weekly review (last 7 days)
  const review = useMemo(() => {
    const start = today - 6;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = start + i; const t = byDay.get(d); const dow = asDate(d).getUTCDay();
      return { label: WEEKDAY_SHORT[dow]!, dow, kcal: t?.kcal ?? 0, protein: Math.round(t?.protein ?? 0), logged: !!t && t.kcal > 0 };
    });
    return weeklyReview({ days, budget, proteinTarget: targets.proteinG, slots: weeklySlots(events, start, today, budget) });
  }, [byDay, events, today, budget, targets.proteinG]);
  const [weekOpen, setWeekOpen] = useState(false);

  const [burnInfo, setBurnInfo] = useState(false);
  const burn = tb.result;
  const learned = burn.state === 'learned';

  // weekly retune drift: what the measured burn implies for the budget vs the current one
  const retune = useMemo(() => {
    if (!learned || prefs?.customBudget) return null;
    const implied = dailyBudget({ ...tb.body, activity: tb.activity, goal, rateKgPerWeek: prefs?.rateKgPerWeek ?? 0.5, maintenanceOverride: burn.burn }).target;
    const drift = implied - profile.budgetKcal;
    return Math.abs(drift) >= 50 ? { implied, drift } : null;
  }, [learned, prefs?.customBudget, prefs?.rateKgPerWeek, tb.body, tb.activity, goal, burn.burn, profile.budgetKcal]);

  const burnSpark = useMemo(() => buildBurnSpark(tb, weights, byDay, today), [tb, weights, byDay, today]);

  const calSel = cal.sel != null ? calData.bars[cal.sel] ?? null : null;
  const calCaption = calSel
    ? calSel.kcal == null ? `${calSel.label} · not logged`
      : `${calSel.label} · ${fmt(calSel.kcal)} kcal${calSel.today ? ' so far' : calSel.kcal > budget ? ` · ${fmt(calSel.kcal - budget)} over` : ` · ${fmt(budget - calSel.kcal)} under`}`
    : calData.def;
  const wSelPt = wt.sel != null ? wData.trendPts[wt.sel] ?? null : null;
  const wCaption = wSelPt ? `${weightParts(wSelPt.kg, unit).value} ${weightParts(wSelPt.kg, unit).suffix} trend · ${shortDate(wSelPt.day)}` : wData.def;
  const wDot = wSelPt ?? wData.trendPts[wData.trendPts.length - 1] ?? null;

  // chart ceiling grows with the budget and the tallest logged day so neither the
  // bars nor the budget line ever overflow the fixed-height chart.
  const calMax = Math.max(CAL_MAX_FLOOR, Math.round(budget * 1.1), ...calData.bars.map((b) => b.kcal ?? 0));
  const budgetTop = (1 - budget / calMax) * 120;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 58, paddingBottom: 32, gap: 10 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 4 }}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Today" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600', marginTop: -2 }}>‹</Text>
              <Text style={{ color: c('accentSoft'), fontSize: 14, fontWeight: '600' }}>Today</Text>
            </Pressable>
            <View style={{ marginTop: 10 }}><Kick>How you're eating</Kick></View>
            <Serif size={30} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Overview</Serif>
          </View>

          {/* ── TODAY ─────────────────────────────────────────────── */}
          <Card style={{ gap: 14, padding: 16 }}>
            <CardHead kicker="Today" right={<Text style={[{ color: c('textMuted'), fontSize: 12 }, num]}>{`${WEEKDAY_SHORT[asDate(today).getUTCDay()]} ${asDate(today).getUTCDate()} ${MON_SHORT[asDate(today).getUTCMonth()]}`}</Text>} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Serif size={34} weight="medium" color={c('textPrimary')} style={[{ letterSpacing: -0.5 }, num]}>{fmt(Math.abs(left))}</Serif>
              <Text style={{ color: c('textSecondary'), fontSize: 14 }}>{left >= 0 ? 'kcal left' : 'kcal over'}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[{ color: c('textMuted'), fontSize: 13 }, num]}>{fmt(state.eaten)} eaten · {fmt(budget)} budget</Text>
            </View>
            <View style={{ height: 6, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
              <ProgressPill frac={budget > 0 ? Math.min(1, state.eaten / budget) : 0} />
            </View>
            <View style={{ gap: 10 }}>
              <MacroRow label="Protein" now={eatenMac.p} goal={targets.proteinG} color={c('accent')} />
              <MacroRow label="Carbs" now={eatenMac.c} goal={targets.carbsG} color={withAlpha(c('accent'), 0.55)} />
              <MacroRow label="Fat" now={eatenMac.f} goal={targets.fatG} color={withAlpha(c('accent'), 0.28)} />
            </View>
          </Card>

          {/* ── WEEKLY REVIEW ─────────────────────────────────────── */}
          <Card style={{ gap: 12, padding: 16 }}>
            <CardHead kicker="Weekly review" right={<Text style={{ color: c('textMuted'), fontSize: 12 }}>{shortDate(today - 6)} · last 7 days</Text>} />
            <Serif size={22} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.3, lineHeight: 27 }}>{review.headline}</Serif>
            <View style={{ gap: 10 }}>
              {review.bullets.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Text style={{ width: 16, fontSize: 13, color: b.tone === 'win' ? c('success') : b.tone === 'watch' ? c('warning') : c('accentSoft') }}>{b.tone === 'win' ? '✓' : b.tone === 'watch' ? '▲' : '✦'}</Text>
                  <Text style={{ flex: 1, color: c('textLogged'), fontSize: 13.5, lineHeight: 19 }}>{b.text}</Text>
                </View>
              ))}
              {retune ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Text style={{ width: 16, fontSize: 13, color: c('accentSoft') }}>↻</Text>
                  <Text style={{ flex: 1, color: c('textLogged'), fontSize: 13.5, lineHeight: 19 }}>Your true burn now points to a budget of {fmt(retune.implied)} — {retune.drift < 0 ? 'down' : 'up'} ~{fmt(Math.abs(retune.drift))}. Update it in Settings when you're ready.</Text>
                </View>
              ) : null}
            </View>
            {weekOpen ? (
              <View style={{ borderTopWidth: 1, borderTopColor: c('divider'), paddingTop: 4 }}>
                {review.rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c('divider') }}>
                    <Text style={{ width: 40, color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{r.label}</Text>
                    <View style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
                      <View style={{ height: '100%', borderRadius: 999, width: `${r.logged ? Math.min(100, (r.kcal / budget) * 100) : 0}%`, backgroundColor: r.over ? withAlpha(c('warning'), 0.75) : c('accent') }} />
                    </View>
                    <Text style={[{ width: 76, textAlign: 'right', fontSize: 12, fontWeight: '600', color: r.over ? c('warning') : c('textMuted') }, num]}>{r.deltaText || '—'}</Text>
                    <Text style={[{ width: 34, textAlign: 'right', fontSize: 12, color: r.logged ? (r.proteinOk ? c('success') : c('warning')) : c('textMuted') }, num]}>{r.logged ? `${r.protein}g` : '—'}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 7 }}>
                  <Text style={{ color: c('textMuted'), fontSize: 10.5 }}>kcal vs budget</Text>
                  <Text style={{ color: c('textMuted'), fontSize: 10.5 }}>· protein</Text>
                </View>
              </View>
            ) : null}
            {review.hasData ? (
              <Pressable onPress={() => setWeekOpen((o) => !o)} accessibilityRole="button">
                <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600' }}>{weekOpen ? 'Hide the full week' : 'See the full week ›'}</Text>
              </Pressable>
            ) : null}
          </Card>

          {/* ── CALORIES ──────────────────────────────────────────── */}
          <Card style={{ gap: 12, padding: 16 }}>
            <CardHead kicker="Calories" right={<Segmented value={calRange} onChange={(r) => { setCalRange(r); }} />} />
            <Text style={[{ color: c('textSecondary'), fontSize: 12.5, minHeight: 16 }, num]}>{calCaption}</Text>
            <View>
              <View ref={cal.viewRef} {...cal.bind(calData.bars.length)} style={{ height: 120 }}>
                {/* budget dashed line + label */}
                <Svg width="100%" height={120} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                  <Line x1={0} y1={budgetTop} x2={CHART_W} y2={budgetTop} stroke={withAlpha(c('textPrimary'), 0.25)} strokeWidth={1} strokeDasharray="3 4" />
                </Svg>
                <Text style={[{ position: 'absolute', right: 0, top: Math.max(0, budgetTop - 15), color: c('textMuted'), fontSize: 10.5, backgroundColor: c('surface'), paddingLeft: 6 }, num]}>{fmt(budget)}</Text>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: calData.gap }}>
                  {calData.bars.map((b, i) => (
                    <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                      <CalBarView bar={b} selected={cal.sel === i} many={calData.bars.length > 15} budget={budget} calMax={calMax} />
                    </View>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                {calData.labels.map((t, i) => (
                  <Text key={i} style={{ color: calData.boldLast && i === calData.labels.length - 1 ? c('textPrimary') : c('textMuted'), fontSize: 11, fontWeight: calData.boldLast && i === calData.labels.length - 1 ? '700' : '600' }}>{t}</Text>
                ))}
              </View>
            </View>
            <StatStrip stats={calData.stats} />
            <Insight>{calData.insight}</Insight>
          </Card>

          {/* ── WEIGHT ────────────────────────────────────────────── */}
          <Card style={{ gap: 12, padding: 16 }}>
            <CardHead kicker="Weight" right={<Segmented value={wRange} onChange={(r) => { setWRange(r); }} />} />
            {wData.hasData ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text style={[{ color: c('textSecondary'), fontSize: 12.5 }, num]}>{wCaption}</Text>
                  <Text style={[{ color: wData.deltaAligned ? c('success') : c('textSecondary'), fontSize: 13, fontWeight: '700' }, num]}>{wData.delta}</Text>
                </View>
                <View>
                  <View ref={wt.viewRef} {...wt.bind(wData.trendPts.length)}>
                    <Svg width="100%" height={72} viewBox={`0 0 ${CHART_W} 72`} preserveAspectRatio="none">
                      <Path d={wData.area} fill={withAlpha(c('accent'), 0.1)} />
                      {wData.goalY != null ? <Line x1={0} y1={wData.goalY} x2={CHART_W} y2={wData.goalY} stroke={withAlpha(c('success'), 0.5)} strokeWidth={1} strokeDasharray="4 4" /> : null}
                      {wData.rawDots.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={1.7} fill={withAlpha(c('textPrimary'), 0.28)} />)}
                      <Path d={wData.line} fill="none" stroke={c('accent')} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      {wt.sel != null && wDot ? <Line x1={wDot.x} y1={0} x2={wDot.x} y2={72} stroke={withAlpha(c('accentSoft'), 0.4)} strokeWidth={1} strokeDasharray="3 3" /> : null}
                      {wDot ? <Circle cx={wDot.x} cy={wDot.y} r={3.5} fill={c('accent')} stroke={c('surface')} strokeWidth={2} /> : null}
                    </Svg>
                    {wData.goalLabel != null && wData.goalY != null ? (
                      <Text pointerEvents="none" style={{ position: 'absolute', right: 2, top: Math.max(0, wData.goalY - 11), color: c('success'), fontSize: 9, fontWeight: '600' }}>{wData.goalLabel}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={[{ color: c('textMuted'), fontSize: 11 }, num]}>{wData.startLabel}</Text>
                    <Text style={[{ color: c('textMuted'), fontSize: 11 }, num]}>{wData.endLabel}</Text>
                  </View>
                </View>
                <StatStrip stats={wData.stats} />
                <Insight>{wData.insight}</Insight>
              </>
            ) : (
              <Text style={{ color: c('textMuted'), fontSize: 13.5, paddingVertical: 8 }}>Add a couple of weigh-ins on Progress and your trend line appears here.</Text>
            )}
          </Card>

          {/* ── TRUE BURN ─────────────────────────────────────────── */}
          <Card style={{ gap: 12, padding: 16 }}>
            <CardHead kicker="True burn" right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: c('accentFaint'), borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
                  <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700' }}>{learned ? 'Learned' : 'Still learning'}</Text>
                </View>
                <Pressable onPress={() => setBurnInfo((o) => !o)} accessibilityRole="button" accessibilityLabel="How true burn works" style={{ width: 20, height: 20, borderRadius: 999, borderWidth: 1, borderColor: withAlpha(c('textPrimary'), 0.18), alignItems: 'center', justifyContent: 'center', backgroundColor: burnInfo ? c('accentSoft') : 'transparent' }}>
                  <Text style={{ color: burnInfo ? c('accentText') : c('textMuted'), fontSize: 11, fontWeight: '700', fontStyle: 'italic' }}>i</Text>
                </Pressable>
              </View>
            } />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Serif size={34} weight="medium" color={c('textPrimary')} style={[{ letterSpacing: -0.5 }, num]}>≈ {fmt(burn.burn)}</Serif>
              <Text style={{ color: c('textSecondary'), fontSize: 14 }}>kcal burned / day</Text>
            </View>
            <Text style={[{ color: c('textMuted'), fontSize: 12.5, lineHeight: 17 }, num]}>
              {learned
                ? `Worked out from what you actually ate vs how your weight moved — not a formula. The formula guessed ${fmt(burn.formulaTdee)}.`
                : `Still learning your real burn — showing the standard estimate for now. ${burn.loggedDays}/10 logged days · ${burn.weighInsUsed}/8 weigh-ins.`}
            </Text>
            {burnInfo ? (
              <View style={{ backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
                <Text style={{ color: c('textPrimary'), fontSize: 13, fontWeight: '700' }}>How we work this out</Text>
                <Text style={{ color: c('textSecondary'), fontSize: 12.5, lineHeight: 18 }}>Think of your body as a bank account. We know what went in — the food you logged. And the scale tells us what happened to the balance — your weight trend.</Text>
                {learned && burn.intakeAvg != null && burn.paceKgPerWeek != null ? (() => {
                  const surplus = (burn.dailyBalance ?? 0) > 0;
                  const pace = weightDelta(burn.paceKgPerWeek, unit);
                  return (
                    <Text style={[{ color: c('textSecondary'), fontSize: 12.5, lineHeight: 18 }, num]}>If you ate {fmt(burn.intakeAvg)} kcal a day and {surplus ? 'still gained' : 'still lost'} about {pace.value} {pace.suffix} a week, you must have burned {surplus ? 'less' : 'more'} than you ate — about {fmt(Math.abs(burn.dailyBalance ?? 0))} kcal a day {surplus ? 'less' : 'more'}. {surplus ? 'Subtract that' : 'Add those together'} and that's your true burn: <Text style={{ color: c('textPrimary'), fontWeight: '700' }}>≈ {fmt(burn.burn)} kcal</Text>.</Text>
                  );
                })() : null}
                <Text style={{ color: c('textSecondary'), fontSize: 12.5, lineHeight: 18 }}>No formula can know your body this well — this is measured from your own numbers, and it quietly retunes your budget as your body changes.</Text>
                <Text style={{ color: c('textMuted'), fontSize: 11.5, lineHeight: 16 }}>It needs about 2 weeks of steady logging and weigh-ins to beat the formula — until then we show the standard estimate.</Text>
              </View>
            ) : null}
            {burnSpark ? (
              <View>
                <Svg width="100%" height={44} viewBox={`0 0 ${CHART_W} 44`} preserveAspectRatio="none">
                  <Path d={burnSpark.line} fill="none" stroke={withAlpha(c('accent'), 0.55)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={burnSpark.endX} cy={burnSpark.endY} r={3} fill={c('accent')} stroke={c('surface')} strokeWidth={2} />
                </Svg>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={[{ color: c('textMuted'), fontSize: 11 }, num]}>{burnSpark.startLabel}</Text>
                  <Text style={[{ color: c('textMuted'), fontSize: 11 }, num]}>{fmt(burn.burn)} · now</Text>
                </View>
              </View>
            ) : null}
            {learned ? (
              <StatStrip stats={[
                [`${(burn.dailyBalance ?? 0) <= 0 ? '−' : '+'}${fmt(Math.abs(burn.dailyBalance ?? 0))}`, (burn.dailyBalance ?? 0) > 0 ? 'avg daily surplus' : 'avg daily deficit'],
                [`${weightDelta(burn.paceKgPerWeek ?? 0, unit).value} ${weightDelta(burn.paceKgPerWeek ?? 0, unit).suffix}/wk`, 'measured pace'],
                [`${burn.weighInsUsed}`, 'weigh-ins used'],
              ]} />
            ) : null}
            <Insight>{learned ? '✦ Your budget stays honest — if your burn drifts, we retune it each week.' : '✦ Keep logging and weighing in — in about two weeks this becomes your real, measured burn.'}</Insight>
          </Card>

          <Text style={{ color: c('textMuted'), fontSize: 11.5, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20, paddingTop: 4 }}>
            Averages count logged days only — an unlogged day is missing data, not a zero.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── small render helpers ─────────────────────────────────────────────────────

function ProgressPill({ frac }: { frac: number }) {
  const { c } = useTheme();
  const w = Math.max(0, Math.min(1, frac)) * 100;
  // §2 accent→accentSoft gradient fill across the eaten portion.
  return (
    <Svg width="100%" height={6}>
      <Defs>
        <LinearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c('accent')} />
          <Stop offset="1" stopColor={c('accentSoft')} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={`${w}%`} height={6} rx={3} fill="url(#pillGrad)" />
    </Svg>
  );
}

function MacroRow({ label, now: nowG, goal, color }: { label: string; now: number; goal: number; color: string }) {
  const { c } = useTheme();
  const frac = goal > 0 ? Math.max(0, Math.min(1, nowG / goal)) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ width: 52, color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${frac * 100}%`, backgroundColor: color, borderRadius: 999 }} />
      </View>
      <Text style={[{ width: 76, textAlign: 'right', color: c('textMuted'), fontSize: 12.5 }, num]}>
        <Text style={{ color: c('textPrimary'), fontWeight: '700' }}>{nowG}</Text> / {goal}g
      </Text>
    </View>
  );
}

function CalBarView({ bar, selected, many, budget, calMax }: { bar: CalBar; selected: boolean; many: boolean; budget: number; calMax: number }) {
  const { c } = useTheme();
  const unlogged = bar.kcal == null;
  const pct = unlogged ? 4 : Math.max(4, Math.min(100, (bar.kcal! / calMax) * 100));
  const color = unlogged ? withAlpha(c('textPrimary'), 0.12)
    : selected ? c('accentSoft')
      : bar.today ? withAlpha(c('accent'), 0.35)
        : bar.kcal! > budget ? withAlpha(c('warning'), 0.75) : c('accent');
  const rTop = many ? 3 : 6, rBot = many ? 2 : 3;
  return (
    <View style={{ height: `${pct}%`, borderTopLeftRadius: rTop, borderTopRightRadius: rTop, borderBottomLeftRadius: rBot, borderBottomRightRadius: rBot, backgroundColor: color, borderWidth: bar.today && !unlogged ? 1 : 0, borderColor: withAlpha(c('accentSoft'), 0.6), borderStyle: 'dashed' }} />
  );
}

// ── True-burn expenditure sparkline: burn at ~6 past points ──────────────────

interface BurnSpark { line: string; endX: number; endY: number; startLabel: string }

function buildBurnSpark(tb: ReturnType<typeof useTrueBurn>, weights: DayKg[], byDay: Map<number, DayTotals>, today: number): BurnSpark | null {
  // sample the measured/estimate burn at 6 points across recent history (each
  // reuses the same pure trueBurn, evaluated as if "today" were that past day).
  const POINTS = 6, STEP = 28;
  const intakeAll: { day: number; kcal: number }[] = [];
  for (const [day, t] of byDay) if (t.kcal > 0) intakeAll.push({ day, kcal: Math.round(t.kcal) });
  // keep only points where the burn was actually MEASURED (learned) — learning
  // points would flat-line at today's formula and mislabel the start month.
  const pts: { val: number; day: number }[] = [];
  for (let k = POINTS - 1; k >= 0; k--) {
    const dayK = today - k * STEP;
    const r = trueBurn({ intake: intakeAll.filter((d) => d.day <= dayK), weighIns: weights.filter((w) => w.day <= dayK), todayEpoch: dayK, body: tb.body, formulaTdee: tb.result.formulaTdee, previousEstimate: null });
    if (r.state === 'learned') pts.push({ val: r.burn, day: dayK });
  }
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.val);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const H = 44, pad = 6;
  const X = (i: number) => (i / (vals.length - 1)) * CHART_W;
  const Y = (v: number) => (hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2));
  const line = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return { line, endX: X(vals.length - 1), endY: Y(vals[vals.length - 1]!), startLabel: `${fmt(pts[0]!.val)} · ${MON_SHORT[asDate(pts[0]!.day).getUTCMonth()]}` };
}
