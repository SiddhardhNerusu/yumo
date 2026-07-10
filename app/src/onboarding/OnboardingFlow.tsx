import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  dailyBudget,
  ACTIVITY_LABEL,
  type ActivityTier,
  type Goal,
  type Sex,
  type Allergen,
  ALLERGENS,
} from '@yumo/shared';
import type { UserProfile, VariationDial } from '@yumo/menu';
import { useTheme } from '../theme';
import { Screen, PrimaryButton, Choice, NumberField, ProgressDots } from '../ui/primitives';
import { Bubbles } from './Bubbles';
import { BUBBLE_FOODS, CUISINES, ALLERGEN_LABELS } from '../data/onboarding-seed';
import { getBubbles } from '../data/repo';
import { track } from '../analytics';

interface OnbState {
  goal: Goal;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityTier;
  rateKgPerWeek: number;
  needs: string[];
  likes: string[];
  hates: string[];
  allergies: Allergen[];
  variation: VariationDial;
  cuisines: string[];
  notifOptIn: boolean;
  healthOptIn: boolean;
}

const DEFAULT: OnbState = {
  goal: 'lose',
  weightKg: 75,
  heightCm: 175,
  age: 30,
  sex: 'male',
  activity: 'onfeet',
  rateKgPerWeek: 0.5,
  needs: [],
  likes: [],
  hates: [],
  allergies: [],
  variation: 'balanced',
  cuisines: [],
  notifOptIn: true,
  healthOptIn: true,
};

const RATE_PRESETS: { rate: number; label: string }[] = [
  { rate: 0.25, label: 'Gentle · 0.25 kg/wk' },
  { rate: 0.5, label: 'Steady · 0.5 kg/wk' },
  { rate: 0.75, label: 'Focused · 0.75 kg/wk' },
  { rate: 1.0, label: 'Fast · 1 kg/wk' },
];

const GOALS: { goal: Goal; label: string; sub: string }[] = [
  { goal: 'lose', label: 'Lose weight', sub: 'A gentle, sustainable deficit' },
  { goal: 'maintain', label: 'Maintain', sub: 'Hold steady, eat well' },
  { goal: 'gain', label: 'Gain', sub: 'Build with a surplus' },
];

const VARIATIONS: { v: VariationDial; label: string; sub: string }[] = [
  { v: 'habit', label: 'Creature of habit', sub: 'Same favourites on repeat' },
  { v: 'balanced', label: 'Balanced', sub: 'A comfortable mix' },
  { v: 'mixup', label: 'Mix it up', sub: 'Keep it fresh and varied' },
];

function stepsFor(goal: Goal): string[] {
  return [
    'welcome',
    'goal',
    'body',
    'activity',
    ...(goal !== 'maintain' ? ['rate'] : []),
    'reveal',
    'needs',
    'likes',
    'hates',
    'allergies',
    'variation',
    'cuisine',
    'menu',
    'asks',
  ];
}

