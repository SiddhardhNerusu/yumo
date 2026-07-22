import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, Text, Pressable, Linking, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localParts, logEvents, portionChips } from '@yumo/brain';
import { SLOT_ENVELOPE, type MealSlot, type Goal } from '@yumo/shared';
import type { GoalPrefs } from '../data/goalPrefs';
import { softScore, isAllowed, type MenuRecipe, type UserProfile, type WeekMenuPlan, type ScoreContext } from '@yumo/menu';
import { useTheme } from '../theme';
import { useToday } from '../useToday';
import { useNow } from '../useNow';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { getMenu, getMixup, getRecipeDetail, portionLabel, makePantryFit, type Source, type RecipeIngredientLine } from '../data/repo';
import { learnedWeights, mixReason } from '../data/menuPrefs';
import { weekMenuFor } from '../data/menuBridge';
import { resolveFoodMeta } from '../data/resolveFoodMeta';
import { useMyMeals, isMealSaved } from '../data/myMeals';
import { haptics } from '../haptics';
import { cookability, type Cookability } from '../data/cookability';
import { expiringItems, expiringUsedBy, recipesUsingExpiring } from '../data/expiring';
import { POOL } from '../data/menu-seed';
import { SLOT_TIME } from '../data/seed';
import { BudgetRing } from '../components/BudgetRing';
import { MacroBar } from '../components/MacroBar';
import { Overview } from './Overview';
import { macroTargets } from '../data/macros';
import { MixSheet, type MixOption } from '../components/MixSheet';
import { RecipeSheet, type RecipeSheetData } from '../components/RecipeSheet';
import { AddSheet, type AddItem } from '../components/AddSheet';
import { smartSuggest, suggestableCount, type SmartCtx, type SuggestCur } from '../data/suggest';
import { effortMin } from '../data/effort';
import { Serif, Card, PrimaryButton, MixButton, OutlineButton, TextLink, Skeleton } from '../components/kit';
import { SwipeRow } from '../components/SwipeRow';
import { track } from '../analytics';
import { coach } from '../coach/pack';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const num = { fontVariant: ['tabular-nums' as const] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const HAIRLINE = 'rgba(247,242,234,0.09)'; // pill borders (matches kit's chip border)
const ROW_DIVIDER = 'rgba(247,242,234,0.06)'; // dish-row divider (§6)

type Cur = { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number };
type DishMeta = { min: number; kitchen: { label: string; ok: boolean } | null };

/** §1/§6 kicker — 11/700/1.3 uppercase textMuted (brief's kicker, tighter than kit's). */
function Kick({ children, color }: { children: ReactNode; color?: string }) {
  const { c } = useTheme();
  return <Text style={{ color: color ?? c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>{children}</Text>;
}

/** §6 meal-card suggestions: 3 smart dish rows, tap name → detail, ＋ → log. New
 * rows fade+rise in (220ms) on Shuffle. The Shuffle pill + footer live in Day. */
function SmartRows({ items, metaFor, onOpen, onLog }: { items: SuggestCur[]; metaFor: (cur: SuggestCur) => DishMeta; onOpen: (cur: SuggestCur) => void; onLog: (cur: SuggestCur) => void }) {
  const { c } = useTheme();
  const fade = useRef(new Animated.Value(1)).current;
  const key = items.map((i) => i.recipe.id).join('|');
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [key, fade]);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
      {items.map((cur, i) => {
        const meta = metaFor(cur);
        return (
          <View key={cur.recipe.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: ROW_DIVIDER }}>
            <Pressable onPress={() => onOpen(cur)} accessibilityRole="button" accessibilityLabel={`${cur.recipe.name}, view recipe`} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text numberOfLines={1} style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{cur.recipe.name}</Text>
                <Text style={{ color: c('textMuted'), fontSize: 13, marginLeft: 4 }}>›</Text>
              </View>
              <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                {cur.protein}g protein · {meta.min} min
                {meta.kitchen ? ' · ' : ''}
                {meta.kitchen ? <Text style={{ color: meta.kitchen.ok ? c('success') : c('textMuted') }}>{meta.kitchen.label}</Text> : null}
              </Text>
            </Pressable>
            <Text style={[{ color: c('textSecondary'), fontSize: 14, fontWeight: '600' }, num]}>{cur.kcal.toLocaleString()}</Text>
            <Pressable onPress={() => onLog(cur)} accessibilityRole="button" accessibilityLabel={`Log ${cur.recipe.name}`} hitSlop={6} style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 999, backgroundColor: c('accentFaint'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('accentSoft'), fontSize: 18, fontWeight: '600', marginTop: -1 }}>＋</Text>
            </Pressable>
          </View>
        );
      })}
    </Animated.View>
  );
}

/** §0/§6 Shuffle pill — rerolls one meal's suggestions (⇄ + "Shuffle"). */
function ShufflePill({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Shuffle suggestions" hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: HAIRLINE, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('accentSoft'), fontSize: 13 }}>⇄</Text>
      <Text style={{ color: c('textSecondary'), fontSize: 12, fontWeight: '600' }}>Shuffle</Text>
    </Pressable>
  );
}

/** §3.5 portion confirm-chip — one tap logs at this portion. */
function PortionChip({ label, kcal, primary, onPress }: { label: string; kcal: number; primary?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: primary ? 1.4 : 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primary ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: primary ? c('accent') : 'rgba(247,242,234,0.09)', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: primary ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: primary ? '700' : '600' }}>{label}</Text>
      <Text style={{ color: primary ? c('accentText') : c('textMuted'), fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }}>{kcal} kcal</Text>
    </Pressable>
  );
}

