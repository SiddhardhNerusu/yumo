import type { FoodVocabEntry } from '@yumo/shared';
import type { KitchenItem } from './kitchen-model';
import { POOL } from './menu-seed';
import { SINGLE_FOODS } from './foods-seed';
import { STARTER_KITCHEN } from './kitchen-seed';

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

/**
 * The catalog the voice/text add resolver snaps spoken nouns to. Data-derived
 * (no hardcoded list): single-food seeds + starter kitchen + every token the
 * recipe pool uses + whatever is live in the kitchen right now. Canonicalising
 * to these tokens is what lets "chikn" become the same token recipes cook with.
 */
export function buildFoodVocab(items: KitchenItem[]): FoodVocabEntry[] {
  const map = new Map<string, string>(); // token → label
  const add = (token: string, label?: string) => {
    const t = token.toLowerCase().trim();
    if (t && !map.has(t)) map.set(t, label ?? titleCase(t));
  };
  for (const f of SINGLE_FOODS) add(f.name, f.name);
  for (const s of STARTER_KITCHEN) add(s.token, s.label);
  for (const r of POOL) for (const t of r.foodTokens) add(t);
  for (const it of items) add(it.token, it.label);
  return [...map.entries()].map(([token, label]) => ({ token, label }));
}
