import { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { ALLERGENS, type Allergen } from '@usual/shared';
import type { UserProfile, VariationDial } from '@usual/menu';
import { useTheme } from '../theme';
import { ALLERGEN_LABELS } from '../data/onboarding-seed';
import { PrimaryButton, Chip, NumberField } from '../ui/primitives';
import { useEntitlement } from '../data/entitlement';
import { Paywall } from './Paywall';

const VARIATIONS: { v: VariationDial; label: string }[] = [
  { v: 'habit', label: 'Habit' },
  { v: 'balanced', label: 'Balanced' },
  { v: 'mixup', label: 'Mix it up' },
];

export function Settings({
  profile,
  onClose,
  onSave,
  onReset,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSave: (p: UserProfile) => void;
  onReset: () => void;
}) {
  const { c, radius } = useTheme();
  const { isPremium } = useEntitlement();
  const [showPaywall, setShowPaywall] = useState(false);
  const [budget, setBudget] = useState<number>(profile.budgetKcal);
  const [variation, setVariation] = useState<VariationDial>(profile.variation);
  const [allergies, setAllergies] = useState<Allergen[]>(profile.allergies);

  const toggleAllergen = (a: Allergen) =>
    setAllergies((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));

  const save = () => {
    onSave({ ...profile, budgetKcal: Math.round(budget) || profile.budgetKcal, variation, allergies });
    onClose();
  };

  const kicker = { color: c('textMuted'), fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10, marginTop: 8 };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 }}>
          <Text style={{ color: c('textPrimary'), fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Settings</Text>
          <Pressable onPress={onClose}><Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 15 }}>Close</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 4 }}>
          <Pressable onPress={() => setShowPaywall(true)} style={{ backgroundColor: c('accentSubtle'), borderRadius: radius.lg, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View>
              <Text style={{ color: c('accentSubtleText'), fontSize: 16, fontWeight: '700' }}>{isPremium ? 'Premium ✨' : 'Go Premium ✨'}</Text>
              <Text style={{ color: c('accentSubtleText'), fontSize: 13, marginTop: 2 }}>{isPremium ? 'Active — thanks!' : 'Full menu + coach insights'}</Text>
            </View>
            <Text style={{ color: c('accentSubtleText'), fontSize: 20 }}>›</Text>
          </Pressable>

          <Text style={kicker}>Daily budget</Text>
          <NumberField label="Target" value={budget} onChange={setBudget} suffix="kcal" />

          <Text style={kicker}>Variety</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {VARIATIONS.map((v) => (
              <Chip key={v.v} label={v.label} selected={variation === v.v} onPress={() => setVariation(v.v)} />
            ))}
          </View>

          <Text style={kicker}>Allergies</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALLERGENS.map((a) => (
              <Chip key={a} label={ALLERGEN_LABELS[a]} selected={allergies.includes(a)} onPress={() => toggleAllergen(a)} />
            ))}
          </View>

          <View style={{ marginTop: 24 }}>
            <PrimaryButton label="Save changes" onPress={save} />
          </View>

          <Pressable onPress={onReset} style={{ alignItems: 'center', paddingVertical: 16, marginTop: 8 }}>
            <Text style={{ color: c('danger'), fontSize: 14, fontWeight: '600' }}>Start over — clear profile &amp; logs</Text>
          </Pressable>
        </ScrollView>
        {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
      </View>
    </Modal>
  );
}
