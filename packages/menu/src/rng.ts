/** Deterministic PRNG so a (profile, week-seed) pair always yields the same
 * menu — makes generation replay-testable, like the Brain. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string → uint32 hash (FNV-1a) for seeding. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Weighted sample (probability ∝ weight). Falls back to the highest-weight
 * item if all weights are ≤0. Returns undefined only for an empty list. */
export function weightedPick<T>(items: T[], weights: number[], rand: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) {
    let bestIdx = 0;
    for (let i = 1; i < weights.length; i++) if ((weights[i] ?? 0) > (weights[bestIdx] ?? 0)) bestIdx = i;
    return items[bestIdx];
  }
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i] ?? 0);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
