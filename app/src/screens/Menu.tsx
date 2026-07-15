import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { UserProfile, WeekMenuPlan, MenuRecipe } from '@yumo/menu';
import type { MealSlot } from '@yumo/shared';
import { logEvents, localParts } from '@yumo/brain';
import { useTheme } from '../theme';
import { getMenu, getMixup, getRecipeDetail, portionLabel, makePantryFit, type Source, type RecipeIngredientLine } from '../data/repo';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { learnedWeights, mixReason } from '../data/menuPrefs';
import { cookability, type Cookability } from '../data/cookability';
import { expiringItems, recipesUsingExpiring } from '../data/expiring';
import { POOL } from '../data/menu-seed';
import { RecipeSheet } from '../components/RecipeSheet';
import { MixSheet, type MixOption } from '../components/MixSheet';
import { Kitchen } from './Kitchen';
import { Serif, Kicker, Card, MixButton, OutlineButton, PrimaryButton, Skeleton, ACCENT_BORDER } from '../components/kit';
import { track } from '../analytics';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const num = { fontVariant: ['tabular-nums' as const] };

type Cur = { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number };

export function Menu({ profile }: { profile: UserProfile }) {
  const { c } = useTheme();
  const { events, logFood, recordMixupPick, thumbRecipe, thumbs } = useEventStore();
  const kitchen = useKitchen();
  const have = useMemo(() => kitchen.availableTokens(), [kitchen.items]); // eslint-disable-line react-hooks/exhaustive-deps
  // §7 tokens you're ≤2 short of (near-miss), for the "Just need: X" copy on mix options.
  const nearMissTokens = (r: MenuRecipe): string[] | undefined => {
    if (!have.size) return undefined;
    const cook = cookability(r, have);
    return cook.tier === 'oneShort' ? cook.missing.slice(0, 2) : undefined;
  };
  // §8/§9 boost recipes that use expiring items (waste-saver); empty mode also boosts all cook-now.
  const expiring = useMemo(() => expiringItems(kitchen.items, Date.now()), [kitchen.items]);
  const expiringLabels = useMemo(() => expiring.map((i) => i.label), [expiring]);
  const expiringKey = expiringLabels.join('|');
  const kitchenBoost = (on: boolean): string[] => {
    // §8 expiring boost is ALWAYS on (waste-saver, not toggle-gated); the toggle/empty
    // mode only adds the extra cook-now weighting on top (§7 / §9).
    const ids = new Set(recipesUsingExpiring(POOL, expiring));
    if (on || kitchen.emptyMode) for (const r of POOL) if (cookability(r, have).tier === 'now') ids.add(r.id);
    return [...ids];
  };
  const [plan, setPlan] = useState<WeekMenuPlan | null>(null);
  const [, setSource] = useState<Source>('local');
  const [dayIdx, setDayIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, MenuRecipe>>({});
  const [now] = useState(() => Date.now());
  // "Logged" is derived from the persisted event log (by recipe+slot, today), NOT
  // local state — so it survives the tab-switch remount and never double-logs.
  const loggedToday = useMemo(() => {
    const day = localParts(now, 0).epochDay;
    const set = new Set<string>();
    for (const e of logEvents(events)) {
      if (e.foodId && e.slot && localParts(e.ts, 0).epochDay === day) set.add(`${e.slot}:${e.foodId}`);
    }
    return set;
  }, [events, now]);
  const isLoggedNow = (slot: MealSlot, recipeId: string) => loggedToday.has(`${slot}:${recipeId}`);
  const [sheet, setSheet] = useState<{ name: string; kcal: number; steps: string[]; ingredients: RecipeIngredientLine[]; methods?: string[]; portion?: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showKitchen, setShowKitchen] = useState(false);
  const [fromKitchen, setFromKitchen] = useState(false);

  const toggleKitchen = () => {
    const next = !fromKitchen;
    setFromKitchen(next);
    const p = next ? { ...profile, pantry: [...have] } : profile;
    getMenu(p, undefined, kitchenBoost(next), next ? makePantryFit(have) : undefined, userWeights).then((r) => { setPlan(r.plan); setSource(r.source); });
  };

  const [mix, setMix] = useState<{ key: string; slot: MealSlot; recipe: MenuRecipe } | null>(null);
  const [mixOptions, setMixOptions] = useState<MixOption[]>([]);
  const [mixLoading, setMixLoading] = useState(false);

  const userWeights = useMemo(() => learnedWeights(events, now), [events, now]); // §8 learned taste

  useEffect(() => {
    let alive = true;
    getMenu(profile, undefined, kitchenBoost(fromKitchen), fromKitchen ? makePantryFit(have) : undefined, userWeights).then((r) => {
      if (!alive) return;
      setPlan(r.plan);
      setSource(r.source);
      const todayDow = new Date().getDay();
      const idx = r.plan.days.findIndex((d) => d.dayOfWeek === todayDow);
      setDayIdx(idx >= 0 ? idx : 0);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, kitchen.emptyMode, expiringKey]);

  const planNextWeek = () => {
    setRegenerating(true);
    track('menu_regenerated');
    getMenu(profile, `week-${Date.now()}`, kitchenBoost(fromKitchen), fromKitchen ? makePantryFit(have) : undefined, userWeights)
      .then((r) => {
        setPlan(r.plan);
        setSource(r.source);
        setDayIdx(0);
        setOverrides({});
      })
      .finally(() => setRegenerating(false));
  };

  const planRecipeIds = useMemo(() => (plan ? plan.days.flatMap((d) => d.picks.map((p) => p.recipe.id)) : []), [plan]);

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
          <Kicker>This week</Kicker>
          <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2, marginBottom: 20 }}>Menu</Serif>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 22 }}>
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} height={54} radius={14} style={{ flex: 1 }} />)}
          </View>
          <Skeleton width="45%" height={16} style={{ marginBottom: 18 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <Skeleton height={132} radius={20} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const day = plan.days[dayIdx]!;
  const macrosFor = (recipe: MenuRecipe, kcal: number) => {
    const f = recipe.perServing.kcal > 0 ? kcal / recipe.perServing.kcal : 1;
    return {
      protein: Math.round(recipe.perServing.protein_g * f),
      carbs: Math.round((recipe.perServing.carbs_g ?? 0) * f),
      fat: Math.round((recipe.perServing.fat_g ?? 0) * f),
    };
  };
  const currentFor = (slot: MealSlot): Cur | null => {
    const key = `${dayIdx}:${slot}`;
    const ov = overrides[key];
    if (ov) {
      const kcal = Math.round(ov.perServing.kcal);
      return { recipe: ov, kcal, ...macrosFor(ov, kcal), portionScale: 1 };
    }
    const pick = day.picks.find((p) => p.slot === slot);
    if (!pick) return null;
    const kcal = Math.round(pick.kcal);
    return { recipe: pick.recipe, kcal, ...macrosFor(pick.recipe, kcal), portionScale: pick.portionScale };
  };
  const dayTotal = SLOTS.reduce((sum, s) => sum + (currentFor(s)?.kcal ?? 0), 0);
  const loggedCount = SLOTS.filter((s) => { const cur = currentFor(s); return cur ? isLoggedNow(s, cur.recipe.id) : false; }).length;

  const openMix = (key: string, recipe: MenuRecipe, slot: MealSlot) => {
    setMix({ key, slot, recipe });
    setMixOptions([]);
    setMixLoading(true);
    track('mixup_opened');
    getMixup(recipe, slot, profile, { boostIds: kitchenBoost(fromKitchen), recentlyUsed: planRecipeIds, pantryFit: fromKitchen ? makePantryFit(have) : undefined, userWeights })
      .then((alts) => setMixOptions(alts.map((r) => ({ recipe: r, reason: mixReason(r, profile, expiringLabels), missing: nearMissTokens(r) }))))
      .finally(() => setMixLoading(false));
  };
  const pickMix = (alt: MenuRecipe) => {
    if (!mix) return;
    recordMixupPick(alt.id, mix.recipe.id, mix.slot);
    setOverrides((o) => ({ ...o, [mix.key]: alt }));
    setMix(null);
  };

  const logMeal = (slot: MealSlot, cur: Cur) => {
    if (isLoggedNow(slot, cur.recipe.id)) return; // already logged today — guard against double-log
    logFood(cur.recipe.id, { slot, kcal: cur.kcal, proteinG: cur.protein, carbsG: cur.carbs, fatG: cur.fat, name: cur.recipe.name, source: 'menu', taps: 1 });
    kitchen.decrementForRecipe(cur.recipe); // §6 auto-decrement the pantry
    track('menu_accepted', { recipeId: cur.recipe.id, slot });
  };
  const openRecipe = (cur: Cur) => {
    const s = Math.max(0.5, Math.round(cur.portionScale * 2) / 2); // clean half for the sheet
    return getRecipeDetail(cur.recipe, s).then((d) =>
      setSheet({ name: cur.recipe.name, kcal: cur.kcal, steps: d.steps, ingredients: d.ingredients, methods: d.methods, portion: portionLabel(s) }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kicker>This week</Kicker>
            <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Menu</Serif>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <Pressable onPress={() => setShowKitchen(true)} style={{ paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999, backgroundColor: c('accentFaint'), borderWidth: 1, borderColor: c('border') }}>
              <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '700' }}>Kitchen</Text>
            </Pressable>
            <Pressable onPress={planNextWeek} disabled={regenerating} accessibilityRole="button" accessibilityLabel="New week" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border'), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c('textSecondary'), fontSize: 16, fontWeight: '600' }}>{regenerating ? '…' : '↻'}</Text>
            </Pressable>
          </View>
        </View>

        {/* day strip */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 18 }}>
          {plan.days.map((d, i) => {
            const on = i === dayIdx;
            return (
              <Pressable key={i} onPress={() => { setDayIdx(i); setMix(null); }} style={{ flex: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
                <Text style={{ color: on ? c('accentText') : c('textMuted'), fontSize: 11, fontWeight: '600', opacity: on ? 0.7 : 1 }}>{DOW[d.dayOfWeek]}</Text>
                <Text style={[{ color: on ? c('accentText') : c('textPrimary'), fontSize: 16, fontWeight: '700', marginTop: 2 }, num]}>{i + 1}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, marginBottom: 12 }}>
          <Text>
            <Text style={[{ color: c('textPrimary'), fontSize: 15, fontWeight: '700' }, num]}>{dayTotal.toLocaleString()}</Text>
            <Text style={{ color: c('textMuted'), fontSize: 13 }}> kcal planned</Text>
          </Text>
          {loggedCount > 0 ? <Text style={{ color: c('success'), fontSize: 13, fontWeight: '600' }}>{loggedCount} logged ✓</Text> : null}
        </View>

        {/* from-your-kitchen toggle */}
        <Pressable onPress={toggleKitchen} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: fromKitchen ? c('accentFaint') : c('chipSurface'), borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: fromKitchen ? ACCENT_BORDER : c('border'), marginBottom: 12 }}>
          <Text style={{ color: fromKitchen ? c('accentSoft') : c('textSecondary'), fontSize: 14, fontWeight: '600' }}>From your kitchen</Text>
          <View style={{ width: 42, height: 24, borderRadius: 999, backgroundColor: fromKitchen ? c('accent') : c('surfaceSunken'), padding: 3, alignItems: fromKitchen ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: fromKitchen ? c('accentText') : c('textMuted') }} />
          </View>
        </Pressable>

        {/* meal cards */}
        <View style={{ gap: 10 }}>
          {SLOTS.map((slot) => {
            const cur = currentFor(slot);
            if (!cur) return null;
            const key = `${dayIdx}:${slot}`;
            const isLogged = isLoggedNow(slot, cur.recipe.id);
            const cook = have.size ? cookability(cur.recipe, have) : null; // §7 near-miss is first-class
            const macros: Array<[string, number]> = [['protein', cur.protein], ['carbs', cur.carbs], ['fat', cur.fat]];
            return (
              <Card key={slot} logged={isLogged}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{cap(slot)}</Text>
                  <Text style={{ color: c('textMuted'), fontSize: 12 }}>{cur.recipe.cuisine} · {cur.recipe.effort}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                  <Serif size={23} color={c('textPrimary')} style={{ flex: 1, lineHeight: 26 }}>{cur.recipe.name}</Serif>
                  <Text style={{ marginLeft: 10 }}>
                    <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{cur.kcal.toLocaleString()}</Text>
                    <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                  {macros.map(([label, v]) => (
                    <Text key={label}>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{v}g</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 13 }}> {label}</Text>
                    </Text>
                  ))}
                </View>

                <PantryLine cook={cook} showReady={fromKitchen} />

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' }}>
                  {isLogged ? (
                    <View style={{ flex: 1, backgroundColor: c('successFaint'), borderRadius: 999, paddingVertical: 11, alignItems: 'center' }}>
                      <Text style={{ color: c('success'), fontWeight: '700', fontSize: 14 }}>✓ Logged</Text>
                    </View>
                  ) : (
                    <PrimaryButton label="Log it" flex onPress={() => logMeal(slot, cur)} />
                  )}
                  <MixButton onPress={() => openMix(key, cur.recipe, slot)} />
                  <OutlineButton label="Recipe" onPress={() => openRecipe(cur)} />
                </View>
                {isLogged ? (
                  <ThumbsRow thumb={thumbs.get(cur.recipe.id)} onThumb={(d) => thumbRecipe(cur.recipe.id, d)} />
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <MixSheet
        visible={mix !== null}
        currentName={mix?.recipe.name ?? ''}
        options={mixOptions}
        loading={mixLoading}
        onPick={pickMix}
        onClose={() => setMix(null)}
      />
      <RecipeSheet recipe={sheet} onClose={() => setSheet(null)} />
      {showKitchen ? <Kitchen profile={profile} onClose={() => setShowKitchen(false)} /> : null}
    </View>
  );
}

/** §8 one-tap rating on a logged meal → the learning loop's strongest signal. */
function ThumbsRow({ thumb, onThumb }: { thumb?: 'up' | 'down'; onThumb: (d: 'up' | 'down') => void }) {
  const { c } = useTheme();
  const btn = (dir: 'up' | 'down', glyph: string) => {
    const on = thumb === dir;
    const tone = dir === 'up' ? c('success') : c('danger');
    return (
      <Pressable
        onPress={() => onThumb(dir)}
        accessibilityRole="button"
        accessibilityLabel={dir === 'up' ? 'I liked this' : 'Not for me'}
        style={{ width: 34, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c('surfaceSunken') : c('chipSurface'), borderWidth: 1, borderColor: on ? tone : 'transparent' }}
      >
        <Text style={{ fontSize: 14, color: on ? tone : c('textMuted') }}>{glyph}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <Text style={{ color: c('textMuted'), fontSize: 12, flex: 1 }}>{thumb ? (thumb === 'up' ? 'Glad you liked it' : "We'll show it less") : 'How was it?'}</Text>
      {btn('up', '👍')}
      {btn('down', '👎')}
    </View>
  );
}

/** §7 near-miss as a first-class line: "Just need: chicken, 1 red pepper" when
 * you're ≤2 items short, "All in your kitchen" when ready (kitchen mode only). */
function PantryLine({ cook, showReady }: { cook: Cookability | null; showReady: boolean }) {
  const { c } = useTheme();
  if (!cook) return null;
  if (cook.tier === 'oneShort') {
    const need = cook.missing.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    return (
      <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600', marginTop: 8 }}>Just need: {need}</Text>
    );
  }
  if (cook.tier === 'now' && showReady) {
    return <Text style={{ color: c('success'), fontSize: 13, fontWeight: '600', marginTop: 8 }}>✓ All in your kitchen</Text>;
  }
  return null;
}
