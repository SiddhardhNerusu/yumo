import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import type { UserProfile } from '@usual/menu';
import type { Goal } from '@usual/shared';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow';
import { AppShell } from './src/AppShell';
import { EventStoreProvider } from './src/data/eventStore';
import { bootstrapSession } from './src/data/repo';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const handleDone = async (p: UserProfile, goal: Goal) => {
    await bootstrapSession(p, goal); // logs in + pushes profile if the server is up; no-op offline
    setProfile(p);
  };

  return (
    <>
      {profile ? (
        <EventStoreProvider>
          <AppShell profile={profile} />
        </EventStoreProvider>
      ) : (
        <OnboardingFlow onDone={handleDone} />
      )}
      <StatusBar style="auto" />
    </>
  );
}
