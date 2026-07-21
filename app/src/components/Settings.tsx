import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Animated } from 'react-native';
import {
  ALLERGENS,
  dailyBudget,
  kgToDisplay,
  defaultMacroPct,
  balanceMacroPct,
  pctToGrams,
  MACRO_SLIDER,
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
import { ALLERGEN_LABELS } from '../data/onboarding-seed';
import { buildPantryRows } from '../data/pantryCousins';
import { Serif, PrimaryButton, TextLink, HAIRLINE_TOP } from './kit';
import { RangeSlider } from './RangeSlider';
import { useEntitlement } from '../data/entitlement';
import { Paywall } from './Paywall';
import { haptics } from '../haptics';

const num = { fontVariant: ['tabular-nums' as const] };

/** Accent at reduced opacity — keeps the one-accent ladder theme-correct (the
 * accent token differs light vs dark), instead of hardcoding a dark rgba. */
const withAlpha = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const GOAL_OPTS: { v: Goal; label: string }[] = [
  { v: 'lose', label: 'Lose' },
  { v: 'maintain', label: 'Maintain' },
  { v: 'gain', label: 'Gain' },
];
const SEX_OPTS: { v: Sex; label: string }[] = [
  { v: 'male', label: 'Male' },
  { v: 'female', label: 'Female' },
];
const WEIGHT_UNITS: { v: WeightUnit; label: string }[] = [
  { v: 'kg', label: 'kg' },
  { v: 'lb', label: 'lb' },
  { v: 'st', label: 'st' },
];
const VARIATIONS: { v: VariationDial; label: string }[] = [
  { v: 'habit', label: 'Habit' },
  { v: 'balanced', label: 'Balanced' },
  { v: 'mixup', label: 'Mix it up' },
];
const VARIETY_HINT: Record<VariationDial, string> = {
  habit: 'Mostly your usuals',
  balanced: 'Usuals + fresh ideas',
  mixup: 'Something new most days',
};
const ACTIVITY_TILES: { v: ActivityTier; title: string; sub: string }[] = [
  { v: 'desk', title: 'Mostly at a desk', sub: 'Little planned exercise' },
  { v: 'onfeet', title: 'On my feet a fair bit', sub: 'Walking through the day' },
  { v: 'active', title: 'Active most days', sub: 'Regular workouts' },
  { v: 'veryactive', title: 'Training hard', sub: 'Intense, most days' },
];
const RATE_WORD: Record<number, string> = { 0.25: 'Gentle', 0.5: 'Steady', 0.75: 'Focused', 1.0: 'Fast' };
const MACRO_ROWS: { key: keyof MacroPct; name: string; alpha: number }[] = [
  { key: 'protein', name: 'Protein', alpha: 1 },
  { key: 'carbs', name: 'Carbs', alpha: 0.55 },
  { key: 'fat', name: 'Fat', alpha: 0.28 },
];

// ── shared controls (module-level so inputs/sliders keep identity across renders) ──

function Seg<T extends string>({ items, value, onChange, a11y }: { items: { v: T; label: string }[]; value: T; onChange: (v: T) => void; a11y: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 999, padding: 3 }}>
      {items.map((it) => {
        const on = value === it.v;
        return (
          <Pressable key={it.v} onPress={() => onChange(it.v)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${a11y} ${it.label}`} style={{ flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
            <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Card({ kicker, summary, summaryTone = 'muted', right, children }: { kicker: string; summary?: string; summaryTone?: 'accent' | 'muted'; right?: ReactNode; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderTopColor: HAIRLINE_TOP, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>{kicker}</Text>
        {right ?? (summary ? <Text style={{ color: summaryTone === 'accent' ? c('accentSoft') : c('textMuted'), fontSize: 12, textAlign: 'right', flexShrink: 1 }} numberOfLines={1}>{summary}</Text> : null)}
      </View>
      {children}
    </View>
  );
}

function InlineField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  const { c } = useTheme();
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', height: 44, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingHorizontal: 12 }}>
      <Text style={{ color: c('textMuted'), fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => { setText(t); const n = parseInt(t.replace(/[^0-9]/g, ''), 10); if (Number.isFinite(n)) onChange(n); }}
        keyboardType="number-pad"
        accessibilityLabel={label}
        style={[{ flex: 1, minWidth: 0, textAlign: 'right', color: c('textPrimary'), fontSize: 16, fontWeight: '700', padding: 0 }, num]}
      />
      {suffix ? <Text style={{ color: c('textMuted'), fontSize: 12, marginLeft: 3 }}>{suffix}</Text> : null}
    </View>
  );
}

function ActivityTile({ title, sub, selected, onPress }: { title: string; sub: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={title} style={{ flexBasis: '48%', flexGrow: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: selected ? c('accentFaint') : c('surfaceSunken'), borderWidth: 1, borderColor: selected ? withAlpha(c('accent'), 0.55) : c('border') }}>
      <Text style={{ color: selected ? c('accentSoft') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: selected ? withAlpha(c('accentSoft'), 0.7) : c('textMuted'), fontSize: 11, marginTop: 2 }}>{sub}</Text>
    </Pressable>
  );
}

function MacroSliderRow({ name, pct, grams, fillAlpha, onChange }: { name: string; pct: number; grams: number; fillAlpha: number; onChange: (v: number) => void }) {
  const { c } = useTheme();
  const fill = fillAlpha >= 1 ? c('accent') : withAlpha(c('accent'), fillAlpha);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{name}</Text>
        <Text numberOfLines={1}>
          <Text style={[{ color: c('textPrimary'), fontSize: 13, fontWeight: '700' }, num]}>{pct}%</Text>
          <Text style={[{ color: c('textSecondary'), fontSize: 13 }, num]}> · {grams} g</Text>
        </Text>
      </View>
      <RangeSlider value={pct} min={MACRO_SLIDER.min} max={MACRO_SLIDER.max} step={1} onChange={onChange} fill={fill} track={c('ringTrack')} thumb={c('accent')} thumbBorder={c('surface')} a11yLabel={`${name} percent`} />
    </View>
  );
}

function MeterSeg({ pctOfDenom, color }: { pctOfDenom: number; color: string }) {
  const w = useRef(new Animated.Value(pctOfDenom)).current;
  useEffect(() => { Animated.timing(w, { toValue: pctOfDenom, duration: 200, useNativeDriver: false }).start(); }, [pctOfDenom, w]);
  return <Animated.View style={{ width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: color }} />;
}

function TotalMeter({ pct }: { pct: MacroPct }) {
  const { c } = useTheme();
  const denom = Math.max(pct.protein + pct.carbs + pct.fat, 100);
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden', flexDirection: 'row' }}>
      <MeterSeg pctOfDenom={(pct.protein / denom) * 100} color={c('accent')} />
      <MeterSeg pctOfDenom={(pct.carbs / denom) * 100} color={withAlpha(c('accent'), 0.55)} />
      <MeterSeg pctOfDenom={(pct.fat / denom) * 100} color={withAlpha(c('accent'), 0.28)} />
    </View>
  );
}

function FadeScaleIn({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [a]);
  return <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>{children}</Animated.View>;
}

function PantryChip({ label, selected, cousin, onPress }: { label: string; selected: boolean; cousin?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const bg = selected ? c('accent') : cousin ? c('accentSubtle') : c('surfaceSunken');
  const border = selected ? c('accent') : cousin ? withAlpha(c('accent'), 0.25) : c('border');
  const fg = selected ? c('accentText') : cousin ? c('accentSubtleText') : c('textSecondary');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
      <Text numberOfLines={1} style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

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

  const [goalV, setGoalV] = useState<Goal>(goal);
  const [rate, setRate] = useState<number>(prefs?.rateKgPerWeek ?? 0.5);
  const [activity, setActivity] = useState<ActivityTier>(prefs?.activity ?? 'onfeet');
  const [heightCm, setHeightCm] = useState<number>(prefs?.heightCm ?? 175);
  const [age, setAge] = useState<number>(prefs?.age ?? 30);
  const [sex, setSex] = useState<Sex>(prefs?.sex ?? 'male');
  const [customBudget, setCustomBudget] = useState<boolean>(prefs?.customBudget ?? prefs == null);
  const [budget, setBudget] = useState<number>(profile.budgetKcal);
  const [macroPct, setMacroPct] = useState<MacroPct>(
    prefs?.macroPct ?? defaultMacroPct(profile.budgetKcal, profile.targetWeightKg, profile.proteinTargetG, profile.fatTargetG),
  );
  const [variation, setVariation] = useState<VariationDial>(profile.variation);
  const [allergies, setAllergies] = useState<Allergen[]>(profile.allergies);
  const [pantry, setPantry] = useState<string[]>(profile.pantry);
  const [pantryQuery, setPantryQuery] = useState('');

  const clampBudget = (v: number) => Math.max(1400, Math.min(4000, v));
  const computed = dailyBudget({ weightKg: currentKg, heightCm, age, sex, activity, goal: goalV, rateKgPerWeek: rate });
  const finalBudget = customBudget ? clampBudget(Math.round(budget)) : computed.target;
  const grams = pctToGrams(macroPct, finalBudget);
  const macroTotal = macroPct.protein + macroPct.carbs + macroPct.fat;
  const atHundred = macroTotal === 100;

  const setMacro = (key: keyof MacroPct, v: number) => setMacroPct((m) => ({ ...m, [key]: v }));
  const toggleAllergen = (a: Allergen) => setAllergies((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));
  const togglePantry = (token: string) => { haptics.select(); setPantry((xs) => (xs.includes(token) ? xs.filter((x) => x !== token) : [...xs, token])); };

  const goalSummary = goalV === 'maintain' ? 'Holding steady' : `${goalV === 'lose' ? 'Losing' : 'Gaining'} ${rate} kg/wk`;

  const save = () => {
    if (!atHundred) return;
    const newPrefs: GoalPrefs = { heightCm, age, sex, activity, rateKgPerWeek: rate, macroPct, customBudget };
    onSave(
      { ...profile, budgetKcal: finalBudget || profile.budgetKcal, proteinTargetG: grams.proteinG, carbTargetG: grams.carbsG, fatTargetG: grams.fatG, variation, allergies, pantry },
      goalV,
      newPrefs,
    );
    onClose();
  };

  // ── pantry render model (base → fanned cousins → customs, or flat search) ──
  const { rows: pantryRows, freeAddToken } = buildPantryRows(pantry, pantryQuery);
  const addFreeStaple = () => { if (!freeAddToken) return; setPantry((xs) => (xs.includes(freeAddToken) ? xs : [...xs, freeAddToken])); setPantryQuery(''); haptics.select(); };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 24, gap: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Progress" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600', marginTop: -2 }}>‹</Text>
              <Text style={{ color: c('accentSoft'), fontSize: 14, fontWeight: '600' }}>Progress</Text>
            </Pressable>
            <Pressable onPress={() => setShowPaywall(true)} accessibilityRole="button" accessibilityLabel={isPremium ? 'Premium' : 'Go Premium'} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c('accentFaint'), borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
              {isPremium ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c('success') }} /> : null}
              <Text style={{ color: c('accentSoft'), fontSize: 12, fontWeight: '700' }}>{isPremium ? 'Premium' : 'Go Premium'}</Text>
            </Pressable>
          </View>
          <View>
            <Serif size={30} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5 }}>Settings</Serif>
            <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 2 }}>Your plan recalculates as you change things.</Text>
          </View>

          {/* Budget hero */}
          <View style={{ backgroundColor: c('accentFaint'), borderWidth: 1, borderColor: withAlpha(c('accent'), 0.18), borderRadius: 20, padding: 16, marginTop: 2 }}>
            <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>Your daily budget</Text>
            {customBudget ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Pressable onPress={() => setBudget((b) => clampBudget(b - 50))} hitSlop={6} accessibilityRole="button" accessibilityLabel="Decrease budget" style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '600' }}>−</Text></Pressable>
                  <Text>
                    <Serif size={40} weight="medium" color={c('textPrimary')} style={num}>{clampBudget(Math.round(budget)).toLocaleString()}</Serif>
                    <Text style={{ color: c('textSecondary'), fontSize: 14 }}> kcal / day</Text>
                  </Text>
                  <Pressable onPress={() => setBudget((b) => clampBudget(b + 50))} hitSlop={6} accessibilityRole="button" accessibilityLabel="Increase budget" style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '600' }}>＋</Text></Pressable>
                </View>
                <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <TextLink label="Use a goal-based budget" tone="positive" onPress={() => setCustomBudget(false)} />
                </View>
              </>
            ) : (
              <>
                <Text style={{ marginTop: 6 }}>
                  <Serif size={40} weight="medium" color={c('textPrimary')} style={num}>{computed.target.toLocaleString()}</Serif>
                  <Text style={{ color: c('textSecondary'), fontSize: 14 }}> kcal / day</Text>
                </Text>
                <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 4 }, num]}>
                  ≈ {computed.tdee.toLocaleString()} maintenance{goalV === 'maintain' ? '' : goalV === 'lose' ? ` − ${Math.abs(computed.dailyDelta)}` : ` + ${computed.dailyDelta}`}
                </Text>
                {computed.floored ? <Text style={{ color: c('textSecondary'), fontSize: 12.5, marginTop: 6 }}>Held at {computed.floor.toLocaleString()} kcal — a gentler pace gets there too.</Text> : null}
                <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <TextLink label="Set calories manually" tone="neutral" onPress={() => { setBudget(computed.target); setCustomBudget(true); }} />
                </View>
              </>
            )}
          </View>

          {/* Goal */}
          <Card kicker="Goal" summary={goalSummary} summaryTone="accent">
            <Seg items={GOAL_OPTS} value={goalV} onChange={setGoalV} a11y="Goal" />
            {goalV !== 'maintain' ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>Pace</Text>
                  <Text style={[{ color: c('textPrimary'), fontSize: 13, fontWeight: '700' }, num]}>{RATE_WORD[rate] ?? ''} · {rate} kg/wk</Text>
                </View>
                <RangeSlider value={rate} min={0.25} max={1.0} step={0.25} onChange={(v) => { if (v !== rate) { haptics.select(); setRate(v); } }} fill={c('accent')} track={c('ringTrack')} thumb={c('accent')} thumbBorder={c('surface')} a11yLabel="Weekly pace" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {RATE_PRESETS.map((rp) => <Text key={rp.rate} style={{ color: c('textMuted'), fontSize: 11 }}>{RATE_WORD[rp.rate]}</Text>)}
                </View>
              </View>
            ) : null}
            <View style={{ gap: 6 }}>
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>Activity</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {ACTIVITY_TILES.map((t) => <ActivityTile key={t.v} title={t.title} sub={t.sub} selected={activity === t.v} onPress={() => setActivity(t.v)} />)}
              </View>
            </View>
          </Card>

          {/* About you */}
          <Card kicker="About you" summary={`Last weigh-in · ${kgToDisplay(currentKg, unit)}`}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <InlineField label="Height" value={heightCm} onChange={(n) => setHeightCm(n)} suffix="cm" />
              <InlineField label="Age" value={age} onChange={(n) => setAge(n)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1.2 }}><Seg items={SEX_OPTS} value={sex} onChange={setSex} a11y="Sex" /></View>
              <View style={{ flex: 1 }}><Seg items={WEIGHT_UNITS} value={unit} onChange={setUnit} a11y="Weight unit" /></View>
            </View>
          </Card>

          {/* Daily targets */}
          <Card kicker="Daily targets" right={
            <View style={{ backgroundColor: atHundred ? c('successFaint') : c('warningFaint'), borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Text style={[{ color: atHundred ? c('success') : c('warning'), fontSize: 12, fontWeight: '700' }, num]}>= {macroTotal}%</Text>
            </View>
          }>
            {MACRO_ROWS.map((r) =><MacroSliderRow key={r.key} name={r.name} pct={macroPct[r.key]} grams={r.key === 'protein' ? grams.proteinG : r.key === 'carbs' ? grams.carbsG : grams.fatG} fillAlpha={r.alpha} onChange={(v) => setMacro(r.key, v)} />)}
            <TotalMeter pct={macroPct} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: c('textMuted'), fontSize: 12, flexShrink: 1 }}>
                {atHundred ? 'Protein drives your menu; carbs and fat are guides.' : macroTotal < 100 ? `${100 - macroTotal}% left to place` : `${macroTotal - 100}% over — ease one back`}
              </Text>
              {!atHundred ? <Pressable onPress={() => { haptics.select(); setMacroPct((m) => balanceMacroPct(m)); }} accessibilityRole="button" accessibilityLabel="Balance macros to 100 percent"><Text style={{ color: c('accentSoft'), fontSize: 12, fontWeight: '700' }}>Balance for me</Text></Pressable> : null}
            </View>
          </Card>

          {/* Your menu */}
          <Card kicker="Your menu" summary={VARIETY_HINT[variation]}>
            <Seg items={VARIATIONS} value={variation} onChange={setVariation} a11y="Variety" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>Pantry staples</Text>
              <Text style={{ color: c('accentSoft'), fontSize: 12, fontWeight: '600' }}>{pantry.length} in your pantry</Text>
            </View>
            <TextInput
              value={pantryQuery}
              onChangeText={setPantryQuery}
              placeholder="Search or add a staple…"
              placeholderTextColor={c('textMuted')}
              accessibilityLabel="Search or add a pantry staple"
              style={{ backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, fontSize: 14, color: c('textPrimary') }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {pantryRows.map((r) => (
                r.cousin
                  ? <FadeScaleIn key={r.token}><PantryChip label={r.label} selected={pantry.includes(r.token)} cousin onPress={() => togglePantry(r.token)} /></FadeScaleIn>
                  : <PantryChip key={r.token} label={r.label} selected={pantry.includes(r.token)} onPress={() => togglePantry(r.token)} />
              ))}
              {freeAddToken ? (
                <Pressable onPress={addFreeStaple} accessibilityRole="button" accessibilityLabel={`Add ${pantryQuery}`} style={{ borderWidth: 1, borderColor: c('borderStrong'), borderStyle: 'dashed', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
                  <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600' }}>＋ Add “{pantryQuery.trim()}”</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: c('textMuted'), fontSize: 11.5 }}>Tap a staple to add it — we’ll suggest close cousins.</Text>
          </Card>

          {/* Allergies */}
          <Card kicker="Allergies" summary={allergies.length ? `${allergies.length} avoided` : 'None'}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ALLERGENS.map((a) => <PantryChip key={a} label={ALLERGEN_LABELS[a]} selected={allergies.includes(a)} onPress={() => toggleAllergen(a)} />)}
            </View>
            <Text style={{ color: c('textMuted'), fontSize: 11.5 }}>We filter these out of every menu — but always check labels.</Text>
          </Card>

          {/* Start over */}
          {confirmReset ? (
            <View style={{ backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 16 }}>
              <Text style={{ color: c('textSecondary'), fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 14 }}>This deletes your profile and every logged meal. It can’t be undone.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setConfirmReset(false)} style={{ flex: 1, borderWidth: 1, borderColor: c('borderStrong'), borderRadius: 999, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: c('textSecondary'), fontSize: 14, fontWeight: '600' }}>Cancel</Text></Pressable>
                <Pressable onPress={onReset} style={({ pressed }) => ({ flex: 1, backgroundColor: c('danger'), opacity: pressed ? 0.85 : 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' })}><Text style={{ color: c('bg'), fontSize: 14, fontWeight: '700' }}>Delete everything</Text></Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmReset(true)} style={{ alignItems: 'center', paddingVertical: 16 }}>
              {({ pressed }) => <Text style={{ color: pressed ? c('danger') : c('textMuted'), fontSize: 13, fontWeight: '600' }}>Start over — clear profile &amp; logs</Text>}
            </Pressable>
          )}
        </ScrollView>

        {/* Pinned footer */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 34, borderTopWidth: 1, borderTopColor: c('border'), backgroundColor: c('bg') }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
            <Text style={[{ color: c('textMuted'), fontSize: 12, flexShrink: 1 }, num]} numberOfLines={1}>{finalBudget.toLocaleString()} kcal · P {grams.proteinG} · C {grams.carbsG} · F {grams.fatG} g</Text>
            {!atHundred ? <Text style={{ color: c('warning'), fontSize: 12, fontWeight: '600' }}>Macros must total 100%</Text> : null}
          </View>
          {atHundred ? (
            <PrimaryButton label="Save changes" onPress={save} full />
          ) : (
            <View style={{ backgroundColor: c('surfaceSunken'), borderRadius: 999, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: c('textMuted'), fontSize: 14, fontWeight: '700' }}>Make it 100% to save ({macroTotal}%)</Text>
            </View>
          )}
        </View>
      </View>

      {showPaywall ? <Paywall onClose={() => setShowPaywall(false)} /> : null}
    </Modal>
  );
}
