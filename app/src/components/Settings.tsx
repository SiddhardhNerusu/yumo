import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ALLERGENS, type Allergen } from '@yumo/shared';
import { PROTEIN_FLOOR_PER_KG, type UserProfile, type VariationDial } from '@yumo/menu';
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [budget, setBudget] = useState<number>(profile.budgetKcal);
  // Targets: derive the same values macroTargets() would, so an untouched
  // stepper shows the real default. `*Touched` gates the write (D4): we only
  // pin a field when the user actually moves it — leaving it undefined keeps it
  // tracking the derived default instead of freezing it on the first Save.
  const derivedProtein = Math.round(PROTEIN_FLOOR_PER_KG * profile.targetWeightKg);
  const derivedFat = Math.round((profile.budgetKcal * 0.3) / 9);
  const derivedCarbs = Math.max(1, Math.round((profile.budgetKcal - (profile.proteinTargetG ?? derivedProtein) * 4 - (profile.fatTargetG ?? derivedFat) * 9) / 4));
  const [proteinTarget, setProteinTarget] = useState<number>(profile.proteinTargetG ?? derivedProtein);
  const [carbTarget, setCarbTarget] = useState<number>(profile.carbTargetG ?? derivedCarbs);
  const [fatTarget, setFatTarget] = useState<number>(profile.fatTargetG ?? derivedFat);
  const [proteinTouched, setProteinTouched] = useState(false);
  const [carbsTouched, setCarbsTouched] = useState(false);
  const [fatTouched, setFatTouched] = useState(false);
  const [showAdvancedTargets, setShowAdvancedTargets] = useState(false);
  const [variation, setVariation] = useState<VariationDial>(profile.variation);
  const [allergies, setAllergies] = useState<Allergen[]>(profile.allergies);
  const [pantry, setPantry] = useState<string[]>(profile.pantry);
  const clampProtein = (v: number) => Math.max(40, Math.min(300, v));
  const clampCarbs = (v: number) => Math.max(50, Math.min(600, v));
  const clampFat = (v: number) => Math.max(20, Math.min(200, v));
  // Non-punitive guard for the carbs collapse: when protein + fat alone already
  // reach the budget, macroTargets() floors carbs at 1 (bar reads "/1g"). Just
  // tell the user calmly — never block, never a red state.
  const targetsOverBudget = proteinTarget * 4 + fatTarget * 9 >= budget;

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
    // D4: write a target only when the user moved its stepper; otherwise carry
    // the profile's existing value through (undefined stays undefined, so it
    // keeps tracking targetWeightKg / budget instead of being pinned on Save).
    onSave({
      ...profile,
      budgetKcal: clampBudget(Math.round(budget)) || profile.budgetKcal,
      proteinTargetG: proteinTouched ? clampProtein(Math.round(proteinTarget)) : profile.proteinTargetG,
      carbTargetG: carbsTouched ? clampCarbs(Math.round(carbTarget)) : profile.carbTargetG,
      fatTargetG: fatTouched ? clampFat(Math.round(fatTarget)) : profile.fatTargetG,
      variation,
      allergies,
      pantry,
    });
    onClose();
  };

  const StepBtn = ({ label, onPress, a11yLabel }: { label: string; onPress: () => void; a11yLabel: string }) => (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={a11yLabel} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const targetRow = (value: number, unit: string, dec: () => void, inc: () => void, a11y: string) => (
    <View style={{ marginTop: 8, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <StepBtn label="−" a11yLabel={`Decrease ${a11y}`} onPress={dec} />
      <Text>
        <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{Math.round(value)}</Text>
        <Text style={{ color: c('textMuted'), fontSize: 14 }}> {unit}</Text>
      </Text>
      <StepBtn label="＋" a11yLabel={`Increase ${a11y}`} onPress={inc} />
    </View>
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
            <StepBtn label="−" a11yLabel="Decrease daily budget" onPress={() => setBudget((b) => clampBudget(b - 50))} />
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{Math.round(budget).toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 14 }}> kcal</Text>
            </Text>
            <StepBtn label="＋" a11yLabel="Increase daily budget" onPress={() => setBudget((b) => clampBudget(b + 50))} />
          </View>
        </View>

        {/* Daily targets — protein always visible; carbs & fat behind Advanced */}
        <View style={{ marginTop: 16 }}>
          <Kicker>Daily targets</Kicker>
          {targetRow(
            proteinTarget,
            'g protein',
            () => { setProteinTarget((p) => clampProtein(p - 5)); setProteinTouched(true); },
            () => { setProteinTarget((p) => clampProtein(p + 5)); setProteinTouched(true); },
            'protein target',
          )}
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>Protein drives your menu; carbs and fat are guides.</Text>

          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <TextLink label={showAdvancedTargets ? 'Hide carbs & fat' : 'Advanced: carbs & fat'} tone="neutral" onPress={() => setShowAdvancedTargets((v) => !v)} />
          </View>

          {showAdvancedTargets ? (
            <>
              {targetRow(
                carbTarget,
                'g carbs',
                () => { setCarbTarget((v) => clampCarbs(v - 10)); setCarbsTouched(true); },
                () => { setCarbTarget((v) => clampCarbs(v + 10)); setCarbsTouched(true); },
                'carb target',
              )}
              {targetRow(
                fatTarget,
                'g fat',
                () => { setFatTarget((v) => clampFat(v - 10)); setFatTouched(true); },
                () => { setFatTarget((v) => clampFat(v + 10)); setFatTouched(true); },
                'fat target',
              )}
            </>
          ) : null}

          {targetsOverBudget ? (
            <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>Protein and fat here already use your whole budget, so carbs will show as none.</Text>
          ) : null}
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

        {confirmReset ? (
          <View style={{ marginTop: 10, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 16 }}>
            <Text style={{ color: c('textSecondary'), fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 14 }}>
              This deletes your profile and every logged meal. It can't be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setConfirmReset(false)} style={{ flex: 1, borderWidth: 1, borderColor: c('borderStrong'), borderRadius: 999, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: c('textSecondary'), fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onReset} style={({ pressed }) => ({ flex: 1, backgroundColor: c('danger'), opacity: pressed ? 0.85 : 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' })}>
                <Text style={{ color: c('bg'), fontSize: 14, fontWeight: '700' }}>Delete everything</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmReset(true)} style={{ alignItems: 'center', paddingVertical: 18, marginTop: 8 }}>
            {({ pressed }) => (
              <Text style={{ color: pressed ? c('danger') : c('textMuted'), fontSize: 14, fontWeight: '600' }}>Start over — clear profile &amp; logs</Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      <View style={{ marginTop: 14 }}>
        <PrimaryButton label="Save changes" onPress={save} full />
      </View>

      {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
    </Sheet>
  );
}
