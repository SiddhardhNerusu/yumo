import { readFileSync, writeFileSync } from 'node:fs';
import type { NutrientProfilePer100g } from '@usual/shared';

/** One normalized food row derived from USDA FoodData Central. */
export interface FdcFood {
  fdcId: number;
  description: string;
  dataType: 'sr_legacy' | 'foundation';
  per100g: NutrientProfilePer100g;
  /** true when energy AND all three macros were present in the source. */
  complete: boolean;
}

export interface FdcStore {
  source: string;
  license: string;
  datasets: string[];
  count: number;
  foods: FdcFood[];
}

const STORE_META = {
  source: 'USDA FoodData Central',
  license: 'Public Domain (U.S. Government work, CC0)',
} as const;

export function buildStore(foods: FdcFood[], datasets: string[]): FdcStore {
  return { ...STORE_META, datasets, count: foods.length, foods };
}

export function saveStore(path: string, store: FdcStore): void {
  writeFileSync(path, JSON.stringify(store));
}

export function loadStore(path: string): FdcStore {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as FdcStore;
  if (!Array.isArray(parsed.foods)) {
    throw new Error(`FDC store at ${path} is malformed (no foods array).`);
  }
  return parsed;
}

/** Index a store by fdcId for O(1) pinned lookups. */
export function indexById(store: FdcStore): Map<number, FdcFood> {
  const map = new Map<number, FdcFood>();
  for (const f of store.foods) map.set(f.fdcId, f);
  return map;
}
