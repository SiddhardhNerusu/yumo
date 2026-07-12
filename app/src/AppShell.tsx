import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@yumo/menu';
import { useTheme } from './theme';
import { HAIRLINE_TOP } from './components/kit';
import { useEntitlement } from './data/entitlement';
import { Today } from './screens/Today';
import { Menu } from './screens/Menu';
import { Progress } from './screens/Progress';
import { Paywall } from './components/Paywall';

type Tab = 'today' | 'menu' | 'progress';
const TABS: Tab[] = ['today', 'menu', 'progress'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const PAYWALL_SEEN_KEY = 'usual.paywallSeen.v1';

function TabIcon({ name, color }: { name: Tab; color: string }) {
  if (name === 'today') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={7.5} stroke={color} strokeWidth={2} fill="none" />
        <Circle cx={12} cy={12} r={2.5} fill={color} />
      </Svg>
    );
  }
  if (name === 'menu') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect x={4} y={7} width={16} height={2.6} rx={1.3} fill={color} />
        <Rect x={4} y={11.7} width={16} height={2.6} rx={1.3} fill={color} />
        <Rect x={4} y={16.4} width={10} height={2.6} rx={1.3} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={4.5} y={12.5} width={3.2} height={7.5} rx={1.6} fill={color} />
      <Rect x={10.4} y={8.5} width={3.2} height={11.5} rx={1.6} fill={color} />
      <Rect x={16.3} y={5} width={3.2} height={15} rx={1.6} fill={color} />
    </Svg>
  );
}

export function AppShell({
  profile,
  onReset,
  onUpdateProfile,
}: {
  profile: UserProfile;
  onReset: () => void;
  onUpdateProfile: (p: UserProfile) => void;
}) {
  const { c } = useTheme();
  const { isPremium } = useEntitlement();
  const [tab, setTab] = useState<Tab>('today');
  const [showPaywall, setShowPaywall] = useState(false);
  // crossfade the screen on tab change so tabs dissolve rather than hard-cut
  const screenOp = useRef(new Animated.Value(1)).current;
  useEffect(() => { screenOp.setValue(0.4); Animated.timing(screenOp, { toValue: 1, duration: 180, useNativeDriver: true }).start(); }, [tab, screenOp]);

  // Soft, skippable paywall once, just after onboarding (§11 "after menu reveal").
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PAYWALL_SEEN_KEY)
      .then((v) => {
        if (alive && !v && !isPremium) {
          setShowPaywall(true);
          AsyncStorage.setItem(PAYWALL_SEEN_KEY, '1').catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // once on mount
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <Animated.View style={{ flex: 1, opacity: screenOp }}>
        {tab === 'today' ? <Today budget={profile.budgetKcal} tokens={[...profile.needs, ...profile.likes]} /> : null}
        {tab === 'menu' ? <Menu profile={profile} /> : null}
        {tab === 'progress' ? <Progress profile={profile} onReset={onReset} onUpdateProfile={onUpdateProfile} /> : null}
      </Animated.View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: HAIRLINE_TOP, backgroundColor: c('surface'), paddingBottom: 26, paddingTop: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 12 }}>
        {TABS.map((t) => {
          const active = tab === t;
          const col = active ? c('accent') : c('textMuted');
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 6, gap: 4, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
              <TabIcon name={t} color={col} />
              <Text style={{ color: col, fontSize: 11, fontWeight: active ? '700' : '600' }}>{cap(t)}</Text>
            </Pressable>
          );
        })}
      </View>
      {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
    </View>
  );
}