export function OnboardingFlow({ onDone }: { onDone: (profile: UserProfile, goal: Goal) => void }) {
  const { c, radius } = useTheme();
  const [s, setS] = useState<OnbState>(DEFAULT);
  const [index, setIndex] = useState(0);
  const [showMath, setShowMath] = useState(false);
  const [foodOptions, setFoodOptions] = useState<string[]>(BUBBLE_FOODS);

  useEffect(() => {
    let alive = true;
    getBubbles().then((o) => {
      if (alive) setFoodOptions(o);
    });
    return () => {
      alive = false;
    };
  }, []);

  const patch = (p: Partial<OnbState>) => setS((prev) => ({ ...prev, ...p }));
  const toggle = (key: 'needs' | 'likes' | 'hates' | 'cuisines', value: string) =>
    setS((prev) => {
      const list = prev[key];
      return { ...prev, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
    });

  const steps = stepsFor(s.goal);
  const key = steps[index];
  const budget = dailyBudget({
    weightKg: s.weightKg,
    heightCm: s.heightCm,
    age: s.age,
    sex: s.sex,
    activity: s.activity,
    goal: s.goal,
    rateKgPerWeek: s.rateKgPerWeek,
  });

  const finish = () => {
    const profile: UserProfile = {
      budgetKcal: budget.target,
      targetWeightKg: s.weightKg,
      allergies: s.allergies,
      hates: s.hates.map((x) => x.toLowerCase()),
      needs: s.needs.map((x) => x.toLowerCase()),
      likes: s.likes.map((x) => x.toLowerCase()),
      pantry: [],
      variation: s.variation,
      cuisineLean: Object.fromEntries(s.cuisines.map((x) => [x, 1.5])),
    };
    track('onboard_completed');
    onDone(profile, s.goal);
  };

  const bodyValid = s.weightKg > 0 && s.heightCm > 0 && s.age > 0;
  const canContinue = key === 'body' ? bodyValid : true;

  const next = () => {
    if (index >= steps.length - 1) finish();
    else setIndex((i) => i + 1);
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const continueLabel =
    key === 'welcome' ? 'Get started' : key === 'asks' ? 'Start tracking' : key === 'reveal' ? 'Looks right' : 'Continue';

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      {index > 0 ? <View style={{ paddingTop: 56 }}><ProgressDots count={steps.length - 1} index={index - 1} /></View> : null}
      {renderStep()}
    </View>
  );

  function renderStep() {
    const footer = (
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {index > 0 ? (
          <Pressable onPress={back} style={{ paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, borderColor: c('border') }}>
            <Text style={{ color: c('textSecondary'), fontWeight: '600' }}>Back</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <PrimaryButton label={continueLabel} onPress={next} disabled={!canContinue} />
        </View>
      </View>
    );

    switch (key) {
      case 'welcome':
        return (
          <Screen title="Welcome" subtitle="The calorie app that learns you. A minute of setup and we’ll build your day around what you actually eat." footer={footer}>
            <Text style={{ color: c('textSecondary'), fontSize: 15, lineHeight: 22 }}>
              No endless searching. We’ll just ask “the usual?” — and one tap logs it.
            </Text>
          </Screen>
        );

      case 'goal':
        return (
          <Screen title="What’s the goal?" footer={footer}>
            {GOALS.map((g) => (
              <Choice key={g.goal} label={g.label} sublabel={g.sub} selected={s.goal === g.goal} onPress={() => patch({ goal: g.goal })} />
            ))}
          </Screen>
        );

      case 'body':
        return (
          <Screen title="A bit about you" subtitle="So we can get your numbers right." footer={footer}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <NumberField label="Weight" value={s.weightKg} onChange={(n) => patch({ weightKg: n })} suffix="kg" />
              <NumberField label="Height" value={s.heightCm} onChange={(n) => patch({ heightCm: n })} suffix="cm" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <NumberField label="Age" value={s.age} onChange={(n) => patch({ age: n })} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c('textMuted'), fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Sex</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['male', 'female'] as Sex[]).map((sx) => (
                    <View key={sx} style={{ flex: 1 }}>
                      <Choice label={sx === 'male' ? 'Male' : 'Female'} selected={s.sex === sx} onPress={() => patch({ sex: sx })} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Screen>
        );

      case 'activity':
        return (
          <Screen title="How active are you?" footer={footer}>
            {(Object.keys(ACTIVITY_LABEL) as ActivityTier[]).map((t) => (
              <Choice key={t} label={ACTIVITY_LABEL[t]} selected={s.activity === t} onPress={() => patch({ activity: t })} />
            ))}
          </Screen>
        );

      case 'rate':
        return (
          <Screen title={s.goal === 'gain' ? 'How fast to gain?' : 'How fast to lose?'} subtitle="Gentler is easier to stick to." footer={footer}>
            {RATE_PRESETS.map((r) => (
              <Choice key={r.rate} label={r.label} selected={s.rateKgPerWeek === r.rate} onPress={() => patch({ rateKgPerWeek: r.rate })} />
            ))}
          </Screen>
        );

      case 'reveal':
        return (
          <Screen title="Your daily number" footer={footer}>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: c('accent'), fontSize: 64, fontWeight: '800', letterSpacing: -1 }}>{budget.target.toLocaleString()}</Text>
              <Text style={{ color: c('textSecondary'), fontSize: 15 }}>kcal per day</Text>
            </View>
            <Pressable onPress={() => setShowMath((m) => !m)}>
              <Text style={{ color: c('accent'), fontWeight: '600', textAlign: 'center' }}>{showMath ? 'Hide the maths' : 'How did we get this?'}</Text>
            </Pressable>
            {showMath ? (
              <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 16, gap: 8 }}>
                {[
                  ['Base metabolism (BMR)', `${budget.bmr.toLocaleString()} kcal`],
                  [`× activity`, `${budget.tdee.toLocaleString()} kcal`],
                  [s.goal === 'lose' ? '− deficit' : s.goal === 'gain' ? '+ surplus' : 'maintain', `${budget.dailyDelta === 0 ? '—' : Math.abs(budget.dailyDelta).toLocaleString() + ' kcal'}`],
                ].map(([k2, v2], i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: c('textSecondary'), fontSize: 14 }}>{k2}</Text>
                    <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{v2}</Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: c('border'), marginVertical: 2 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '700' }}>Your target</Text>
                  <Text style={{ color: c('accent'), fontSize: 15, fontWeight: '700' }}>{budget.target.toLocaleString()} kcal</Text>
                </View>
              </View>
            ) : null}
            {budget.edSignpost ? (
              <View style={{ backgroundColor: c('accentSubtle'), borderRadius: radius.md, padding: 14 }}>
                <Text style={{ color: c('accentSubtleText'), fontSize: 13, lineHeight: 19 }}>
                  We’ve set a gentle floor of {budget.floor.toLocaleString()} kcal — going lower isn’t safe. If food feels hard right now, support is here: beateatingdisorders.org.uk.
                </Text>
              </View>
            ) : null}
          </Screen>
        );

      case 'needs':
        return (
          <Screen title="Can’t live without…" subtitle="Pick up to 3 — we’ll work these into most days." footer={footer}>
            <Bubbles options={foodOptions} selected={s.needs} onToggle={(v) => toggle('needs', v)} max={3} />
          </Screen>
        );

      case 'likes':
        return (
          <Screen title="Foods you like" subtitle="We’ll lean towards these." footer={footer}>
            <Bubbles options={foodOptions} selected={s.likes} onToggle={(v) => toggle('likes', v)} max={12} />
          </Screen>
        );

      case 'hates':
        return (
          <Screen title="Never suggest…" subtitle="We’ll keep these off your plate entirely." footer={footer}>
            <Bubbles options={foodOptions} selected={s.hates} onToggle={(v) => toggle('hates', v)} />
          </Screen>
        );

      case 'allergies':
        return (
          <Screen title="Any allergies?" subtitle="We never suggest these — and flag them on anything composite. Always check labels." footer={footer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ALLERGENS.map((a) => {
                const sel = s.allergies.includes(a);
                return (
                  <View key={a}>
                    <Choice
                      label={ALLERGEN_LABELS[a]}
                      selected={sel}
                      onPress={() => patch({ allergies: sel ? s.allergies.filter((x) => x !== a) : [...s.allergies, a] })}
                    />
                  </View>
                );
              })}
            </View>
          </Screen>
        );

      case 'variation':
        return (
          <Screen title="How much variety?" footer={footer}>
            {VARIATIONS.map((v) => (
              <Choice key={v.v} label={v.label} sublabel={v.sub} selected={s.variation === v.v} onPress={() => patch({ variation: v.v })} />
            ))}
          </Screen>
        );

      case 'cuisine':
        return (
          <Screen title="Any cuisines you lean towards?" subtitle="Optional — we’ll weight your menu this way." footer={footer}>
            <Bubbles options={CUISINES} selected={s.cuisines} onToggle={(v) => toggle('cuisines', v)} />
          </Screen>
        );

      case 'menu':
        return (
          <Screen title="Your menu’s ready" footer={footer}>
            <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 18, gap: 10 }}>
              <Text style={{ color: c('textPrimary'), fontSize: 16, lineHeight: 24 }}>
                {s.needs.length ? `${s.needs.join(', ')} worked in most days. ` : ''}
                {s.hates.length ? `No ${s.hates.join(', ')}, ever. ` : ''}
                {`Around ${budget.target.toLocaleString()} kcal a day.`}
              </Text>
              {s.cuisines.length ? <Text style={{ color: c('textSecondary'), fontSize: 14 }}>Leaning {s.cuisines.join(', ')}.</Text> : null}
            </View>
          </Screen>
        );

      case 'asks':
      default:
        return (
          <Screen title="Two quick things" subtitle="Both optional — and you can change them any time." footer={footer}>
            <Choice
              label="Nudge me when it’s time to eat"
              sublabel="This is how one-tap logging works — “the usual?” from your lock screen."
              selected={s.notifOptIn}
              onPress={() => patch({ notifOptIn: !s.notifOptIn })}
            />
            <Choice
              label="Read my steps & workouts"
              sublabel="From Apple Health / Health Connect. Adjusts your budget on active days."
              selected={s.healthOptIn}
              onPress={() => patch({ healthOptIn: !s.healthOptIn })}
            />
          </Screen>
        );
    }
  }
}
