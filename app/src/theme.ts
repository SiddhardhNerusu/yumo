import { useColorScheme } from 'react-native';
import { tokens, color as tokenColor, type Theme, type ColorName } from '@yumo/tokens';

/**
 * Display serif (Newsreader) loaded via @expo-google-fonts/newsreader in App.tsx.
 * These are the exact loaded family names; falls back to the platform serif
 * until the font is ready. UI text stays on the system sans.
 */
export const fonts = {
  serif: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifItalic: 'Newsreader_400Regular_Italic',
} as const;

/** Bridges @yumo/tokens into RN, following the device light/dark scheme. */
export function useTheme() {
  const scheme = useColorScheme();
  const theme: Theme = scheme === 'dark' ? 'dark' : 'light';
  return {
    theme,
    c: (name: ColorName) => tokenColor(theme, name),
    space: tokens.space,
    radius: tokens.radius,
    type: tokens.type,
    duration: tokens.duration,
    fonts,
  };
}