/**
 * The merged home screen: one source of truth for the day. Today's ring + the
 * Brain's confidence ladder live at the top; Menu's week strip + meal cards carry
 * the plan. What you LOG always shows inside the day's cards (no more Today/Menu
 * disagreeing); other days of the week are pure planning (no Log it — you can't
 * eat Friday yet).
 */
export function Day({ profile, goal, prefs }: { profile: UserProfile; goal: Goal; prefs?: GoalPrefs }) {
  const { c } = useTheme();
  const { events, logFood, skipMeal, deleteLog, recordMixupPick, thumbRecipe, thumbs } = useEventStore();
  const kitchen = useKitchen();
  const { meals: savedMeals, save: saveMeal } = useMyMeals();
  const now = useNow();
  const budget = profile.budgetKcal;
  const tokens = useMemo(() => [...profile.needs, ...profile.likes], [profile.needs, profile.likes]);

  // ── week plan (Menu's engine wiring, kitchen boosts included) ───────────────
  const have = useMemo(() => kitchen.availableTokens(), [kitchen.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearMissTokens = (r: MenuRecipe): string[] | undefined => {
    if (!have.size) return undefined;
    const cook = cookability(r, have);
    return cook.tier === 'oneShort' ? cook.missing.slice(0, 2) : undefined;
  };
  const expiring = useMemo(() => expiringItems(kitchen.items, now), [kitchen.items, now]);
  const expiringLabels = useMemo(() => expiring.map((i) => i.label), [expiring]);
  const expiringKey = expiringLabels.join('|');
  const kitchenBoost = (on: boolean): string[] => {
    const ids = new Set(recipesUsingExpiring(POOL, expiring));
    if (on) for (const r of POOL) if (cookability(r, have).tier === 'now') ids.add(r.id);
    return [...ids];
  };
  const [plan, setPlan] = useState<WeekMenuPlan | null>(null);
  const [, setSource] = useState<Source>('local');
  const [dayIdx, setDayIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, MenuRecipe>>({});
  const [regenerating, setRegenerating] = useState(false);
  // Kitchen-first is now the DEFAULT (folded into the smart ranker's kitchen-tier
  // sort); the generated plan stays balanced, so this is a constant, no toggle.
  const fromKitchen = false;
  // per-slot Shuffle cursor for the suggestion rows (§0 Shuffle rerolls one meal).
  const [offsets, setOffsets] = useState<Partial<Record<MealSlot, number>>>({});
  const shuffle = (slot: MealSlot) => { haptics.select(); setOffsets((o) => ({ ...o, [slot]: (o[slot] ?? 0) + 3 })); };
  const userWeights = useMemo(() => learnedWeights(events, now), [events, now]);

  // Feed the REAL generated menu into the Brain so a real user's own foods can
  // earn menuPrior (§3.3) — replaces the demo-only SEED_MENU. null until the
  // async plan resolves, which is the correct "no menu yet" state for the Brain.
  const brainMenu = useMemo(() => (plan ? weekMenuFor(plan) : undefined), [plan]);
  const state = useToday(events, now, budget, tokens, brainMenu);

  // ONE time frame: the app's day is UTC everywhere (tzOffsetMin:0), so derive
  // today's day-of-week the same way (was device-local getDay(), which drifted
  // against the UTC epochDay near midnight for non-UTC users). isToday / dayIdx
  // / the day strip / M2's isPast all key off this.
  const todayDow = localParts(now, 0).dayOfWeek;

  useEffect(() => {
    let alive = true;
    getMenu(profile, undefined, kitchenBoost(fromKitchen), fromKitchen ? makePantryFit(have) : undefined, userWeights).then((r) => {
      if (!alive) return;
      setPlan(r.plan);
      setSource(r.source);
      const idx = r.plan.days.findIndex((d) => d.dayOfWeek === todayDow);
      setDayIdx(idx >= 0 ? idx : 0);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, expiringKey]);

  const planNextWeek = () => {
    setRegenerating(true);
    track('menu_regenerated');
    getMenu(profile, `week-${Date.now()}`, kitchenBoost(fromKitchen), fromKitchen ? makePantryFit(have) : undefined, userWeights)
      .then((r) => { setPlan(r.plan); setSource(r.source); setOverrides({}); const idx = r.plan.days.findIndex((d) => d.dayOfWeek === todayDow); setDayIdx(idx >= 0 ? idx : 0); })
      .finally(() => setRegenerating(false));
  };

  // ── "logged today" guard (persisted event log, not local state) ─────────────
  const loggedToday = useMemo(() => {
    const day = localParts(now, 0).epochDay;
    const set = new Set<string>();
    for (const e of logEvents(events)) {
      if (e.foodId && e.slot && localParts(e.ts, 0).epochDay === day) set.add(`${e.slot}:${e.foodId}`);
    }
    return set;
  }, [events, now]);

  // ── sheets ──────────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<RecipeSheetData | null>(null);
  // carries the day (M2): AddSheet can target today or a past day of this week.
  const [addSlot, setAddSlot] = useState<{ slot: MealSlot; epochDay: number } | null>(null);
  const [mix, setMix] = useState<{ key: string; slot: MealSlot; recipe: MenuRecipe } | null>(null);
  const [mixOptions, setMixOptions] = useState<MixOption[]>([]);
  const [mixLoading, setMixLoading] = useState(false);

  // ── §8 waste-saver line (today only, max 1/day) ─────────────────────────────
  const wasteLine = useMemo(() => {
    if (!expiring.length) return null;
    const stock = new Set(kitchen.items.filter((i) => i.level !== 'out').map((i) => i.token));
    const cand = POOL
      .filter((r) => r.slotAffinity.includes('dinner'))
      .map((r) => ({ r, uses: expiringUsedBy(r, expiring), cook: cookability(r, stock) }))
      .filter((x) => x.uses.length > 0 && x.cook.tier !== 'shop')
      .sort((a, b) => Number(b.r.perServing.kcal <= state.remaining) - Number(a.r.perServing.kcal <= state.remaining) || a.cook.missing.length - b.cook.missing.length)[0];
    return cand ? { item: cand.uses[0]!.label, recipe: cand.r.name, fits: cand.r.perServing.kcal <= state.remaining } : null;
  }, [kitchen.items, expiring, state.remaining]);
  const [wasteSeenDay, setWasteSeenDay] = useState<number | null>(null);
  useEffect(() => { AsyncStorage.getItem('yumo.kitchen.wasteDay.v1').then((v) => setWasteSeenDay(v ? Number(v) : 0)).catch(() => {}); }, []);
  const todayEpoch = localParts(now, 0).epochDay;
  const showWaste = wasteLine != null && wasteSeenDay != null && wasteSeenDay !== todayEpoch;
  useEffect(() => {
    if (showWaste) { AsyncStorage.setItem('yumo.kitchen.wasteDay.v1', String(todayEpoch)).catch(() => {}); track('waste_nudge_shown', {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaste]);

  // §3.9 learning moment analytics.
  const learnedNote = state.learned?.note ?? null;
  useEffect(() => { if (learnedNote) track('brain_learned_visible', { note: learnedNote }); }, [learnedNote]);

  // ── macros: eaten today (from the logged events) vs derived targets ─────────
  const [showOverview, setShowOverview] = useState(false);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const macrosEaten = useMemo(() => {
    let proteinG = 0, carbsG = 0, fatG = 0;
    for (const sl of state.slots) for (const it of sl.items) { proteinG += it.proteinG ?? 0; carbsG += it.carbsG ?? 0; fatG += it.fatG ?? 0; }
    return { proteinG, carbsG, fatG };
  }, [state.slots]);

  // ── loading skeleton ────────────────────────────────────────────────────────
  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
          <Kick>{greetingFor(now)}</Kick>
          <Serif size={30} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2, marginBottom: 20 }}>Today</Serif>
          <View style={{ alignItems: 'center', marginBottom: 22 }}><Skeleton width={210} height={210} radius={105} /></View>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 22 }}>
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} height={54} radius={14} style={{ flex: 1 }} />)}
          </View>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ marginBottom: 12 }}><Skeleton height={132} radius={20} /></View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const day = plan.days[dayIdx]!;
  const isToday = day.dayOfWeek === todayDow;
  const isPast = day.dayOfWeek < todayDow;
  const isFuture = day.dayOfWeek > todayDow;
  // plan.days[i].dayOfWeek === i (fixed Sun…Sat week), so the selected day's
  // epochDay derives in ONE UTC frame — no week-wrap.
  const epochOf = (i: number) => todayEpoch - todayDow + i;
  const selectedEpoch = epochOf(dayIdx);
  // UTC ts pinned to a day's slot hour; round-trips localParts(ts,0).epochDay.
  const tsFor = (epochDay: number, slot: MealSlot) => epochDay * 86_400_000 + SLOT_TIME[slot] * 3_600_000;
  const dateLabelFor = (epochDay: number) => {
    const dt = new Date(epochDay * 86_400_000);
    return `${DOW[dt.getUTCDay()]} ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`;
  };
  // logged items for a given epochDay, grouped by slot (state.slots is today-only,
  // so backfilled past days need their own builder). meta.name is always set by
  // every log call site, so names resolve without the Brain resolver.
  const foodMeta = resolveFoodMeta(events);
  const itemsOn = (epochDay: number) => {
    const out: Record<MealSlot, Array<{ id: string; name: string; kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null }>> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of logEvents(events)) {
      if (localParts(e.ts, 0).epochDay !== epochDay) continue;
      const sl = (e.slot ?? 'snack') as MealSlot;
      if (!out[sl]) continue;
      const metaName = typeof e.meta?.['name'] === 'string' ? (e.meta['name'] as string) : null;
      const name = metaName ?? (e.foodId ? foodMeta.name(e.foodId) : 'meal');
      out[sl].push({ id: e.id, name, kcal: e.kcal ?? 0, proteinG: e.proteinG ?? null, carbsG: e.carbsG ?? null, fatG: e.fatG ?? null });
    }
    return out;
  };
  const pastDayItems = isPast ? itemsOn(selectedEpoch) : null;
  const pastEaten = pastDayItems ? Object.values(pastDayItems).flat().reduce((s, it) => s + it.kcal, 0) : 0;

  const macrosFor = (recipe: MenuRecipe, kcal: number) => {
    const f = recipe.perServing.kcal > 0 ? kcal / recipe.perServing.kcal : 1;
    return { protein: Math.round(recipe.perServing.protein_g * f), carbs: Math.round((recipe.perServing.carbs_g ?? 0) * f), fat: Math.round((recipe.perServing.fat_g ?? 0) * f) };
  };
  const currentFor = (slot: MealSlot): Cur | null => {
    const key = `${dayIdx}:${slot}`;
    const ov = overrides[key];
    if (ov) { const kcal = Math.round(ov.perServing.kcal); return { recipe: ov, kcal, ...macrosFor(ov, kcal), portionScale: 1 }; }
    const pick = day.picks.find((p) => p.slot === slot);
    if (!pick) return null;
    const kcal = Math.round(pick.kcal);
    return { recipe: pick.recipe, kcal, ...macrosFor(pick.recipe, kcal), portionScale: pick.portionScale };
  };
  const dayTotal = SLOTS.reduce((sum, s) => sum + (currentFor(s)?.kcal ?? 0), 0);
  const loggedCount = state.slots.filter((s) => s.items.length > 0).length;
  const planRecipeIds = plan.days.flatMap((d) => d.picks.map((p) => p.recipe.id));

  /** Planned pick for TODAY's date (the ladder uses today even when browsing another day). */
  function currentForToday(slot: MealSlot): Cur | null {
    const tIdx = plan!.days.findIndex((d) => d.dayOfWeek === todayDow);
    if (tIdx < 0) return null;
    const key = `${tIdx}:${slot}`;
    const ov = overrides[key];
    const tDay = plan!.days[tIdx]!;
    if (ov) { const kcal = Math.round(ov.perServing.kcal); return { recipe: ov, kcal, ...macrosFor(ov, kcal), portionScale: 1 }; }
    const pick = tDay.picks.find((p) => p.slot === slot);
    if (!pick) return null;
    const kcal = Math.round(pick.kcal);
    return { recipe: pick.recipe, kcal, ...macrosFor(pick.recipe, kcal), portionScale: pick.portionScale };
  }

  // ── smart slot suggestions: build a Cur for any pool recipe (at its authored
  //    serving) + the injected ctx the pure smartSuggest ranks over (budget →
  //    kitchen tier → score). Kitchen-first is inherent in cookTier. ────────────
  const curFor = (r: MenuRecipe): SuggestCur => { const kcal = Math.round(r.perServing.kcal); return { recipe: r, kcal, ...macrosFor(r, kcal), portionScale: 1 }; };
  const suggestCtx = (slot: MealSlot, plannedCur: Cur | null, offset: number): SmartCtx => {
    const sctx: ScoreContext = {
      slotTargetKcal: SLOT_ENVELOPE[slot],
      recentlyUsed: new Set(planRecipeIds),
      proteinPaceDeficit: 0,
      boostIds: new Set(kitchenBoost(fromKitchen)),
      userWeights,
      pantryFit: undefined,
    };
    return {
      slot,
      planned: plannedCur,
      pool: POOL,
      remaining: Math.max(0, state.remaining),
      offset,
      allowed: (r) => r.slotAffinity.includes(slot) && isAllowed(r, profile),
      score: (r) => softScore(r, slot, profile, sctx).score,
      cookTier: (r) => cookability(r, have).tier,
      curFor,
    };
  };
  // §6 per-dish meta: cook time (from effort) + kitchen match ("have it all" /
  // "{n} to buy"); the match hides on an empty kitchen (nothing to match against).
  const dishMeta = (cur: SuggestCur): DishMeta => {
    let kitchen: DishMeta['kitchen'] = null;
    if (have.size) {
      const cook = cookability(cur.recipe, have);
      kitchen = cook.tier === 'now' ? { label: '✓ have it all', ok: true } : { label: `${cook.missing.length} to buy`, ok: false };
    }
    return { min: effortMin(cur.recipe.effort), kitchen };
  };

  // per-day "already logged this (slot, food)?" keyset — generalizes loggedToday
  // so the double-log guard holds for backfilled days too (M2).
  const loggedKeysOn = (epochDay: number) => {
    const set = new Set<string>();
    for (const e of logEvents(events)) {
      if (e.foodId && e.slot && localParts(e.ts, 0).epochDay === epochDay) set.add(`${e.slot}:${e.foodId}`);
    }
    return set;
  };

  // ── actions ─────────────────────────────────────────────────────────────────
  // `targetEpoch` is the day being logged into. Today → normal (Date.now() ts +
  // pantry draw-down). A PAST day (M2) → a UTC ts pinned to that day's slot hour
  // and NO pantry decrement (D6: backfilling Tuesday must not eat today's stock;
  // meta.decrementedIds stays [] so swipe-delete's reversal is a coherent no-op).
  const logMeal = (slot: MealSlot, cur: Cur, targetEpoch: number) => {
    const isPastDay = targetEpoch < todayEpoch;
    const guard = isPastDay ? loggedKeysOn(targetEpoch) : loggedToday;
    if (guard.has(`${slot}:${cur.recipe.id}`)) return; // guard against double-log
    const decrementedIds = isPastDay ? [] : kitchen.decrementForRecipe(cur.recipe); // §6 pantry draw-down (today only)
    logFood(cur.recipe.id, { slot, kcal: cur.kcal, proteinG: cur.protein, carbsG: cur.carbs, fatG: cur.fat, name: cur.recipe.name, source: 'menu', taps: 1, meta: { decrementedIds }, ...(isPastDay ? { ts: tsFor(targetEpoch, slot) } : {}) });
    track('menu_accepted', { recipeId: cur.recipe.id, slot });
  };
  const removeLog = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId);
    const ids = ev?.meta?.['decrementedIds'];
    if (Array.isArray(ids) && ids.length) kitchen.restoreDecrement(ids as string[]);
    deleteLog(eventId);
  };
  const logUsual = (slot: MealSlot, portionG: number) => {
    const u = state.usual;
    if (!u) return;
    const kcal = u.portionG > 0 ? Math.round((u.kcal * portionG) / u.portionG) : u.kcal;
    logFood(u.foodId, { slot, kcal, portionG, name: u.name, source: 'usual', taps: 1 });
  };
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
  const openRecipe = (cur: Cur, slot?: MealSlot) => {
    const s = Math.max(0.5, Math.round(cur.portionScale * 2) / 2);
    return getRecipeDetail(cur.recipe, s).then((d) =>
      setSheet({
        name: cur.recipe.name, kcal: cur.kcal, steps: d.steps, ingredients: d.ingredients, methods: d.methods, portion: portionLabel(s),
        protein: cur.protein, min: effortMin(cur.recipe.effort), cook: have.size ? cookability(cur.recipe, have) : null,
        // §8 footer only from a suggestion (has a slot to add into / swap within).
        ...(slot ? {
          addLabel: `＋ Add to ${cap(slot)}`,
          add: () => { logMeal(slot, cur, todayEpoch); setSheet(null); },
          swap: () => { setSheet(null); openMix(`${dayIdx}:${slot}`, cur.recipe, slot); },
        } : {}),
      }));
  };
  // Resolve a logged row / quick-log tile back to its recipe so tapping the NAME
  // opens "how to make it" (id first, then name — search adds have synthetic ids).
  const recipeFor = (foodId: string | null | undefined, name: string): MenuRecipe | null => {
    if (foodId) { const byId = POOL.find((r) => r.id === foodId); if (byId) return byId; }
    const n = name.trim().toLowerCase();
    return POOL.find((r) => r.name.trim().toLowerCase() === n) ?? null;
  };
  const openRecipeByRef = (foodId: string | null | undefined, name: string, kcal: number) => {
    const r = recipeFor(foodId, name);
    if (!r) return;
    const s = r.perServing.kcal > 0 ? Math.max(0.5, Math.round((kcal / r.perServing.kcal) * 2) / 2) : 1;
    getRecipeDetail(r, s).then((d) =>
      setSheet({ name: r.name, kcal, steps: d.steps, ingredients: d.ingredients, methods: d.methods, portion: portionLabel(s), protein: Math.round(r.perServing.protein_g * s), min: effortMin(r.effort), cook: have.size ? cookability(r, have) : null }));
  };
  // The AddSheet's "from your menu" suggestion for the day being added to — the
  // SELECTED day's pick on a past day, today's otherwise (so the chip matches
  // that card's own "Log it" instead of suggesting today's meal onto a past day).
  const addPlanned = (slot: MealSlot, forEpoch: number): AddItem | null => {
    const p = forEpoch < todayEpoch ? currentFor(slot) : currentForToday(slot);
    return p ? { id: p.recipe.id, name: p.recipe.name, kcal: p.kcal, proteinG: p.protein, carbsG: p.carbs, fatG: p.fat, source: 'menu' } : null;
  };

  // header date — same UTC frame as the day strip (was device-local getDay(),
  // which disagreed with the strip near midnight for non-UTC users).
  const dateStr = dateLabelFor(todayEpoch);


  // ── the planned-meal block (Menu card anatomy) — shared today/other-days ────
  const plannedBlock = (slot: MealSlot, cur: Cur, opts: { loggable: boolean; addLink: boolean; skipLink: boolean }) => {
    const key = `${dayIdx}:${slot}`;
    const cook = have.size ? cookability(cur.recipe, have) : null;
    const macros: Array<[string, number]> = [['protein', cur.protein], ['carbs', cur.carbs], ['fat', cur.fat]];
    return (
      <View style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Serif size={23} weight="medium" color={c('textPrimary')} style={{ flex: 1, lineHeight: 26 }}>{cur.recipe.name}</Serif>
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
        <PantryLine cook={cook} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {opts.loggable ? <PrimaryButton label="Log it" flex onPress={() => logMeal(slot, cur, epochOf(dayIdx))} /> : null}
          <MixButton onPress={() => openMix(key, cur.recipe, slot)} />
          <OutlineButton label="Recipe" onPress={() => openRecipe(cur)} />
          {!opts.loggable ? <View style={{ flex: 1 }} /> : null}
        </View>
        {opts.addLink || opts.skipLink ? (
          <>
            <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 16 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
              {opts.addLink ? <TextLink label="＋ Add more" onPress={() => setAddSlot({ slot, epochDay: epochOf(dayIdx) })} /> : null}
              {opts.skipLink ? <TextLink label="Skip this meal" onPress={() => skipMeal(slot)} tone="neutral" /> : null}
            </View>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        {/* header (§1) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kick>{greetingFor(now)}</Kick>
            <Serif size={30} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Today</Serif>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
            <Text style={{ color: c('textMuted'), fontSize: 13 }}>{dateStr}</Text>
            <Pressable onPress={planNextWeek} disabled={regenerating} accessibilityRole="button" accessibilityLabel="New week" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c('surface'), borderWidth: 1, borderColor: HAIRLINE }}>
              <Text style={{ color: c('textSecondary'), fontSize: 12, fontWeight: '600' }}>{regenerating ? 'New week…' : '↻ New week'}</Text>
            </Pressable>
          </View>
        </View>

        {/* ring + coach — today only: you can't eat Friday yet */}
        {isToday ? (
          <>
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <Pressable onPress={() => setShowOverview(true)} accessibilityRole="button" accessibilityLabel="Open today's nutrition overview" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, alignItems: 'center' })}>
                <BudgetRing eaten={state.eaten} budget={state.budget} />
                <Text style={[{ color: c('textMuted'), fontSize: 13, marginTop: 12 }, num]}>
                  {Math.round(state.eaten).toLocaleString()} eaten · {state.budget.toLocaleString()} budget
                  <Text style={{ color: c('accentSoft'), fontWeight: '600' }}>   Overview ›</Text>
                </Text>
              </Pressable>
              <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
                <MacroBar eaten={macrosEaten} targets={targets} />
              </View>
            </View>
            <View style={{ marginTop: (showWaste || learnedNote || state.signpost) ? 14 : 0 }} />
            {learnedNote ? (
              <View style={{ marginBottom: showWaste ? 10 : 4, flexDirection: 'row', justifyContent: 'center' }}>
                <Text style={{ color: c('accentSoft'), fontSize: 13.5, fontWeight: '600' }}>Got it — {learnedNote.toLowerCase()}</Text>
              </View>
            ) : null}
            {showWaste && wasteLine ? (
              <View style={{ marginBottom: 4, backgroundColor: c('warningFaint'), borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }}>
                <Text style={{ color: c('warning'), fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>Your {wasteLine.item.toLowerCase()} wants to be dinner — {wasteLine.recipe}{wasteLine.fits ? ' fits your budget' : ' tonight'}.</Text>
              </View>
            ) : null}
            {state.signpost ? (
              <View style={{ marginBottom: 4, marginTop: 8, backgroundColor: c('surface'), borderRadius: 16, borderWidth: 1, borderColor: c('border'), padding: 16 }}>
                <Serif size={17} color={c('textPrimary')} style={{ marginBottom: 6 }}>{coach('signpostTitle')}</Serif>
                <Text style={{ color: c('textSecondary'), fontSize: 13.5, lineHeight: 20 }}>{coach('signpostBody')}</Text>
                <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
                  <TextLink label="Beat (UK)" onPress={() => Linking.openURL('https://www.beateatingdisorders.org.uk')} />
                  <TextLink label="NEDA (US)" onPress={() => Linking.openURL('https://www.nationaleatingdisorders.org')} />
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* day strip */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}>
          {plan.days.map((dd, i) => {
            const on = i === dayIdx;
            const isTd = dd.dayOfWeek === todayDow;
            return (
              <Pressable key={i} onPress={() => { setDayIdx(i); setMix(null); }} accessibilityRole="button" accessibilityLabel={`${DOW[dd.dayOfWeek]}${isTd ? ', today' : ''}`} accessibilityState={{ selected: on }} style={{ flex: 1, borderRadius: 12, paddingVertical: 7, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
                <Text style={{ color: on ? c('accentText') : isTd ? c('accentSoft') : c('textMuted'), fontSize: 11, fontWeight: '600', opacity: on ? 0.7 : 1 }}>{DOW[dd.dayOfWeek]}</Text>
                <Text style={[{ color: on ? c('accentText') : c('textPrimary'), fontSize: 15, fontWeight: '700', marginTop: 2 }, num]}>{new Date(epochOf(i) * 86_400_000).getUTCDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* M2: logging-onto-a-past-day notice */}
        {isPast ? (
          <View style={{ marginTop: 10, backgroundColor: c('accentFaint'), borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ color: c('accentSoft'), fontSize: 12.5, fontWeight: '600' }}>Logging for {dateLabelFor(selectedEpoch)} — counts toward that day.</Text>
          </View>
        ) : null}

        {/* plan header (§5) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 12 }}>
          {isPast ? (
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '800' }, num]}>{pastEaten.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> eaten · </Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '800' }, num]}>{dayTotal.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> planned</Text>
            </Text>
          ) : (
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '800' }, num]}>{dayTotal.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> kcal planned</Text>
            </Text>
          )}
          {isToday && loggedCount > 0 ? (
            <Text style={{ color: c('success'), fontSize: 13, fontWeight: '600' }}>{loggedCount} logged ✓</Text>
          ) : (
            <Text style={{ color: c('textMuted'), fontSize: 12 }}>Fits your budget · uses your kitchen</Text>
          )}
        </View>

        {/* meal cards */}
        <View style={{ gap: 10 }}>
          {SLOTS.map((slot) => {
            const cur = currentFor(slot);
            if (!cur) return null;

            // ── future day: planning only, no logging (you can't eat it yet) ──
            if (isFuture) {
              return (
                <Card key={slot}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{cap(slot)}</Text>
                    <Text style={{ color: c('textMuted'), fontSize: 12 }}>{cur.recipe.cuisine} · {cur.recipe.effort}</Text>
                  </View>
                  {plannedBlock(slot, cur, { loggable: false, addLink: false, skipLink: false })}
                </Card>
              );
            }

            // ── past day (M2): log a forgotten meal onto it — Log it + Add, but
            //    NO ladder and NO skip. Already-logged items show with swipe-
            //    delete (pantry reversal is a no-op since backfill never drew it).
            if (isPast) {
              const pastItems = pastDayItems![slot];
              return (
                <Card key={slot} logged={pastItems.length > 0}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{cap(slot)}</Text>
                    {pastItems.length ? (
                      <Text>
                        <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{pastItems.reduce((s, it) => s + it.kcal, 0).toLocaleString()}</Text>
                        <Text style={{ color: c('textMuted'), fontSize: 11 }}> kcal</Text>
                      </Text>
                    ) : (
                      <Text style={{ color: c('textMuted'), fontSize: 12 }}>{cur.recipe.cuisine} · {cur.recipe.effort}</Text>
                    )}
                  </View>
                  {pastItems.length ? (
                    <>
                      {pastItems.map((item, i) => (
                        <SwipeRow key={item.id} onDelete={() => removeLog(item.id)}>
                          <View style={{ paddingTop: 6, paddingBottom: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider'), marginTop: i === 0 ? 0 : 8 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <Serif size={23} weight="medium" color={c('textPrimary')} style={{ flexShrink: 1, lineHeight: 26 }}>{item.name}</Serif>
                              <Text style={{ marginLeft: 10 }}>
                                <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{item.kcal.toLocaleString()}</Text>
                                <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                              </Text>
                            </View>
                            {item.proteinG != null ? (
                              <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                                {([['protein', Math.round(item.proteinG)], ['carbs', Math.round(item.carbsG ?? 0)], ['fat', Math.round(item.fatG ?? 0)]] as Array<[string, number]>).map(([label, v]) => (
                                  <Text key={label}>
                                    <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{v}g</Text>
                                    <Text style={{ color: c('textMuted'), fontSize: 13 }}> {label}</Text>
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        </SwipeRow>
                      ))}
                      <View style={{ backgroundColor: c('successFaint'), borderRadius: 999, paddingVertical: 11, alignItems: 'center', marginTop: 16 }}>
                        <Text style={{ color: c('success'), fontWeight: '700', fontSize: 14 }}>✓ Logged</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 14 }} />
                      <View style={{ marginTop: 12 }}>
                        <TextLink label="＋ Add more" onPress={() => setAddSlot({ slot, epochDay: selectedEpoch })} />
                      </View>
                    </>
                  ) : (
                    plannedBlock(slot, cur, { loggable: true, addLink: true, skipLink: false })
                  )}
                </Card>
              );
            }

            // ── today: logged reality first, then the ladder / plan ────────────
            const s = state.slots.find((x) => x.slot === slot)!;
            const open = s.items.length === 0 && !s.skipped;
            const usual = open && s.isCurrent ? state.usual : null;
            // Shuffle only when there's more than the 3 shown rows to reroll among —
            // at ≤3 candidates the rows already surface everything (§0).
            const canShuffle = open && !usual && suggestableCount(suggestCtx(slot, cur, 0)) > 3;

            return (
              <Card key={slot} current={s.isCurrent} logged={s.items.length > 0}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Kick color={s.isCurrent ? c('accentSoft') : undefined}>{cap(slot)}</Kick>
                  {s.items.length ? (
                    <Text>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{s.kcal.toLocaleString()}</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 11 }}> kcal</Text>
                    </Text>
                  ) : canShuffle ? (
                    <ShufflePill onPress={() => shuffle(slot)} />
                  ) : null}
                </View>

                {/* logged slot — EVERY logged item gets the full meal-card anatomy
                    (serif name · kcal · macros); one green ✓ Logged pill closes the
                    tile at the END, exactly where "Log it" sits on unlogged cards. */}
                {s.items.length ? (() => {
                  const ordered = [...s.items].sort((a, b) => Number(b.foodId === cur.recipe.id) - Number(a.foodId === cur.recipe.id));
                  const rateable = ordered.map((it) => recipeFor(it.foodId, it.name)).find((r) => r != null) ?? null;
                  return (
                    <>
                      {ordered.map((item, i) => {
                        const rec = recipeFor(item.foodId, item.name);
                        const m = item.proteinG != null
                          ? { protein: Math.round(item.proteinG), carbs: Math.round(item.carbsG ?? 0), fat: Math.round(item.fatG ?? 0) }
                          : rec ? macrosFor(rec, item.kcal) : null;
                        return (
                          <SwipeRow key={item.id} onDelete={() => removeLog(item.id)}>
                            <View style={{ paddingTop: 6, paddingBottom: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider'), marginTop: i === 0 ? 0 : 8 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Pressable disabled={!rec} onPress={() => openRecipeByRef(item.foodId, item.name, item.kcal)} accessibilityRole={rec ? 'button' : undefined} accessibilityLabel={rec ? `${item.name}, view recipe` : undefined} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'baseline', opacity: pressed ? 0.6 : 1 })}>
                                  <Serif size={23} weight="medium" color={c('textPrimary')} style={{ flexShrink: 1, lineHeight: 26 }}>{item.name}</Serif>
                                  {rec ? <Text style={{ color: c('textMuted'), fontSize: 16, marginLeft: 6 }}>›</Text> : null}
                                </Pressable>
                                <Text style={{ marginLeft: 10 }}>
                                  <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{item.kcal.toLocaleString()}</Text>
                                  <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                                </Text>
                              </View>
                              {m ? (
                                <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                                  {([['protein', m.protein], ['carbs', m.carbs], ['fat', m.fat]] as Array<[string, number]>).map(([label, v]) => (
                                    <Text key={label}>
                                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{v}g</Text>
                                      <Text style={{ color: c('textMuted'), fontSize: 13 }}> {label}</Text>
                                    </Text>
                                  ))}
                                </View>
                              ) : null}
                              {/* M5: a custom/FDC/barcode food (no catalogue recipe) can be saved
                                  as a one-tap "my meal". Catalogue recipes are already one-tap. */}
                              {!rec ? (
                                isMealSaved(savedMeals, item.name, item.kcal) ? (
                                  <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 8 }}>Saved ✓</Text>
                                ) : (
                                  <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                                    <TextLink label="Save to my meals" size={13} onPress={() => { saveMeal({ name: item.name, kcal: item.kcal, proteinG: item.proteinG ?? undefined, carbsG: item.carbsG ?? undefined, fatG: item.fatG ?? undefined, portionG: item.portionG ?? undefined, portion: item.portionG != null ? `${item.portionG} g` : undefined }); haptics.success(); }} />
                                  </View>
                                )
                              ) : null}
                            </View>
                          </SwipeRow>
                        );
                      })}
                      <View style={{ backgroundColor: c('successFaint'), borderRadius: 999, paddingVertical: 11, alignItems: 'center', marginTop: 16 }}>
                        <Text style={{ color: c('success'), fontWeight: '700', fontSize: 14 }}>✓ Logged</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 14 }} />
                      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TextLink label="＋ Add more" onPress={() => setAddSlot({ slot, epochDay: todayEpoch })} />
                        {rateable ? <ThumbsRow thumb={thumbs.get(rateable.id)} onThumb={(dir) => thumbRecipe(rateable.id, dir)} /> : null}
                      </View>
                    </>
                  );
                })() : null}

                {usual ? (() => {
                  const chips = portionChips(usual.portionG);
                  const kAt = (g: number) => (usual.portionG > 0 ? Math.round((usual.kcal * g) / usual.portionG) : usual.kcal);
                  const confident = state.usualFraming === 'confident';
                  const usualHasRecipe = recipeFor(usual.foodId, usual.name) != null;
                  return (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{confident ? 'The usual?' : 'From your menu'}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Pressable disabled={!usualHasRecipe} onPress={() => openRecipeByRef(usual.foodId, usual.name, usual.kcal)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'baseline', opacity: pressed ? 0.6 : 1 })}>
                          <Serif size={23} weight="medium" color={c('textPrimary')} style={{ flexShrink: 1, lineHeight: 26 }}>{usual.name}</Serif>
                          {usualHasRecipe ? <Text style={{ color: c('textMuted'), fontSize: 17, marginLeft: 6 }}>›</Text> : null}
                        </Pressable>
                        <Text style={{ marginLeft: 10 }}>
                          <Text style={[{ color: c('textPrimary'), fontSize: 16, fontWeight: '700' }, num]}>{usual.kcal.toLocaleString()}</Text>
                          <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                        </Text>
                      </View>
                      <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 3 }}>{confident ? 'One tap to log — I learned this one.' : 'Did you have your planned meal?'}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                        <PortionChip label="bit less" kcal={kAt(chips.less)} onPress={() => logUsual(slot, chips.less)} />
                        <PortionChip label="✓ the usual" kcal={kAt(chips.usual)} primary onPress={() => logUsual(slot, chips.usual)} />
                        <PortionChip label="bit more" kcal={kAt(chips.more)} onPress={() => logUsual(slot, chips.more)} />
                      </View>
                      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 16 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                        <TextLink label="Something else →" onPress={() => setAddSlot({ slot, epochDay: todayEpoch })} />
                        <TextLink label="Skip this meal" onPress={() => skipMeal(slot)} tone="neutral" />
                      </View>
                    </View>
                  );
                })() : null}

                {/* §6: ONE smart suggestion list (budget-fit + kitchen-first by
                    default, no source picker). Shuffle (in the header) rerolls it.
                    The usual card (the moat) still wins the slot above when sure. */}
                {open && !usual ? (() => {
                  const items = smartSuggest(suggestCtx(slot, cur, offsets[slot] ?? 0));
                  return (
                    <>
                      <SmartRows
                        items={items}
                        metaFor={dishMeta}
                        onOpen={(sc) => openRecipe(sc, slot)}
                        onLog={(sc) => logMeal(slot, sc, todayEpoch)}
                      />
                      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 12 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                        <TextLink label="＋ More" onPress={() => setAddSlot({ slot, epochDay: todayEpoch })} />
                        <TextLink label="Skip this meal" onPress={() => skipMeal(slot)} tone="neutral" />
                      </View>
                    </>
                  );
                })() : null}

                {s.skipped ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ color: c('textMuted'), fontSize: 14 }}>Skipped — no worries.</Text>
                    <TextLink label="Undo" onPress={() => s.skipId && deleteLog(s.skipId)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <MixSheet visible={mix !== null} currentName={mix?.recipe.name ?? ''} options={mixOptions} loading={mixLoading} onPick={pickMix} onClose={() => setMix(null)} />
      <RecipeSheet recipe={sheet} onClose={() => setSheet(null)} />
      <Overview visible={showOverview} onClose={() => setShowOverview(false)} profile={profile} goal={goal} prefs={prefs} />
      <AddSheet
        visible={addSlot !== null}
        slotLabel={addSlot ? cap(addSlot.slot) : ''}
        have={have}
        planned={addSlot ? addPlanned(addSlot.slot, addSlot.epochDay) : null}
        onLog={(it) => {
          if (addSlot) {
            const past = addSlot.epochDay < todayEpoch;
            logFood(it.id, { slot: addSlot.slot, kcal: it.kcal, portionG: it.portionG, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, name: it.name, source: it.source, taps: 2, ...(past ? { ts: tsFor(addSlot.epochDay, addSlot.slot) } : {}) });
          }
          setAddSlot(null);
        }}
        onClose={() => setAddSlot(null)}
      />
    </View>
  );
}

function greetingFor(now: number): string {
  const hour = new Date(now).getHours();
  return hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
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
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={dir === 'up' ? 'I liked this' : 'Not for me'}
        accessibilityState={{ selected: on }}
        style={{ width: 34, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c('surfaceSunken') : c('chipSurface'), borderWidth: 1, borderColor: on ? tone : 'transparent' }}
      >
        <Text style={{ fontSize: 14, color: on ? tone : c('textMuted') }}>{glyph}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {btn('up', '👍')}
      {btn('down', '👎')}
    </View>
  );
}

/** §7 near-miss as a first-class line. */
function PantryLine({ cook }: { cook: Cookability | null }) {
  const { c } = useTheme();
  if (!cook) return null;
  if (cook.tier === 'oneShort') {
    const need = cook.missing.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    return <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600', marginTop: 8 }}>Just need: {need}</Text>;
  }
  // Full-kitchen "✓ All in your kitchen" match is surfaced on the smart rows and in
  // the dish sheet; the planned card keeps just the "Just need: …" nudge.
  return null;
}
