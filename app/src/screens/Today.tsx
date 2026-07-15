import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localParts, portionChips } from '@yumo/brain';
import type { MealSlot } from '@yumo/shared';
import type { MenuDay, MenuRecipe, UserProfile } from '@yumo/menu';
import { useTheme } from '../theme';
import { useToday } from '../useToday';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { getMenu, getMixup, getRecipeDetail, portionLabel, type RecipeIngredientLine } from '../data/repo';
import { learnedWeights, mixReason } from '../data/menuPrefs';
import { expiringItems, expiringUsedBy } from '../data/expiring';
import { cookability } from '../data/cookability';
import { POOL } from '../data/menu-seed';
import { BudgetRing } from '../components/BudgetRing';
import { CoachLine } from '../components/CoachLine';
import { MixSheet, type MixOption } from '../components/MixSheet';
import { RecipeSheet } from '../components/RecipeSheet';
import { AddSheet, type AddItem } from '../components/AddSheet';
import { Serif, Kicker, Card, PrimaryButton, MixButton, OutlineButton, TextLink } from '../components/kit';
import { SwipeRow } from '../components/SwipeRow';
import { track } from '../analytics';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const num = { fontVariant: ['tabular-nums' as const] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Planned = { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number };

/** §3.5 portion confirm-chip — one tap logs at this portion. The `usual` chip is
 * the accent hero; `bit less`/`bit more` are the ±25% quiet alternatives. */
function PortionChip({ label, kcal, primary, onPress }: { label: string; kcal: number; primary?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: primary ? 1.4 : 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primary ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: primary ? c('accent') : 'rgba(247,242,234,0.09)', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: primary ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: primary ? '700' : '600' }}>{label}</Text>
      <Text style={{ color: primary ? c('accentText') : c('textMuted'), fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }}>{kcal} kcal</Text>
    </Pressable>
  );
}

