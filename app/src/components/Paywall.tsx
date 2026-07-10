import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { useEntitlement } from '../data/entitlement';
import { PrimaryButton } from '../ui/primitives';
import { track } from '../analytics';

const PREMIUM = [
  'Full 7-day menu + weekly refresh',
  'Every food you love, honoured',
  'Coach weekly insights',
  'Full history, trends & export',
  'Unlimited photo & voice logging',
];

type Plan = 'annual' | 'monthly';

export function Paywall({ onClose }: { onClose: () => void }) {
  const { c, radius } = useTheme();
  const { isPremium, startTrial, cancel } = useEntitlement();
  const [plan, setPlan] = useState<Plan>('annual');

  useEffect(() => {
    track('paywall_viewed');
  }, []);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 40 }}>
          <Text style={{ color: c('accent'), fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Usual Premium</Text>
          <Text style={{ color: c('textPrimary'), fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 }}>
            Your menu, your way.
          </Text>
          <Text style={{ color: c('textSecondary'), fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 20 }}>
            The Brain and all logging stay free, forever. Premium unlocks the full menu and a coach that goes deeper.
          </Text>

          {isPremium ? (
            <View style={{ backgroundColor: c('accentSubtle'), borderRadius: radius.lg, padding: 20, marginBottom: 20 }}>
              <Text style={{ color: c('accentSubtleText'), fontSize: 17, fontWeight: '700' }}>You’re on Premium ✨</Text>
              <Text style={{ color: c('accentSubtleText'), fontSize: 14, marginTop: 4 }}>Everything below is unlocked.</Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginBottom: 16 }}>
              <PlanCard
                selected={plan === 'annual'}
                onPress={() => setPlan('annual')}
                title="Annual"
                price="£39.99 / yr"
                sub="≈ £3.33 / mo · best value"
                badge="Save 67%"
              />
              <PlanCard
                selected={plan === 'monthly'}
                onPress={() => setPlan('monthly')}
                title="Monthly"
                price="£9.99 / mo"
                sub="Cancel anytime"
              />
            </View>
          )}

          <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 18, marginBottom: 20 }}>
            {PREMIUM.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
                <Text style={{ color: c('accent'), fontSize: 15, fontWeight: '800' }}>✓</Text>
                <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>

          {isPremium ? (
            <Pressable onPress={cancel} style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: c('textMuted'), fontSize: 14 }}>Cancel Premium (demo)</Text>
            </Pressable>
          ) : (
            <>
              <PrimaryButton
                label="Start 7-day free trial"
                onPress={() => {
                  track('paywall_converted', { plan });
                  startTrial();
                  onClose();
                }}
              />
              <Text style={{ color: c('textMuted'), fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                7 days free, then {plan === 'annual' ? '£39.99/yr' : '£9.99/mo'}. Cancel anytime.
              </Text>
            </>
          )}

          <Pressable onPress={onClose} style={{ alignItems: 'center', paddingVertical: 16, marginTop: 4 }}>
            <Text style={{ color: c('textSecondary'), fontSize: 15, fontWeight: '600' }}>{isPremium ? 'Done' : 'Maybe later'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  price,
  sub,
  badge,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  sub: string;
  badge?: string;
}) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selected ? c('accentSubtle') : c('surface'), borderColor: selected ? c('accent') : c('border'), borderWidth: selected ? 2 : 1, borderRadius: radius.lg, padding: 16 }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: c('accent'), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Text style={{ color: c('accentText'), fontSize: 11, fontWeight: '700' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 2 }}>{sub}</Text>
      </View>
      <Text style={{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }}>{price}</Text>
    </Pressable>
  );
}
