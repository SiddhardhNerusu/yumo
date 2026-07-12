import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_400Regular_Italic,
} from '@expo-google-fonts/newsreader';
import type { UserProfile } from '@yumo/menu';
import type { Goal } from '@yumo/shared';
import { useTheme } from './src/theme';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { AppShell } from './src/AppShell';
import { EventStoreProvider } from './src/data/eventStore';
import { KitchenProvider } from './src/data/kitchenStore';
import { EntitlementProvider } from './src/data/entitlement';
import { ErrorBoundary } from './src/ErrorBoundary';
import { bootstrapSession } from './src/data/repo';

const PROFILE_KEY = 'usual.profile.v1';
const EVENTLOG_KEY = 'usual.eventlog.v1';

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
        if (v && alive) {
          try {
            const saved = JSON.parse(v) as { profile: UserProfile; goal: Goal };
            setProfile(saved.profile);
            setGoal(saved.goal);
            void bootstrapSession(saved.profile, saved.goal).catch(() => {});
          } catch {
            // ignore corrupt profile
          }
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

  const handleDone = async (p: UserProfile, g: Goal) => {
    setGoal(g);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ profile: p, goal: g })).catch(() => {});
    await bootstrapSession(p, g);
    setProfile(p);
  };

  const handleUpdateProfile = async (p: UserProfile) => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ profile: p, goal })).catch(() => {});
    await bootstrapSession(p, goal);
    setProfile(p);
  };

  const handleReset = async () => {
    await AsyncStorage.multiRemove([PROFILE_KEY, EVENTLOG_KEY, 'usual.paywallSeen.v1', 'usual.entitlement.v1']).catch(() => {});
    setProfile(null);
  };

  return (
    <ErrorBoundary>
      <EntitlementProvider>
        {loading || !fontsLoaded ? (
          <Splash fontsLoaded={fontsLoaded} />
        ) : profile ? (
          <EventStoreProvider>
            <KitchenProvider seedTokens={profile.pantry}>
              <AppShell profile={profile} onReset={handleReset} onUpdateProfile={handleUpdateProfile} />
            </KitchenProvider>
          </EventStoreProvider>
        ) : (
          <OnboardingFlow onDone={handleDone} />
        )}
        <StatusBar style="auto" />
      </EntitlementProvider>
    </ErrorBoundary>
  );
}
