import { describe, it, expect } from 'vitest';
import { color, contrastRatio, WCAG_AA, type Theme } from '../src/index';

const themes: Theme[] = ['light', 'dark'];

/**
 * Every text/surface pairing the UI will actually use, with its required
 * WCAG level. If a token edit drops any of these below threshold, this test
 * fails — that is the enforcement mechanism for "WCAG AA on all text".
 */
const normalTextPairs: Array<[string, string]> = [
  ['textPrimary', 'bg'],
  ['textPrimary', 'surface'],
  ['textPrimary', 'surfaceSunken'],
  ['textSecondary', 'bg'],
  ['textSecondary', 'surface'],
  ['textMuted', 'bg'],
  ['accentText', 'accent'], // button labels — must clear normal-text AA
  ['accentSubtleText', 'accentSubtle'], // chips/tags
];

// Colored accent used as an icon / large label on the app surfaces, plus
// status colors used for small labels.
const largeOrUiPairs: Array<[string, string]> = [
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['success', 'surface'],
  ['danger', 'surface'],
];

describe('design tokens — WCAG AA contrast', () => {
  for (const theme of themes) {
    describe(theme, () => {
      for (const [fg, bg] of normalTextPairs) {
        it(`${fg} on ${bg} >= AA normal (${WCAG_AA.normalText})`, () => {
          const ratio = contrastRatio(color(theme, fg as never), color(theme, bg as never));
          expect(ratio, `${fg}/${bg} was ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
            WCAG_AA.normalText,
          );
        });
      }
      for (const [fg, bg] of largeOrUiPairs) {
        it(`${fg} on ${bg} >= AA large/UI (${WCAG_AA.largeText})`, () => {
          const ratio = contrastRatio(color(theme, fg as never), color(theme, bg as never));
          expect(ratio, `${fg}/${bg} was ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
            WCAG_AA.largeText,
          );
        });
      }
    });
  }
});
