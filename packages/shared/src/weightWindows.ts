/**
 * Weight-chart time windows (§R3). The chart shows a selectable range and a
 * delta scoped to that window (Happy Scale's pattern — "vs 30 days ago", not
 * "vs your first-ever weigh-in"). Long ranges aggregate to weekly means so a
 * year of sparse data reads as a clean line, not a cloud (Apple Health pattern).
 */
export type WeightRange = 'w' | 'm' | 'y' | 'all';

const WINDOW_DAYS: Record<Exclude<WeightRange, 'all'>, number> = { w: 7, m: 30, y: 365 };
/** aggregate to weekly means once a window holds more than this many raw points. */
const AGGREGATE_ABOVE = 60;

export interface DayKg { day: number; kg: number }

function aggregateWeekly(entries: DayKg[]): DayKg[] {
  const buckets = new Map<number, { sum: number; n: number; dayMin: number; dayMax: number }>();
  for (const e of entries) {
    const wk = Math.floor(e.day / 7);
    const b = buckets.get(wk);
    if (b) { b.sum += e.kg; b.n += 1; b.dayMin = Math.min(b.dayMin, e.day); b.dayMax = Math.max(b.dayMax, e.day); }
    else buckets.set(wk, { sum: e.kg, n: 1, dayMin: e.day, dayMax: e.day });
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]) => ({ day: Math.round((b.dayMin + b.dayMax) / 2), kg: Math.round((b.sum / b.n) * 100) / 100 }));
}

/**
 * Points to plot for `range` plus the delta across the window (raw endpoints,
 * so aggregation never distorts it). `delta` is null when the window has < 2
 * weigh-ins. Entries need not be pre-sorted.
 */
export function windowWeights(entries: DayKg[], range: WeightRange, todayEpoch: number): { points: DayKg[]; delta: number | null } {
  const sorted = [...entries].sort((a, b) => a.day - b.day);
  const inWindow = range === 'all' ? sorted : sorted.filter((e) => e.day >= todayEpoch - WINDOW_DAYS[range] + 1);
  const points = (range === 'y' || range === 'all') && inWindow.length > AGGREGATE_ABOVE ? aggregateWeekly(inWindow) : inWindow;
  const delta = inWindow.length >= 2 ? inWindow[inWindow.length - 1]!.kg - inWindow[0]!.kg : null;
  return { points, delta };
}
