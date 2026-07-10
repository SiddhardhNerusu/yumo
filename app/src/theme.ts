import { useColorScheme } from 'react-native';
import { tokens, color as tokenColor, type Theme, type ColorName } from '@usual/tokens';

/** Bridges @usual/tokens into RN, following the device light/dark scheme. */
export function useTheme() {
  const scheme = useColorScheme();
  const theme: Theme = scheme === 'dark' ? 'dark' : 'light';
  return {
    theme,
    c: (name: ColorName) => tokenColor(theme, name),
    space: tokens.space,
    radius: tokens.radius,
    type: tokens.type,
  };
}
