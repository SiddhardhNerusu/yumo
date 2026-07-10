import tokensJson from '../tokens.json';

export type Theme = 'light' | 'dark';

/** Full token set (JSON source of truth). */
export const tokens = tokensJson;

export type ColorName = keyof typeof tokensJson.color.light;

/** Resolve a semantic color for a theme. */
export function color(theme: Theme, name: ColorName): string {
  return tokensJson.color[theme][name];
}

export const space = tokensJson.space;
export const radius = tokensJson.radius;
export const type = tokensJson.type;
export const duration = tokensJson.duration;

// ---------------------------------------------------------------------------
// WCAG contrast utilities. Used by the token test to guarantee every text /
// surface pair meets AA — this is the "WCAG AA on all text" hard rule made
// executable, so a regression fails CI rather than shipping.
// ---------------------------------------------------------------------------

/** Parse #RGB or #RRGGBB → [r, g, b] in 0..255. */
export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

function channelLuminance(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0..1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** WCAG contrast ratio (1..21) between two colors. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA thresholds. */
export const WCAG_AA = {
  /** Normal body text. */
  normalText: 4.5,
  /** Large text (>=18.66px, or >=14pt bold) and UI components. */
  largeText: 3,
} as const;
