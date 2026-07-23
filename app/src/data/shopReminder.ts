import { Platform } from 'react-native';

/**
 * The weekly shop-day push (Kitchen §5). A once-a-week local notification on the
 * user's chosen day; tapping it opens the shop list. Native-only — no-ops on web.
 * Permission is requested here (on enable), never at boot. expo-notifications is
 * lazy-imported so it never loads in the web bundle.
 */

/** Payload the tap-through listener matches on to open the shop sheet. */
export const SHOP_NOTIFICATION_TYPE = 'shopDay';

const CONTENT = {
  title: 'Your shop list is ready 🛒',
  body: 'Open Yumo to see what to pick up this week.',
  data: { type: SHOP_NOTIFICATION_TYPE },
};

/** Outcome of trying to schedule — lets the UI tell "reminder set" from "you
 * declined notifications" from "not available here (web)". */
export type ShopReminderResult =
  | { status: 'scheduled'; id: string }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Schedule the weekly reminder for `weekday` (1 = Sunday … 7 = Saturday, expo's
 * convention) at 09:00. Requests permission on demand.
 */
export async function scheduleShopReminder(weekday: number): Promise<ShopReminderResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };
  const Notifications = await import('expo-notifications');
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { status: 'denied' };
  const id = await Notifications.scheduleNotificationAsync({
    content: CONTENT,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: 9, minute: 0 },
  });
  return { status: 'scheduled', id };
}

/** Cancel a previously scheduled reminder (no-op on web / bad id). */
export async function cancelShopReminder(notifId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
}
