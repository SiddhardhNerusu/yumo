import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@usual/menu';
import type { Goal } from '@usual/shared';
import { useTheme } from './src/theme';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { AppShell } from './src/AppShell';
import { EventStoreProvider } from './src/data/eventStore';
import { bootstrapSession } from './src/data/repo';

const PROFILE_KEY = 'usual.profile.v1';
const EVENTLOG_KEY = 'usual.eventlog.v1';

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c('bg'), alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c('accent')} />
    </View>
  );
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a saved profile on launch, and re-establish the server session.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PROFILE_KEY)
      .then((v) => {
        if (v && alive) {
          try {
            const saved = JSON.parse(v) as { profile: UserProfile; goal: Goal };
            setProfile(saved.profile);
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

  const handleDone = async (p: UserProfile, goal: Goal) => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ profile: p, goal })).catch(() => {});
    await bootstrapSession(p, goal);
    setProfile(p);
  };

  const handleReset = async () => {
    await AsyncStorage.multiRemove([PROFILE_KEY, EVENTLOG_KEY]).catch(() => {});
    setProfile(null);
  };

  return (
    <>
      {loading ? (
        <Splash />
      ) : profile ? (
        <EventStoreProvider>
          <AppShell profile={profile} onReset={handleReset} />
        </EventStoreProvider>
      ) : (
        <OnboardingFlow onDone={handleDone} />
      )}
      <StatusBar style="auto" />
    </>
  );
}
