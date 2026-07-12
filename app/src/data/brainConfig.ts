import { DEFAULT_CONFIG, resolveConfig, type BrainConfig } from '@yumo/brain';

/**
 * Remote-tunable Brain config (§3.3: "all weights server-tunable via remote
 * config"). The client ships DEFAULT_CONFIG and swaps in the server-served
 * weights/caps/thresholds (GET /api/config → { brain }) on bootstrap. Held
 * module-level so the pure engine stays config-injected, not globally coupled.
 */
let active: BrainConfig = DEFAULT_CONFIG;

/** Merge a server-served (possibly partial) brain config over the defaults. */
export function setBrainConfig(partial: unknown): void {
  if (partial && typeof partial === 'object') {
    try {
      active = resolveConfig(partial as Parameters<typeof resolveConfig>[0]);
    } catch {
      // keep whatever we had; never let bad remote config break prediction
    }
  }
}

export function getBrainConfig(): BrainConfig {
  return active;
}
