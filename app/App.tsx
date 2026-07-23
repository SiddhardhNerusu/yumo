import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_400Regular_Italic,
} from '@expo-google-fonts/newsreader';
import type { UserProfile } from '@yumo/menu';
import type { Goal } from '@yumo/shared';
import { parseProfileEnvelope, type GoalPrefs } from './src/data/goalPrefs';
import { useTheme } from './src/theme';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { AppShell } from './src/AppShell';
import { EventStoreProvider } from './src/data/eventStore';
import { KitchenProvider } from './src/data/kitchenStore';
import { EntitlementProvider } from './src/data/entitlement';
import { WeightUnitProvider } from './src/data/weightUnit';
import { MyMealsProvider } from './src/data/myMeals';
import { NavIntentProvider, useNavIntent } from './src/data/navIntent';
import { ShopDayProvider } from './src/data/shopDay';
import { SHOP_NOTIFICATION_TYPE } from './src/data/shopReminder';
import { ErrorBoundary } from './src/ErrorBoundary';
import { bootstrapSession } from './src/data/repo';

const PROFILE_KEY = 'usual.profile.v1';
const EVENTLOG_KEY = 'usual.eventlog.v1';

// Foreground presentation for a delivered notification (native only).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

const SHOP_NOTIF_HANDLED_KEY = 'yumo.shopnotif.handled.v1';

/** Routes a shop-day notification tap → open the Kitchen shop list, warm or cold.
 * getLastNotificationResponseAsync PERSISTS the last response across launches, so
 * a plain relaunch would otherwise re-open the sheet forever; we dedup on the
 * notification's delivery date (unique per weekly delivery) so each tap fires once. */
function NotificationBridge() {
  const { openShop } = useNavIntent();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const isShop = (r: Notifications.NotificationResponse | null) =>
      (r?.notification.request.content.data as { type?: string } | undefined)?.type === SHOP_NOTIFICATION_TYPE;
    const handle = async (r: Notifications.NotificationResponse | null, viaTap: boolean) => {
      if (!isShop(r)) return;
      const key = String(r!.notification.date);
      if (!viaTap) {
        const prev = await AsyncStorage.getItem(SHOP_NOTIF_HANDLED_KEY).catch(() => null);
        if (prev === key) return; // this persisted response was already acted on
      }
      await AsyncStorage.setItem(SHOP_NOTIF_HANDLED_KEY, key).catch(() => {});
      openShop();
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { void handle(r, true); });
    Notifications.getLastNotificationResponseAsync().then((r) => handle(r, false)).catch(() => {});
    return () => sub.remove();
  }, [openShop]);
  return null;
}

function Splash({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c('bg'), alignItems: 'center', justifyContent: 'center' }}>
      {fontsLoaded ? (
        <Text style={{ fontFamily: 'Newsreader_500Medium', fontSize: 44, color: c('textPrimary'), letterSpacing: -0.5 }}>Yumo</Text>
      ) : (
        <ActivityIndicator color={c('accent')} />
      )}
    </View>
  );
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<Goal>('maintain');
  const [prefs, setPrefs] = useState<GoalPrefs | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_400Regular_Italic,
  });

  // Restore a saved profile on launch, and re-establish the server session.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PROFILE_KEY)
      .then((v) => {
        const saved = parseProfileEnvelope(v);
        if (saved && alive) {
          setProfile(saved.profile);
          setGoal(saved.goal);
          setPrefs(saved.prefs);
          void bootstrapSession(saved.profile, saved.goal).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleDone = async (p: UserProfile, g: Goal, pr?: GoalPrefs) => {
    setGoal(g);
    setPrefs(pr);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ profile: p, goal: g, prefs: pr })).catch(() => {});
    await bootstrapSession(p, g);
    setProfile(p);
  };

  const handleUpdateProfile = async (p: UserProfile, g: Goal = goal, pr: GoalPrefs | undefined = prefs) => {
    setGoal(g);
    setPrefs(pr);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ profile: p, goal: g, prefs: pr })).catch(() => {});
    await bootstrapSession(p, g);
    setProfile(p);
  };

  const handleReset = async () => {
    await AsyncStorage.multiRemove([PROFILE_KEY, EVENTLOG_KEY, 'usual.paywallSeen.v1', 'usual.entitlement.v1', 'yumo.mymeals.v1']).catch(() => {});
    setProfile(null);
  };

  return (
    <ErrorBoundary>
      <EntitlementProvider>
        <WeightUnitProvider>
        {loading || !fontsLoaded ? (
          <Splash fontsLoaded={fontsLoaded} />
        ) : profile ? (
          <EventStoreProvider>
            <KitchenProvider seedTokens={profile.pantry}>
              <MyMealsProvider>
                <ShopDayProvider>
                  <NavIntentProvider>
                    <NotificationBridge />
                    <AppShell profile={profile} goal={goal} prefs={prefs} onReset={handleReset} onUpdateProfile={handleUpdateProfile} />
                  </NavIntentProvider>
                </ShopDayProvider>
              </MyMealsProvider>
            </KitchenProvider>
          </EventStoreProvider>
        ) : (
          <OnboardingFlow onDone={handleDone} />
        )}
        <StatusBar style="auto" />
        </WeightUnitProvider>
      </EntitlementProvider>
    </ErrorBoundary>
  );
}
