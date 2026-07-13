import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ALLERGENS, type Allergen } from '@yumo/shared';
import type { UserProfile, VariationDial } from '@yumo/menu';
import { useTheme } from '../theme';
import { ALLERGEN_LABELS, PANTRY_STAPLES } from '../data/onboarding-seed';
import { Sheet, Serif, Kicker, Chip, PrimaryButton, TextLink } from './kit';
import { useEntitlement } from '../data/entitlement';
import { Paywall } from './Paywall';

const VARIATIONS: { v: VariationDial; label: string }[] = [
  { v: 'habit', label: 'Habit' },
  { v: 'balanced', label: 'Balanced' },
  { v: 'mixup', label: 'Mix it up' },
];
const VARIETY_HINT: Record<VariationDial, string> = {
  habit: 'Mostly your usuals — the menu repeats what works.',
  balanced: 'A steady mix of usuals and fresh ideas.',
  mixup: 'Something new most days — maximum variety.',
};
const num = { fontVariant: ['tabular-nums' as const] };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const { c } = useTheme();
  const { isPremium } = useEntitlement();
  const [showPaywall, setShowPaywall] = useState(false);
  const [budget, setBudget] = useState<number>(profile.budgetKcal);
  const [proteinTarget, setProteinTarget] = useState<number>(profile.proteinTargetG ?? Math.round(1.6 * profile.targetWeightKg));
  const [variation, setVariation] = useState<VariationDial>(profile.variation);
  const [allergies, setAllergies] = useState<Allergen[]>(profile.allergies);
  const [pantry, setPantry] = useState<string[]>(profile.pantry);
  const clampProtein = (v: number) => Math.max(40, Math.min(300, v));

  const clampBudget = (v: number) => Math.max(1400, Math.min(4000, v)); // ED floor guardrail
  const toggleAllergen = (a: Allergen) => setAllergies((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));
  const togglePantry = (token: string) => setPantry((xs) => (xs.includes(token) ? xs.filter((x) => x !== token) : [...xs, token]));
  const pantryOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const p of PANTRY_STAPLES) labels.set(p.toLowerCase(), p);
    for (const t of profile.pantry) if (!labels.has(t)) labels.set(t, cap(t));
    return [...labels.entries()].map(([token, label]) => ({ token, label }));
  }, [profile.pantry]);

  const save = () => {
    onSave({ ...profile, budgetKcal: clampBudget(Math.round(budget)) || profile.budgetKcal, proteinTargetG: clampProtein(Math.round(proteinTarget)), variation, allergies, pantry });
    onClose();
  };

  const StepBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Settings</Serif>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>

      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
        {/* Go Premium */}
        <Pressable onPress={() => setShowPaywall(true)} style={{ backgroundColor: c('accentFaint'), borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: c('accentSoft'), fontSize: 15, fontWeight: '700' }}>{isPremium ? 'Premium' : 'Go Premium'}</Text>
            <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>{isPremium ? 'Active — thank you' : 'Full menu · weekly regen · coach insights'}</Text>
          </View>
          <Text style={{ color: c('accentSoft'), fontSize: 20 }}>›</Text>
        </Pressable>

        {/* Daily budget stepper */}
        <View style={{ marginTop: 20 }}>
          <Kicker>Daily budget</Kicker>
          <View style={{ marginTop: 8, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <StepBtn label="−" onPress={() => setBudget((b) => clampBudget(b - 50))} />
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{Math.round(budget).toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 14 }}> kcal</Text>
            </Text>
            <StepBtn label="＋" onPress={() => setBudget((b) => clampBudget(b + 50))} />
          </View>
        </View>

        {/* Protein target stepper */}
        <View style={{ marginTop: 16 }}>
          <Kicker>Protein target</Kicker>
          <View style={{ marginTop: 8, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <StepBtn label="−" onPress={() => setProteinTarget((p) => clampProtein(p - 5))} />
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{Math.round(proteinTarget)}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 14 }}> g protein</Text>
            </Text>
            <StepBtn label="＋" onPress={() => setProteinTarget((p) => clampProtein(p + 5))} />
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>Plans aim to hit this — dinners carry the most.</Text>
        </View>

        {/* Variety segmented control */}
        <View style={{ marginTop: 20 }}>
          <Kicker>Variety</Kicker>
          <View style={{ marginTop: 8, flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 999, padding: 4 }}>
            {VARIATIONS.map((v) => {
              const on = variation === v.v;
              return (
                <Pressable key={v.v} onPress={() => setVariation(v.v)} style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
                  <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{v.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>{VARIETY_HINT[variation]}</Text>
        </View>

        {/* Pantry */}
        <View style={{ marginTop: 20 }}>
          <Kicker>Pantry staples</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
            {pantryOptions.map((p) => (
              <Chip key={p.token} label={p.label} selected={pantry.includes(p.token)} onPress={() => togglePantry(p.token)} />
            ))}
          </View>
        </View>

        {/* Allergies */}
        <View style={{ marginTop: 20 }}>
          <Kicker>Allergies</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
            {ALLERGENS.map((a) => (
              <Chip key={a} label={ALLERGEN_LABELS[a]} selected={allergies.includes(a)} onPress={() => toggleAllergen(a)} />
            ))}
          </View>
        </View>

        <Pressable onPress={onReset} style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 18, marginTop: 8 })}>
          {({ pressed }) => (
            <Text style={{ color: pressed ? c('danger') : c('textMuted'), fontSize: 14, fontWeight: '600' }}>Start over — clear profile &amp; logs</Text>
          )}
        </Pressable>
      </ScrollView>

      <View style={{ marginTop: 14 }}>
        <PrimaryButton label="Save changes" onPress={save} flex />
      </View>

      {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
    </Sheet>
  );
}
