import { useState, useEffect } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
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
import { BubbleCloud } from './BubbleCloud';
import { FOOD_PARENTS } from '../data/food-graph';
import { BUBBLE_FOODS, CUISINES, PANTRY_STAPLES, ALLERGEN_LABELS } from '../data/onboarding-seed';
import { getCuisines } from '../data/repo';
import { coach } from '../coach/pack';
import { track } from '../analytics';

/** §2.1 cuisine lean weights (heavy / light) — cycled by tapping a cuisine chip. */
const LEAN_HEAVY = 1.5;
const LEAN_LIGHT = 0.5;

interface OnbState {
  goal: Goal;
  formerlyFit: boolean;
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
  pantry: string[];
  variation: VariationDial;
  cuisineLean: Record<string, number>;
  notifOptIn: boolean;
  healthOptIn: boolean;
}

const DEFAULT: OnbState = {
  goal: 'lose',
  formerlyFit: false,
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
  pantry: [],
  variation: 'balanced',
  cuisineLean: {},
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
    'pantry',
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
  // Onboarding bubbles use the curated local list — clean whole-food names,
  // shown instantly. (The server bubble endpoint currently tokenizes ingredient
  // names into fragments like "Oil"/"Breast"; not used here until it's fixed.)
  const foodOptions = BUBBLE_FOODS;

  // §4.2 / decision 5: cuisine chips are data-driven from the live catalogue.
  const [cuisineOptions, setCuisineOptions] = useState<string[]>(CUISINES);
  useEffect(() => {
    let alive = true;
    getCuisines().then((cs) => alive && cs.length && setCuisineOptions(cs));
    return () => {
      alive = false;
    };
  }, []);

  const patch = (p: Partial<OnbState>) => setS((prev) => ({ ...prev, ...p }));
  const toggle = (key: 'needs' | 'likes' | 'hates' | 'pantry', value: string) =>
    setS((prev) => {
      const list = prev[key];
      return { ...prev, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
    });
  // Cuisine chip cycles: off → heavy → light → off (§2.1 light/heavy each).
  const cycleCuisine = (name: string) =>
    setS((prev) => {
      const cur = prev.cuisineLean[name];
      const next = { ...prev.cuisineLean };
      if (cur === undefined) next[name] = LEAN_HEAVY;
      else if (cur === LEAN_HEAVY) next[name] = LEAN_LIGHT;
      else delete next[name];
      return { ...prev, cuisineLean: next };
    });

  const steps = stepsFor(s.goal);
  const key = steps[index];

  // §10 per-step funnel events (onboard_step_*).
  useEffect(() => {
    if (key) track(`onboard_step_${key}`);
  }, [key]);
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
      pantry: s.pantry.map((x) => x.toLowerCase()),
      variation: s.variation,
      cuisineLean: s.cuisineLean,
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
            <View style={{ height: 8 }} />
            <Choice
              label="I used to be in shape"
              sublabel="We’ll pitch the coaching to someone getting back to it."
              selected={s.formerlyFit}
              onPress={() => patch({ formerlyFit: !s.formerlyFit })}
            />
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
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
              <Pressable onPress={() => setShowMath((m) => !m)}>
                <Text style={{ color: c('accent'), fontWeight: '600', textAlign: 'center' }}>{showMath ? 'Hide the maths' : 'How did we get this?'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  track('number_reveal_shared');
                  Share.share({ message: `My daily target is ${budget.target.toLocaleString()} kcal — worked out by Yumo.` }).catch(() => {});
                }}
              >
                <Text style={{ color: c('accent'), fontWeight: '600', textAlign: 'center' }}>Share</Text>
              </Pressable>
            </View>
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
          <Screen title="Can’t live without…" subtitle="Tap a food to see more like it. Pick up to 3." footer={footer}>
            <BubbleCloud parents={FOOD_PARENTS} selected={s.needs} onToggle={(v) => toggle('needs', v)} max={3} />
          </Screen>
        );

      case 'likes':
        return (
          <Screen title="Foods you like" subtitle="Tap to explore — we’ll lean towards these." footer={footer}>
            <BubbleCloud parents={FOOD_PARENTS} selected={s.likes} onToggle={(v) => toggle('likes', v)} max={12} />
          </Screen>
        );

      case 'hates':
        return (
          <Screen title="Never suggest…" subtitle="Tap to expand — we’ll keep these off your plate." footer={footer}>
            <BubbleCloud parents={FOOD_PARENTS} selected={s.hates} onToggle={(v) => toggle('hates', v)} />
          </Screen>
        );

      case 'allergies':
        return (
          <Screen title="Any allergies?" subtitle="We never suggest these and flag them on anything composite — but always check labels: we help, we don’t guarantee." footer={footer}>
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

      case 'pantry':
        return (
          <Screen title="What’s usually in?" subtitle="We’ll lean on what you’ve already got. Change it any time (“I did a shop”)." footer={footer}>
            <Bubbles options={PANTRY_STAPLES} selected={s.pantry} onToggle={(v) => toggle('pantry', v)} />
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
          <Screen title="Any cuisines you lean towards?" subtitle="Optional — tap once for more, twice for less." footer={footer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cuisineOptions.map((name) => {
                const lean = s.cuisineLean[name];
                const on = lean !== undefined;
                const heavy = lean === LEAN_HEAVY;
                return (
                  <Pressable
                    key={name}
                    onPress={() => cycleCuisine(name)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: on ? c('accent') : c('surface'),
                      borderWidth: 1,
                      borderColor: on ? c('accent') : c('border'),
                    }}
                  >
                    <Text style={{ color: on ? c('accentText') : c('textPrimary'), fontWeight: '600', fontSize: 14 }}>
                      {name}{on ? (heavy ? ' · more' : ' · less') : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Screen>
        );

      case 'menu': {
        const needsList = s.needs.join(', ');
        const hatesList = s.hates.join(', ');
        const reveal =
          s.needs.length || s.hates.length
            ? coach('mealReveal', { needs: needsList || 'your favourites', hates: hatesList || 'the stuff you hate', budget: budget.target.toLocaleString() })
            : coach('mealRevealPlain', { budget: budget.target.toLocaleString() });
        const leaning = Object.keys(s.cuisineLean);
        return (
          <Screen title="Your menu’s ready" footer={footer}>
            <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 18, gap: 10 }}>
              <Text style={{ color: c('textPrimary'), fontSize: 16, lineHeight: 24 }}>{reveal}</Text>
              {leaning.length ? <Text style={{ color: c('textSecondary'), fontSize: 14 }}>Leaning {leaning.join(', ')}.</Text> : null}
            </View>
          </Screen>
        );
      }

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