export function Today({ profile }: { profile: UserProfile }) {
  const { c } = useTheme();
  const { events, logFood, skipMeal, deleteLog } = useEventStore();
  const kitchen = useKitchen();
  const [now] = useState(() => Date.now());
  // The REAL profile drives menu/mix generation — allergies + hates are hard
  // constraints (§4.3). A prior stub passed allergies:[], which meant an allergic
  // user could be shown and one-tap-log a meal containing their allergen.
  const budget = profile.budgetKcal;
  const tokens = useMemo(() => [...profile.needs, ...profile.likes], [profile.needs, profile.likes]);
  const state = useToday(events, now, budget, tokens);

  const [day, setDay] = useState<MenuDay | null>(null);
  const [featuredOverride, setFeaturedOverride] = useState<Record<string, MenuRecipe>>({});
  const [addSlot, setAddSlot] = useState<MealSlot | null>(null);
  const [mix, setMix] = useState<{ slot: MealSlot; recipe: MenuRecipe } | null>(null);
  const [mixOptions, setMixOptions] = useState<MixOption[]>([]);
  const [mixLoading, setMixLoading] = useState(false);
  const [sheet, setSheet] = useState<{ name: string; kcal: number; steps: string[]; ingredients: RecipeIngredientLine[]; methods?: string[]; portion?: string } | null>(null);

  const userWeights = useMemo(() => learnedWeights(events, now), [events, now]); // §8 learned taste

  // §8 gentle waste-saver line — one expiring item paired with a cook-now dinner that fits the budget.
  const wasteLine = useMemo(() => {
    const exp = expiringItems(kitchen.items, now);
    if (!exp.length) return null;
    const have = new Set(kitchen.items.filter((i) => i.level !== 'out').map((i) => i.token));
    const cand = POOL
      .filter((r) => r.slotAffinity.includes('dinner'))
      .map((r) => ({ r, uses: expiringUsedBy(r, exp), cook: cookability(r, have) }))
      .filter((x) => x.uses.length > 0 && x.cook.tier !== 'shop')
      .sort((a, b) => Number(b.r.perServing.kcal <= state.remaining) - Number(a.r.perServing.kcal <= state.remaining) || a.cook.missing.length - b.cook.missing.length)[0];
    return cand ? { item: cand.uses[0]!.label, recipe: cand.r.name, fits: cand.r.perServing.kcal <= state.remaining } : null;
  }, [kitchen.items, now, state.remaining]);

  // §8 max 1 waste nudge/day — persist the day it was shown so it fires at most once.
  const [wasteSeenDay, setWasteSeenDay] = useState<number | null>(null);
  useEffect(() => { AsyncStorage.getItem('yumo.kitchen.wasteDay.v1').then((v) => setWasteSeenDay(v ? Number(v) : 0)).catch(() => {}); }, []);
  const todayEpoch = localParts(now, 0).epochDay;
  const showWaste = wasteLine != null && wasteSeenDay != null && wasteSeenDay !== todayEpoch;
  useEffect(() => {
    if (showWaste) { AsyncStorage.setItem('yumo.kitchen.wasteDay.v1', String(todayEpoch)).catch(() => {}); track('waste_nudge_shown', {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaste]);

  useEffect(() => {
    let alive = true;
    const todayDow = new Date().getDay();
    getMenu(profile, undefined, undefined, undefined, userWeights).then((r) => {
      if (!alive) return;
      setDay(r.plan.days.find((dd) => dd.dayOfWeek === todayDow) ?? r.plan.days[0] ?? null);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  const macrosFor = (recipe: MenuRecipe, kcal: number) => {
    const f = recipe.perServing.kcal > 0 ? kcal / recipe.perServing.kcal : 1;
    return { protein: Math.round(recipe.perServing.protein_g * f), carbs: Math.round((recipe.perServing.carbs_g ?? 0) * f), fat: Math.round((recipe.perServing.fat_g ?? 0) * f) };
  };
  const plannedFor = (slot: MealSlot): Planned | null => {
    const ov = featuredOverride[slot];
    if (ov) { const kcal = Math.round(ov.perServing.kcal); return { recipe: ov, kcal, ...macrosFor(ov, kcal), portionScale: 1 }; }
    const pick = day?.picks.find((p) => p.slot === slot);
    if (!pick) return null;
    const kcal = Math.round(pick.kcal);
    return { recipe: pick.recipe, kcal, ...macrosFor(pick.recipe, kcal), portionScale: pick.portionScale };
  };

  // §5 computed coach line.
  const coachText = useMemo(() => {
    const remaining: string[] = [];
    let plannedKcal = 0;
    for (const s of state.slots) {
      if (s.items.length || s.skipped) continue;
      const p = plannedFor(s.slot);
      if (!p) continue;
      remaining.push(s.slot);
      plannedKcal += p.kcal;
    }
    const left = state.budget - state.eaten;
    if (!day) return `${Math.max(0, left).toLocaleString()} kcal left today.`;
    if (remaining.length === 0) return left >= 0 ? `${left.toLocaleString()} kcal spare today — nicely done.` : 'Day logged. Tomorrow is a fresh start.';
    const spare = left - plannedKcal;
    const names = remaining.join(' + ');
    if (spare >= 0) return `Your ${names} fit today's budget with ${spare.toLocaleString()} kcal spare.`;
    return `The menu runs ${Math.abs(spare).toLocaleString()} kcal over — Mix it up for a lighter pick.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slots, state.budget, state.eaten, day, featuredOverride]);

  const d = new Date();
  const dateStr = `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  const hour = d.getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  const logPlanned = (slot: MealSlot, p: Planned) => {
    // §6 decrement first, then persist the exact ids drawn down on the log — so
    // deleting this row reverses precisely those items (and nothing else).
    const decrementedIds = kitchen.decrementForRecipe(p.recipe);
    logFood(p.recipe.id, { slot, kcal: p.kcal, proteinG: p.protein, carbsG: p.carbs, fatG: p.fat, name: p.recipe.name, source: 'menu', taps: 1, meta: { decrementedIds } });
    track('menu_accepted', { recipeId: p.recipe.id, slot });
  };

  // Delete a logged row (§ swipe-to-delete). Reverses exactly the fridge items this
  // log drew down, from the ids stored on the event — works for logs made from
  // any surface (Today/Menu/Kitchen), and never invents stock.
  const removeLog = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId);
    const ids = ev?.meta?.['decrementedIds'];
    if (Array.isArray(ids) && ids.length) kitchen.restoreDecrement(ids as string[]);
    deleteLog(eventId);
  };

  // §3.4 confidence ladder — the "the usual?" one-tap log (Moat #1). Logs the
  // predicted food at the chosen portion; source 'usual' is the nudge-accept signal.
  const logUsual = (slot: MealSlot, portionG: number) => {
    const u = state.usual;
    if (!u) return;
    const kcal = u.portionG > 0 ? Math.round((u.kcal * portionG) / u.portionG) : u.kcal;
    logFood(u.foodId, { slot, kcal, portionG, name: u.name, source: 'usual', taps: 1 });
  };
  // §3.4 medium tier — top-3 predicted tiles, one tap each.
  const logTile = (slot: MealSlot, t: { foodId: string; name: string; kcal: number; portionG: number }) => {
    logFood(t.foodId, { slot, kcal: t.kcal, portionG: t.portionG, name: t.name, source: 'tile', taps: 2 });
  };
  const openMix = (slot: MealSlot, recipe: MenuRecipe) => {
    setMix({ slot, recipe });
    setMixOptions([]);
    setMixLoading(true);
    track('mixup_opened');
    const planRecipeIds = day ? day.picks.map((p) => p.recipe.id) : [];
    getMixup(recipe, slot, profile, { recentlyUsed: planRecipeIds, userWeights })
      .then((alts) => setMixOptions(alts.map((r) => ({ recipe: r, reason: mixReason(r, profile) }))))
      .finally(() => setMixLoading(false));
  };
  const pickMix = (alt: MenuRecipe) => {
    if (!mix) return;
    setFeaturedOverride((o) => ({ ...o, [mix.slot]: alt })); // swaps the suggestion; does NOT log
    setMix(null);
  };
  const openRecipe = (p: Planned) => {
    const s = Math.max(0.5, Math.round(p.portionScale * 2) / 2);
    return getRecipeDetail(p.recipe, s).then((detail) => setSheet({ name: p.recipe.name, kcal: p.kcal, steps: detail.steps, ingredients: detail.ingredients, methods: detail.methods, portion: portionLabel(s) }));
  };
  const addPlanned = (slot: MealSlot): AddItem | null => {
    const p = plannedFor(slot);
    return p ? { id: p.recipe.id, name: p.recipe.name, kcal: p.kcal, proteinG: p.protein, carbsG: p.carbs, fatG: p.fat, source: 'menu' } : null;
  };

  // §3.9 the "learns you" magic moment — fire its analytics once per newly-learned
  // pattern (the go-to-market clip §12) and surface the coach line below.
  const learnedNote = state.learned?.note ?? null;
  useEffect(() => { if (learnedNote) track('brain_learned_visible', { note: learnedNote }); }, [learnedNote]);

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kicker>{greeting}</Kicker>
            <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Today</Serif>
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 8 }}>{dateStr}</Text>
        </View>

        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <BudgetRing eaten={state.eaten} budget={state.budget} />
          <Text style={[{ color: c('textMuted'), fontSize: 13, marginTop: 12 }, num]}>
            {Math.round(state.eaten).toLocaleString()} eaten · {state.budget.toLocaleString()} budget
          </Text>
        </View>

        <View style={{ marginTop: 20, marginBottom: (showWaste || learnedNote) ? 12 : 20 }}>
          <CoachLine text={coachText} />
        </View>

        {learnedNote ? (
          <View style={{ marginBottom: showWaste ? 12 : 20, flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: c('accentSoft'), fontSize: 13.5, fontWeight: '600' }}>✨ Got it — {learnedNote.toLowerCase()}</Text>
          </View>
        ) : null}

        {showWaste && wasteLine ? (
          <View style={{ marginBottom: 20, backgroundColor: 'rgba(237,163,59,0.13)', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }}>
            <Text style={{ color: '#EDA33B', fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>🍃 Your {wasteLine.item.toLowerCase()} wants to be dinner — {wasteLine.recipe}{wasteLine.fits ? ' fits your budget' : ' tonight'}.</Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          {state.slots.map((s) => {
            const planned = plannedFor(s.slot);
            // §3.4 confidence ladder for the current, unlogged slot: the Brain's
            // "usual?" prediction wins; then its top-3 tiles; the menu pick is only
            // the fallback when the Brain has nothing (cold start / low confidence).
            const open = s.isCurrent && s.items.length === 0 && !s.skipped;
            const usual = open ? state.usual : null;
            const tiles = open && !usual ? state.tiles.slice(0, 3) : [];
            const showFeatured = open && !usual && tiles.length === 0 && !!planned;
            const showLadder = !!usual || tiles.length > 0;
            return (
              <Card key={s.slot} current={s.isCurrent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: s.isCurrent ? c('accentSoft') : c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{cap(s.slot)}</Text>
                  {s.items.length ? (
                    <Text>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{s.kcal.toLocaleString()}</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 11 }}> kcal</Text>
                    </Text>
                  ) : null}
                </View>

                {s.items.map((item, i) => (
                  <SwipeRow key={item.id} onDelete={() => removeLog(item.id)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider'), marginTop: i === 0 ? 8 : 0 }}>
                      <Text style={{ color: c('success'), fontSize: 12, marginRight: 8 }}>✓</Text>
                      <Text style={{ color: c('textLogged'), fontSize: 15, fontWeight: '500', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                      <Text style={[{ color: c('textMuted'), fontSize: 13 }, num]}>{item.kcal} kcal</Text>
                    </View>
                  </SwipeRow>
                ))}

                {usual ? (() => {
                  const chips = portionChips(usual.portionG);
                  const kAt = (g: number) => (usual.portionG > 0 ? Math.round((usual.kcal * g) / usual.portionG) : usual.kcal);
                  const confident = state.usualFraming === 'confident';
                  return (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{confident ? 'The usual?' : 'From your menu'}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Serif size={23} color={c('textPrimary')} style={{ flex: 1, lineHeight: 26 }}>{usual.name}</Serif>
                        <Text style={{ marginLeft: 10 }}>
                          <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{usual.kcal.toLocaleString()}</Text>
                          <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                        </Text>
                      </View>
                      <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 3 }}>{confident ? 'One tap to log — I learned this one.' : 'Did you have your planned meal?'}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                        <PortionChip label="bit less" kcal={kAt(chips.less)} onPress={() => logUsual(s.slot, chips.less)} />
                        <PortionChip label="✓ the usual" kcal={kAt(chips.usual)} primary onPress={() => logUsual(s.slot, chips.usual)} />
                        <PortionChip label="bit more" kcal={kAt(chips.more)} onPress={() => logUsual(s.slot, chips.more)} />
                      </View>
                      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 16 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                        <TextLink label="Something else →" onPress={() => setAddSlot(s.slot)} />
                        <TextLink label="Skip this meal" onPress={() => skipMeal(s.slot)} tone="neutral" />
                      </View>
                    </View>
                  );
                })() : tiles.length ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Quick log</Text>
                    {tiles.map((t, i) => (
                      <Pressable key={t.foodId} onPress={() => logTile(s.slot, t)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider'), opacity: pressed ? 0.6 : 1 })}>
                        <Text style={{ color: c('textPrimary'), fontSize: 16, flex: 1 }} numberOfLines={1}>{t.name}</Text>
                        <Text style={[{ color: c('textSecondary'), fontSize: 14, marginRight: 12 }, num]}>{t.kcal} kcal</Text>
                        <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600' }}>＋</Text>
                      </Pressable>
                    ))}
                    <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 10 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                      <TextLink label="＋ More" onPress={() => setAddSlot(s.slot)} />
                      <TextLink label="Skip this meal" onPress={() => skipMeal(s.slot)} tone="neutral" />
                    </View>
                  </View>
                ) : showFeatured && planned ? (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Serif size={23} color={c('textPrimary')} style={{ flex: 1, lineHeight: 26 }}>{planned.recipe.name}</Serif>
                      <Text style={{ marginLeft: 10 }}>
                        <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{planned.kcal.toLocaleString()}</Text>
                        <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                      </Text>
                    </View>
                    <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 3 }}>{planned.recipe.cuisine} · {planned.recipe.effort} · from your menu</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' }}>
                      <PrimaryButton label="Log it" flex onPress={() => logPlanned(s.slot, planned)} />
                      <MixButton onPress={() => openMix(s.slot, planned.recipe)} />
                      <OutlineButton label="Recipe" onPress={() => openRecipe(planned)} />
                    </View>
                    <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 16 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                      <TextLink label="＋ Add more" onPress={() => setAddSlot(s.slot)} />
                      <TextLink label="Skip this meal" onPress={() => skipMeal(s.slot)} tone="neutral" />
                    </View>
                  </View>
                ) : null}

                {s.skipped ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ color: c('textMuted'), fontSize: 14 }}>Skipped — no worries.</Text>
                    <TextLink label="Undo" onPress={() => s.skipId && deleteLog(s.skipId)} />
                  </View>
                ) : null}

                {!showFeatured && !showLadder && !s.skipped && (s.items.length === 0 || !s.isCurrent) ? (
                  <View style={{ marginTop: s.items.length ? 10 : 8, alignItems: 'flex-start' }}>
                    <OutlineButton label="＋ Add" onPress={() => setAddSlot(s.slot)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <MixSheet visible={mix !== null} currentName={mix?.recipe.name ?? ''} options={mixOptions} loading={mixLoading} onPick={pickMix} onClose={() => setMix(null)} />
      <RecipeSheet recipe={sheet} onClose={() => setSheet(null)} />
      <AddSheet
        visible={addSlot !== null}
        slotLabel={addSlot ? cap(addSlot) : ''}
        planned={addSlot ? addPlanned(addSlot) : null}
        onLog={(it) => {
          if (addSlot) logFood(it.id, { slot: addSlot, kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, name: it.name, source: it.source, taps: 2 });
          setAddSlot(null);
        }}
        onClose={() => setAddSlot(null)}
      />
    </View>
  );
}
