import type { MenuRecipe } from '@yumo/menu';

/**
 * Approximate cook time in minutes from the effort bucket ('5min' | '15min' |
 * '30min+') — the only time signal the recipe data carries. Parsed from the enum
 * (not a hardcoded list), so it tracks the buckets. '30min+' shows as "30 min"
 * (the "+" is lost); real per-dish minutes would need a new data field.
 */
export function effortMin(effort: MenuRecipe['effort']): number {
  return parseInt(effort, 10) || 15;
}
