import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Tasteful haptics. No-op on web (Expo web has no haptics engine). Kept sparse —
 * a tick on the moments that matter (logging, the fridge choreography, tab/chip
 * selection), not on every tap, so it reads as "expensive", not noisy.
 */
const on = Platform.OS !== 'web';

export const haptics = {
  /** light tap — a primary action fired. */
  tap: () => { if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  /** medium impact — a choreographed physical moment (fly-in, toss). */
  impact: () => { if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  /** selection tick — tab switch, chip select. */
  select: () => { if (on) void Haptics.selectionAsync(); },
  /** the satisfying "logged" beat. */
  success: () => { if (on) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  /** gentle warning — e.g. crossing over budget. */
  warning: () => { if (on) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
};
