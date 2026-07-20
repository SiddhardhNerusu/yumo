import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import {
  ALLERGENS,
  ACTIVITY_LABEL,
  dailyBudget,
  kgToDisplay,
  defaultMacroPct,
  rebalanceMacroPct,
  pctToGrams,
  type Allergen,
  type Goal,
  type Sex,
  type ActivityTier,
  type WeightUnit,
  type MacroPct,
} from '@yumo/shared';
import type { UserProfile, VariationDial } from '@yumo/menu';
import { RATE_PRESETS, type GoalPrefs } from '../data/goalPrefs';
import { useTheme } from '../theme';
import { useWeightUnit } from '../data/weightUnit';
import { ALLERGEN_LABELS, PANTRY_STAPLES } from '../data/onboarding-seed';
import { NumberField } from '../ui/primitives';
import { Serif, Kicker, Chip, PrimaryButton, TextLink } from './kit';
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
const WEIGHT_UNITS: { u: WeightUnit; label: string }[] = [
  { u: 'kg', label: 'kg' },
  { u: 'lb', label: 'lb' },
  { u: 'st', label: 'st' },
];
const GOAL_OPTS: { v: Goal; label: string }[] = [
  { v: 'lose', label: 'Lose' },
  { v: 'maintain', label: 'Maintain' },
  { v: 'gain', label: 'Gain' },
];
const SEX_OPTS: { v: Sex; label: string }[] = [
  { v: 'male', label: 'Male' },
  { v: 'female', label: 'Female' },
];
const ACTIVITIES: ActivityTier[] = ['desk', 'onfeet', 'active', 'veryactive'];
const num = { fontVariant: ['tabular-nums' as const] };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Settings({
  profile,
  goal,
  prefs,
  currentKg,
  onClose,
  onSave,
  onReset,
}: {
  profile: UserProfile;
  goal: Goal;
  prefs?: GoalPrefs;
  /** latest weigh-in (falls back to onboarding weight) — the budget engine's weight input. */
  currentKg: number;
  onClose: () => void;
  onSave: (p: UserProfile, goal?: Goal, prefs?: GoalPrefs) => void;
  onReset: () => void;
}) {
  const { c } = useTheme();
  const { isPremium } = useEntitlement();
  const { unit, setUnit } = useWeightUnit();
  const [showPaywall, setShowPaywall] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── goal engine state (seeded from prefs, else onboarding defaults) ─────────
  const [goalV, setGoalV] = useState<Goal>(goal);
  const [rate, setRate] = useState<number>(prefs?.rateKgPerWeek ?? 0.5);
  const [activity, setActivity] = useState<ActivityTier>(prefs?.activity ?? 'onfeet');
  const [heightCm, setHeightCm] = useState<number>(prefs?.heightCm ?? 175);
  const [age, setAge] = useState<number>(prefs?.age ?? 30);
  const [sex, setSex] = useState<Sex>(prefs?.sex ?? 'male');
  // Old installs (no prefs) start in Custom so the existing budget number is
  // preserved untouched — the "goal-based budget" link is the finish-setup path.
  const [customBudget, setCustomBudget] = useState<boolean>(prefs?.customBudget ?? prefs == null);
  const [budget, setBudget] = useState<number>(profile.budgetKcal);
  const [macroPct, setMacroPct] = useState<MacroPct>(
    prefs?.macroPct ?? defaultMacroPct(profile.budgetKcal, profile.targetWeightKg, profile.proteinTargetG, profile.fatTargetG),
  );

  const [variation, setVariation] = useState<VariationDial>(profile.variation);
  const [allergies, setAllergies] = useState<Allergen[]>(profile.allergies);
  const [pantry, setPantry] = useState<string[]>(profile.pantry);

  const clampBudget = (v: number) => Math.max(1400, Math.min(4000, v)); // ED floor guardrail
  const computed = dailyBudget({ weightKg: currentKg, heightCm, age, sex, activity, goal: goalV, rateKgPerWeek: rate });
  // Budget recomputes only here (render), and lands on Save — no background drift.
  const finalBudget = customBudget ? clampBudget(Math.round(budget)) : computed.target;
  const grams = pctToGrams(macroPct, finalBudget);

  const toggleAllergen = (a: Allergen) => setAllergies((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));
  const togglePantry = (token: string) => setPantry((xs) => (xs.includes(token) ? xs.filter((x) => x !== token) : [...xs, token]));
  const pantryOptions = (() => {
    const labels = new Map<string, string>();
    for (const p of PANTRY_STAPLES) labels.set(p.toLowerCase(), p);
    for (const t of profile.pantry) if (!labels.has(t)) labels.set(t, cap(t));
    return [...labels.entries()].map(([token, label]) => ({ token, label }));
  })();

  const save = () => {
    const newPrefs: GoalPrefs = { heightCm, age, sex, activity, rateKgPerWeek: rate, macroPct, customBudget };
    onSave(
      {
        ...profile,
        budgetKcal: finalBudget || profile.budgetKcal,
        proteinTargetG: grams.proteinG,
        carbTargetG: grams.carbsG,
        fatTargetG: grams.fatG,
        variation,
        allergies,
        pantry,
      },
      goalV,
      newPrefs,
    );
    onClose();
  };

  // ── small building blocks ───────────────────────────────────────────────────
  const StepBtn = ({ label, onPress, a11yLabel }: { label: string; onPress: () => void; a11yLabel: string }) => (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={a11yLabel} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  function Seg<T extends string>({ items, value, onChange, a11y }: { items: { v: T; label: string }[]; value: T; onChange: (v: T) => void; a11y: string }) {
    return (
      <View style={{ marginTop: 8, flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 999, padding: 4 }}>
        {items.map((it) => {
          const on = value === it.v;
          return (
            <Pressable key={it.v} onPress={() => onChange(it.v)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${a11y} ${it.label}`} style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
              <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const selectChip = (label: string, on: boolean, onPress: () => void, k: string) => (
    <Pressable key={k} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ backgroundColor: on ? c('accent') : c('surface'), borderColor: on ? c('accent') : c('border'), borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
      <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const subLabel = (t: string) => <Text style={{ color: c('textMuted'), fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 14 }}>{t}</Text>;

  const macroRow = (key: keyof MacroPct, label: string, gramsVal: number) => (
    <View style={{ marginTop: 8, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <StepBtn label="−" a11yLabel={`Decrease ${label}`} onPress={() => setMacroPct((m) => rebalanceMacroPct(m, key, m[key] - 1))} />
      <View style={{ alignItems: 'center' }}>
        <Text>
          <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{macroPct[key]}</Text>
          <Text style={{ color: c('textMuted'), fontSize: 14 }}>% {label}</Text>
        </Text>
        <Text style={[{ color: c('textMuted'), fontSize: 12, marginTop: 2 }, num]}>{gramsVal} g</Text>
      </View>
      <StepBtn label="＋" a11yLabel={`Increase ${label}`} onPress={() => setMacroPct((m) => rebalanceMacroPct(m, key, m[key] + 1))} />
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
          {/* back header (Overview pattern) */}
          <View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Progress" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('accentSoft'), fontSize: 22, fontWeight: '600', marginTop: -2 }}>‹</Text>
              <Text style={{ color: c('accentSoft'), fontSize: 15, fontWeight: '600' }}>Progress</Text>
            </Pressable>
            <Kicker>Make it yours</Kicker>
            <Serif size={34} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Settings</Serif>
          </View>

          {/* Go Premium */}
          <Pressable onPress={() => setShowPaywall(true)} style={{ backgroundColor: c('accentFaint'), borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: c('accentSoft'), fontSize: 15, fontWeight: '700' }}>{isPremium ? 'Premium' : 'Go Premium'}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>{isPremium ? 'Active — thank you' : 'Full menu · weekly regen · coach insights'}</Text>
            </View>
            <Text style={{ color: c('accentSoft'), fontSize: 20 }}>›</Text>
          </Pressable>

          {/* ── Goal ───────────────────────────────────────────────────────────── */}
          <View style={{ marginTop: 8 }}>
            <Kicker>Goal</Kicker>
            {customBudget ? (
              <>
                <View style={{ marginTop: 8, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <StepBtn label="−" a11yLabel="Decrease daily budget" onPress={() => setBudget((b) => clampBudget(b - 50))} />
                  <Text>
                    <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{clampBudget(Math.round(budget)).toLocaleString()}</Text>
                    <Text style={{ color: c('textMuted'), fontSize: 14 }}> kcal / day</Text>
                  </Text>
                  <StepBtn label="＋" a11yLabel="Increase daily budget" onPress={() => setBudget((b) => clampBudget(b + 50))} />
                </View>
                {prefs == null ? (
                  <Text style={{ color: c('textMuted'), fontSize: 12.5, marginTop: 8 }}>Set a goal-based budget for a target that follows your body and pace.</Text>
                ) : null}
                <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <TextLink label="Use a goal-based budget" tone="positive" onPress={() => setCustomBudget(false)} />
                </View>
              </>
            ) : (
              <>
                <Seg items={GOAL_OPTS} value={goalV} onChange={setGoalV} a11y="Goal" />
                {goalV !== 'maintain' ? (
                  <>
                    {subLabel('Pace')}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                      {RATE_PRESETS.map((rp) => selectChip(rp.label, rate === rp.rate, () => setRate(rp.rate), String(rp.rate)))}
                    </View>
                  </>
                ) : null}

                {subLabel('Activity')}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                  {ACTIVITIES.map((a) => selectChip(ACTIVITY_LABEL[a], activity === a, () => setActivity(a), a))}
                </View>

                {subLabel('About you')}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <NumberField label="Height" value={heightCm} onChange={(n) => setHeightCm(Math.round(n))} suffix="cm" />
                  <NumberField label="Age" value={age} onChange={(n) => setAge(Math.round(n))} />
                </View>
                <View style={{ marginTop: 8 }}>
                  <Seg items={SEX_OPTS} value={sex} onChange={setSex} a11y="Sex" />
                </View>
                <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 10 }}>Using your last weigh-in · {kgToDisplay(currentKg, unit)}</Text>

                {/* computed budget card */}
                <View style={{ marginTop: 12, backgroundColor: c('accentFaint'), borderRadius: 16, padding: 14 }}>
                  <Text>
                    <Text style={[{ color: c('textPrimary'), fontSize: 22, fontWeight: '800' }, num]}>{computed.target.toLocaleString()}</Text>
                    <Text style={{ color: c('textMuted'), fontSize: 14 }}> kcal / day</Text>
                  </Text>
                  <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 4 }, num]}>
                    ≈ {computed.tdee.toLocaleString()} maintenance{goalV === 'maintain' ? '' : goalV === 'lose' ? ` − ${Math.abs(computed.dailyDelta)}` : ` + ${computed.dailyDelta}`}
                  </Text>
                  {computed.floored ? (
                    <Text style={{ color: c('textSecondary'), fontSize: 12.5, marginTop: 6 }}>Held at {computed.floor.toLocaleString()} kcal — a gentler pace gets there too.</Text>
                  ) : null}
                  {goalV === 'gain' && rate >= 0.75 ? (
                    <Text style={{ color: c('textMuted'), fontSize: 12.5, marginTop: 6 }}>Slower gaining keeps more of each kilo as muscle.</Text>
                  ) : null}
                </View>
                <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <TextLink label="Set calories manually" tone="neutral" onPress={() => { setBudget(computed.target); setCustomBudget(true); }} />
                </View>
              </>
            )}
          </View>

          {/* ── Daily targets (macro %) ────────────────────────────────────────── */}
          <View style={{ marginTop: 8 }}>
            <Kicker>Daily targets</Kicker>
            {macroRow('protein', 'protein', grams.proteinG)}
            {macroRow('carbs', 'carbs', grams.carbsG)}
            {macroRow('fat', 'fat', grams.fatG)}
            <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>= 100% · Protein drives your menu; carbs and fat are guides.</Text>
          </View>

          {/* Weight unit — persists immediately (not part of Save) */}
          <View style={{ marginTop: 8 }}>
            <Kicker>Weight unit</Kicker>
            <View style={{ marginTop: 8, flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 999, padding: 4 }}>
              {WEIGHT_UNITS.map((wu) => {
                const on = unit === wu.u;
                return (
                  <Pressable key={wu.u} onPress={() => setUnit(wu.u)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Weight unit ${wu.label}`} style={{ flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
                    <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{wu.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Variety */}
          <View style={{ marginTop: 8 }}>
            <Kicker>Variety</Kicker>
            <Seg items={VARIATIONS.map((v) => ({ v: v.v, label: v.label }))} value={variation} onChange={setVariation} a11y="Variety" />
            <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>{VARIETY_HINT[variation]}</Text>
          </View>

          {/* Pantry */}
          <View style={{ marginTop: 8 }}>
            <Kicker>Pantry staples</Kicker>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
              {pantryOptions.map((p) => (
                <Chip key={p.token} label={p.label} selected={pantry.includes(p.token)} onPress={() => togglePantry(p.token)} />
              ))}
            </View>
          </View>

          {/* Allergies */}
          <View style={{ marginTop: 8 }}>
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

        <View style={{ padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: c('border'), backgroundColor: c('bg') }}>
          <PrimaryButton label="Save changes" onPress={save} full />
        </View>
      </View>

      {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
    </Modal>
  );
}
