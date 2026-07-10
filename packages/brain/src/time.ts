/**
 * Deterministic time helpers. Every Brain function that depends on "now" takes
 * an explicit epoch-ms timestamp — the engine never calls Date.now() — so a
 * fixed event fixture always produces the same predictions (replay-testable).
 *
 * Convention: `tzOffsetMin` is minutes EAST of UTC (ISO +01:00 → +60, so BST
 * = +60, US-Eastern EST = −300). local wall-clock = ts + tzOffsetMin·60000.
 */

export interface LocalParts {
  /** 0 = Sunday … 6 = Saturday (local). */
  dayOfWeek: number;
  /** minutes since local midnight (0–1439). */
  minutesOfDay: number;
  /** integer local day index (days since epoch) — same value ⇒ same calendar day. */
  epochDay: number;
}

const DAY_MS = 86_400_000;

export function localParts(ts: number, tzOffsetMin: number): LocalParts {
  const local = ts + tzOffsetMin * 60_000;
  const d = new Date(local); // read with getUTC* so components are local wall-clock
  return {
    dayOfWeek: d.getUTCDay(),
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
    epochDay: Math.floor(local / DAY_MS),
  };
}

/** Signed day distance (a − b) in fractional days. */
export function daysBetween(a: number, b: number): number {
  return (a - b) / DAY_MS;
}

/** Hours between two timestamps (absolute). */
export function hoursBetween(a: number, b: number): number {
  return Math.abs(a - b) / 3_600_000;
}

/** Smallest circular distance between two minute-of-day values (0–720). */
export function minuteOfDayDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 1440 - raw);
}

/** Median of a numeric array (0 for empty). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
