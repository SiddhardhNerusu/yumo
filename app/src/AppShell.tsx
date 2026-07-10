import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { UserProfile } from '@usual/menu';
import { useTheme } from './theme';
import { Today } from './screens/Today';
import { Menu } from './screens/Menu';
import { Progress } from './screens/Progress';

type Tab = 'today' | 'menu' | 'progress';
const TABS: Tab[] = ['today', 'menu', 'progress'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function AppShell({ profile, onReset }: { profile: UserProfile; onReset: () => void }) {
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('today');

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <View style={{ flex: 1 }}>
        {tab === 'today' ? <Today budget={profile.budgetKcal} /> : null}
        {tab === 'menu' ? <Menu profile={profile} /> : null}
        {tab === 'progress' ? <Progress onReset={onReset} /> : null}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c('border'), backgroundColor: c('surface'), paddingBottom: 26, paddingTop: 8 }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: tab === t ? c('accent') : c('textMuted'), fontSize: 13, fontWeight: tab === t ? '700' : '500' }}>{cap(t)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
