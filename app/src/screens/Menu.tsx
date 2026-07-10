import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { UserProfile, WeekMenuPlan, MenuRecipe } from '@usual/menu';
import type { MealSlot } from '@usual/shared';
import { useTheme } from '../theme';
import { getMenu, getMixup, getRecipeSteps, type Source } from '../data/repo';
import { RecipeSheet } from '../components/RecipeSheet';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function Menu({ profile }: { profile: UserProfile }) {
  const { c, radius } = useTheme();
  const [plan, setPlan] = useState<WeekMenuPlan | null>(null);
  const [source, setSource] = useState<Source>('local');
  const [dayIdx, setDayIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, MenuRecipe>>({});
  const [mixOpen, setMixOpen] = useState<string | null>(null);
  const [alts, setAlts] = useState<Record<string, MenuRecipe[]>>({});
  const [sheet, setSheet] = useState<{ name: string; steps: string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    getMenu(profile).then((r) => {
      if (alive) {
        setPlan(r.plan);
        setSource(r.source);
      }
    });
    return () => {
      alive = false;
    };
  }, [profile]);

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: c('bg'), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c('accent')} />
      </View>
    );
  }

  const day = plan.days[dayIdx]!;
  const currentFor = (slot: MealSlot): { recipe: MenuRecipe; kcal: number } | null => {
    const key = `${dayIdx}:${slot}`;
    const ov = overrides[key];
    if (ov) return { recipe: ov, kcal: Math.round(ov.perServing.kcal) };
    const pick = day.picks.find((p) => p.slot === slot);
    return pick ? { recipe: pick.recipe, kcal: Math.round(pick.kcal) } : null;
  };
  const dayTotal = SLOTS.reduce((sum, s) => sum + (currentFor(s)?.kcal ?? 0), 0);

  const openMix = (key: string, recipe: MenuRecipe, slot: MealSlot) => {
    const opening = mixOpen !== key;
    setMixOpen(opening ? key : null);
    if (opening && !alts[key]) getMixup(recipe, slot, profile).then((a) => setAlts((p) => ({ ...p, [key]: a })));
  };
  const openRecipe = (recipe: MenuRecipe) =>
    getRecipeSteps(recipe).then((steps) => setSheet({ name: recipe.name, steps }));

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 32 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Menu</Text>
        <Text style={{ color: c('textMuted'), fontSize: 12, marginBottom: 12 }}>
          {source === 'server' ? 'from your catalogue' : 'offline preview'}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {plan.days.map((d, i) => (
            <Pressable
              key={i}
              onPress={() => { setDayIdx(i); setMixOpen(null); }}
              style={{ width: 46, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: i === dayIdx ? c('accent') : c('surface'), borderWidth: 1, borderColor: i === dayIdx ? c('accent') : c('border') }}
            >
              <Text style={{ color: i === dayIdx ? c('accentText') : c('textMuted'), fontSize: 11, fontWeight: '600' }}>{DOW[d.dayOfWeek]}</Text>
              <Text style={{ color: i === dayIdx ? c('accentText') : c('textPrimary'), fontSize: 17, fontWeight: '700', marginTop: 2 }}>{i + 1}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={{ color: c('textSecondary'), fontSize: 13, marginTop: 14, marginBottom: 10 }}>
          {dayTotal.toLocaleString()} kcal planned
        </Text>

        <View style={{ gap: 12 }}>
          {SLOTS.map((slot) => {
            const cur = currentFor(slot);
            if (!cur) return null;
            const key = `${dayIdx}:${slot}`;
            const showing = mixOpen === key;
            const these = alts[key];
            return (
              <View key={slot} style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 16 }}>
                <Text style={{ color: c('textMuted'), fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cap(slot)}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                  <Text style={{ color: c('textPrimary'), fontSize: 17, fontWeight: '700', flex: 1 }}>{cur.recipe.name}</Text>
                  <Text style={{ color: c('textSecondary'), fontSize: 14, marginLeft: 8 }}>{cur.kcal} kcal</Text>
                </View>
                <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 2 }}>{cur.recipe.cuisine} · {cur.recipe.effort}</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <Pressable onPress={() => openMix(key, cur.recipe, slot)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: c('accentSubtle') }}>
                    <Text style={{ color: c('accentSubtleText'), fontWeight: '600', fontSize: 13 }}>{showing ? 'Close' : 'Mix it up'}</Text>
                  </Pressable>
                  <Pressable onPress={() => openRecipe(cur.recipe)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c('border') }}>
                    <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 13 }}>Recipe</Text>
                  </Pressable>
                </View>

                {showing ? (
                  <View style={{ marginTop: 12, gap: 6 }}>
                    {these === undefined ? (
                      <ActivityIndicator color={c('accent')} />
                    ) : these.length === 0 ? (
                      <Text style={{ color: c('textMuted'), fontSize: 13 }}>No close alternative right now.</Text>
                    ) : (
                      <>
                        <Text style={{ color: c('textMuted'), fontSize: 12 }}>Swap for:</Text>
                        {these.map((alt) => (
                          <Pressable
                            key={alt.id}
                            onPress={() => { setOverrides((o) => ({ ...o, [key]: alt })); setMixOpen(null); }}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c('surfaceSunken'), padding: 12, borderRadius: radius.md }}
                          >
                            <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{alt.name}</Text>
                            <Text style={{ color: c('textMuted'), fontSize: 13 }}>{Math.round(alt.perServing.kcal)} kcal</Text>
                          </Pressable>
                        ))}
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <RecipeSheet recipe={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
