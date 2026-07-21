import raw from './pantry-cousins.json';
import { PANTRY_STAPLES } from './onboarding-seed';

const COUSINS = raw.cousins as Record<string, string[]>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface CousinChip {
  token: string;
  label: string;
}

/** The cousin staples suggested when a base staple is selected. Empty when the
 * base has none (e.g. Garlic, Butter). Tokens are lowercased to match how base
 * staple tokens are formed (label.toLowerCase()). */
export function cousinsFor(baseLabel: string): CousinChip[] {
  const list = COUSINS[baseLabel.trim().toLowerCase()] ?? [];
  return list.map((label) => ({ token: label.toLowerCase(), label }));
}

/** True when this base staple has any cousins to fan out. */
export function hasCousins(baseLabel: string): boolean {
  return (COUSINS[baseLabel.trim().toLowerCase()]?.length ?? 0) > 0;
}

/** Every cousin chip across all base staples (flat) — for search mode. */
export function allCousins(): CousinChip[] {
  const out: CousinChip[] = [];
  for (const list of Object.values(COUSINS)) {
    for (const label of list) out.push({ token: label.toLowerCase(), label });
  }
  return out;
}

/** All base-staple + cousin tokens — used to tell user-added "custom" staples apart. */
export function knownStapleTokens(): Set<string> {
  const s = new Set<string>();
  for (const base of PANTRY_STAPLES) {
    s.add(base.toLowerCase());
    for (const cz of cousinsFor(base)) s.add(cz.token);
  }
  return s;
}

export interface PantryRow {
  token: string;
  label: string;
  cousin: boolean;
}
export interface PantryRowsResult {
  rows: PantryRow[];
  /** the token to offer as "＋ Add …" when the query matches nothing, else null. */
  freeAddToken: string | null;
}

/**
 * The chips to render in the pantry picker (§6). No query → base staples with a
 * selected staple's cousins fanned in immediately after it (unselected cousins
 * of an unselected base stay hidden); user-added customs at the end. With a query
 * → a flat filtered list over base + all cousins + customs, plus a free-add chip
 * when nothing matches exactly. Pure so the fan-out logic is unit-tested (the UI
 * can't be click-tested inside the RN-web Modal).
 */
export function buildPantryRows(pantry: string[], query: string): PantryRowsResult {
  const q = query.trim().toLowerCase();
  const known = knownStapleTokens();
  if (q) {
    const all: PantryRow[] = [];
    for (const base of PANTRY_STAPLES) all.push({ token: base.toLowerCase(), label: base, cousin: false });
    for (const cz of allCousins()) all.push({ token: cz.token, label: cz.label, cousin: true });
    for (const tok of pantry) if (!known.has(tok)) all.push({ token: tok, label: cap(tok), cousin: false });
    const rows = all.filter((x) => x.label.toLowerCase().includes(q));
    const freeAddToken = q.length > 1 && !rows.some((x) => x.label.toLowerCase() === q) ? q : null;
    return { rows, freeAddToken };
  }
  const rows: PantryRow[] = [];
  for (const base of PANTRY_STAPLES) {
    const baseTok = base.toLowerCase();
    rows.push({ token: baseTok, label: base, cousin: false });
    const baseSelected = pantry.includes(baseTok);
    for (const cz of cousinsFor(base)) {
      if (baseSelected || pantry.includes(cz.token)) rows.push({ token: cz.token, label: cz.label, cousin: true });
    }
  }
  for (const tok of pantry) if (!known.has(tok)) rows.push({ token: tok, label: cap(tok), cousin: false });
  return { rows, freeAddToken: null };
}
