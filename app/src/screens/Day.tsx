import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localParts, logEvents, portionChips } from '@yumo/brain';
import type { MealSlot } from '@yumo/shared';
import type { MenuRecipe, UserProfile, WeekMenuPlan } from '@yumo/menu';
import { useTheme } from '../theme';
import { useToday } from '../useToday';
import { useNow } from '../useNow';
import { useEventStore } from '../data/eventStore';
import { useKitchen } from '../data/kitchenStore';
import { getMenu, getMixup, getRecipeDetail, portionLabel, makePantryFit, type Source, type RecipeIngredientLine } from '../data/repo';
import { learnedWeights, mixReason } from '../data/menuPrefs';
import { weekMenuFor } from '../data/menuBridge';
import { resolveFoodMeta } from '../data/resolveFoodMeta';
import { cookability, type Cookability } from '../data/cookability';
import { expiringItems, expiringUsedBy, recipesUsingExpiring } from '../data/expiring';
import { POOL } from '../data/menu-seed';
import { SLOT_TIME } from '../data/seed';
import { BudgetRing } from '../components/BudgetRing';
import { CoachLine } from '../components/CoachLine';
import { MacroBar } from '../components/MacroBar';
import { Overview } from './Overview';
import { macroTargets } from '../data/macros';
import { MixSheet, type MixOption } from '../components/MixSheet';
import { RecipeSheet } from '../components/RecipeSheet';
import { AddSheet, type AddItem } from '../components/AddSheet';
import { Serif, Kicker, Card, PrimaryButton, MixButton, OutlineButton, TextLink, Skeleton, ACCENT_BORDER } from '../components/kit';
import { SwipeRow } from '../components/SwipeRow';
import { track } from '../analytics';
import { coach } from '../coach/pack';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const num = { fontVariant: ['tabular-nums' as const] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type Cur = { recipe: MenuRecipe; kcal: number; protein: number; carbs: number; fat: number; portionScale: number };

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
export function Day({ profile }: { profile: UserProfile }) {
  const { c } = useTheme();
  const { events, logFood, skipMeal, deleteLog, recordMixupPick, thumbRecipe, thumbs } = useEventStore();
  const kitchen = useKitchen();
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
    if (on || kitchen.emptyMode) for (const r of POOL) if (cookability(r, have).tier === 'now') ids.add(r.id);
    return [...ids];
  };
  const [plan, setPlan] = useState<WeekMenuPlan | null>(null);
  const [, setSource] = useState<Source>('local');
  const [dayIdx, setDayIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, MenuRecipe>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [fromKitchen, setFromKitchen] = useState(false);
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
  }, [profile, kitchen.emptyMode, expiringKey]);

  const toggleKitchen = () => {
    const next = !fromKitchen;
    setFromKitchen(next);
    const p = next ? { ...profile, pantry: [...have] } : profile;
    getMenu(p, undefined, kitchenBoost(next), next ? makePantryFit(have) : undefined, userWeights).then((r) => { setPlan(r.plan); setSource(r.source); });
  };
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
  const isLoggedNow = (slot: MealSlot, recipeId: string) => loggedToday.has(`${slot}:${recipeId}`);

  // ── sheets ──────────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<{ name: string; kcal: number; steps: string[]; ingredients: RecipeIngredientLine[]; methods?: string[]; portion?: string } | null>(null);
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
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
          <Kicker>{greetingFor(now)}</Kicker>
          <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2, marginBottom: 20 }}>Today</Serif>
          <View style={{ alignItems: 'center', marginBottom: 22 }}><Skeleton width={196} height={196} radius={98} /></View>
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

  // §5 computed coach line (today's remaining plan vs the budget).
  const coachText = (() => {
    const remainingSlots: string[] = [];
    let plannedKcal = 0;
    for (const s of state.slots) {
      if (s.items.length || s.skipped) continue;
      const p = currentForToday(s.slot);
      if (!p) continue;
      remainingSlots.push(s.slot);
      plannedKcal += p.kcal;
    }
    const left = state.budget - state.eaten;
    if (remainingSlots.length === 0) return left >= 0 ? `${left.toLocaleString()} kcal spare today — nicely done.` : 'Day logged. Tomorrow is a fresh start.';
    const spare = left - plannedKcal;
    if (spare >= 0) return `Your ${remainingSlots.join(' + ')} fit today's budget with ${spare.toLocaleString()} kcal spare.`;
    return `The menu runs ${Math.abs(spare).toLocaleString()} kcal over — Mix it up for a lighter pick.`;
  })();
  /** Planned pick for TODAY's date (coach line + ladder use today even when browsing another day). */
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
  const logTile = (slot: MealSlot, t: { foodId: string; name: string; kcal: number; portionG: number }) => {
    logFood(t.foodId, { slot, kcal: t.kcal, portionG: t.portionG, name: t.name, source: 'tile', taps: 2 });
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
  const openRecipe = (cur: Cur) => {
    const s = Math.max(0.5, Math.round(cur.portionScale * 2) / 2);
    return getRecipeDetail(cur.recipe, s).then((d) =>
      setSheet({ name: cur.recipe.name, kcal: cur.kcal, steps: d.steps, ingredients: d.ingredients, methods: d.methods, portion: portionLabel(s) }));
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
      setSheet({ name: r.name, kcal, steps: d.steps, ingredients: d.ingredients, methods: d.methods, portion: portionLabel(s) }));
  };
  const addPlanned = (slot: MealSlot): AddItem | null => {
    const p = currentForToday(slot);
    return p ? { id: p.recipe.id, name: p.recipe.name, kcal: p.kcal, proteinG: p.protein, carbsG: p.carbs, fatG: p.fat, source: 'menu' } : null;
  };

  const d = new Date(now);
  const dateStr = `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;


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
        <PantryLine cook={cook} showReady={fromKitchen} />
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
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kicker>{greetingFor(now)}</Kicker>
            <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Today</Serif>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
            <Text style={{ color: c('textMuted'), fontSize: 13 }}>{dateStr}</Text>
            <Pressable onPress={planNextWeek} disabled={regenerating} accessibilityRole="button" accessibilityLabel="New week" style={{ paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999, backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border') }}>
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{regenerating ? 'New week…' : '↻ New week'}</Text>
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
            <View style={{ marginTop: 18, marginBottom: (showWaste || learnedNote) ? 10 : 4 }}>
              <CoachLine text={coachText} />
            </View>
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
              <Pressable key={i} onPress={() => { setDayIdx(i); setMix(null); }} accessibilityRole="button" accessibilityLabel={`${DOW[dd.dayOfWeek]}${isTd ? ', today' : ''}`} accessibilityState={{ selected: on }} style={{ flex: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? c('accent') : 'transparent' }}>
                <Text style={{ color: on ? c('accentText') : isTd ? c('accentSoft') : c('textMuted'), fontSize: 11, fontWeight: '600', opacity: on ? 0.7 : 1 }}>{DOW[dd.dayOfWeek]}</Text>
                <Text style={[{ color: on ? c('accentText') : c('textPrimary'), fontSize: 16, fontWeight: '700', marginTop: 2 }, num]}>{new Date(epochOf(i) * 86_400_000).getUTCDate()}</Text>
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

        {/* summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 12 }}>
          {isPast ? (
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 15, fontWeight: '700' }, num]}>{pastEaten.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> eaten · </Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 15, fontWeight: '700' }, num]}>{dayTotal.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> planned</Text>
            </Text>
          ) : (
            <Text>
              <Text style={[{ color: c('textPrimary'), fontSize: 15, fontWeight: '700' }, num]}>{dayTotal.toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}> kcal planned</Text>
            </Text>
          )}
          {isToday && loggedCount > 0 ? <Text style={{ color: c('success'), fontSize: 13, fontWeight: '600' }}>{loggedCount} logged ✓</Text> : null}
        </View>

        {/* from-your-kitchen toggle */}
        <Pressable onPress={toggleKitchen} accessibilityRole="switch" accessibilityState={{ checked: fromKitchen }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: fromKitchen ? c('accentFaint') : c('chipSurface'), borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: fromKitchen ? ACCENT_BORDER : c('border'), marginBottom: 12 }}>
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
            const tiles = open && s.isCurrent && !usual ? state.tiles.slice(0, 3) : [];
            const showPlanned = open && !usual && tiles.length === 0;

            return (
              <Card key={slot} current={s.isCurrent} logged={s.items.length > 0}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: s.isCurrent ? c('accentSoft') : c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{cap(slot)}</Text>
                  {s.items.length ? (
                    <Text>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }, num]}>{s.kcal.toLocaleString()}</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 11 }}> kcal</Text>
                    </Text>
                  ) : showPlanned ? (
                    // the cuisine·effort meta belongs to the PLANNED meal — only show it
                    // when the planned block is what's underneath (not over tiles/usual).
                    <Text style={{ color: c('textMuted'), fontSize: 12 }}>{cur.recipe.cuisine} · {cur.recipe.effort}</Text>
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

                {tiles.length ? (
                  <View style={{ marginTop: 10 }}>
                    {/* quiet kicker — the slot label above is the only accent voice */}
                    <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>Quick log</Text>
                    {tiles.map((t, i) => {
                      const hasRecipe = recipeFor(t.foodId, t.name) != null;
                      return (
                        <View key={t.foodId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}>
                          <Pressable disabled={!hasRecipe} onPress={() => openRecipeByRef(t.foodId, t.name, t.kcal)} accessibilityRole={hasRecipe ? 'button' : undefined} accessibilityLabel={hasRecipe ? `${t.name}, view recipe` : undefined} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
                            <Text style={{ color: c('textPrimary'), fontSize: 16, flexShrink: 1 }} numberOfLines={1}>{t.name}</Text>
                            {hasRecipe ? <Text style={{ color: c('textMuted'), fontSize: 15, marginLeft: 6 }}>›</Text> : null}
                          </Pressable>
                          <Text style={[{ color: c('textSecondary'), fontSize: 14, marginRight: 6 }, num]}>{t.kcal} kcal</Text>
                          <Pressable onPress={() => logTile(slot, t)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Log ${t.name}`} style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
                            <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600' }}>＋</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                    {/* the planned meal stays reachable: see it, read it, mix it */}
                    <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 6 }} />
                    <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12 }}>On the menu</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 }}>
                      <Pressable onPress={() => openRecipe(cur)} accessibilityRole="button" accessibilityLabel={`${cur.recipe.name}, view recipe`} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
                        <Serif size={17} color={c('textPrimary')} style={{ flexShrink: 1, lineHeight: 21 }}>{cur.recipe.name}</Serif>
                        <Text style={{ color: c('textMuted'), fontSize: 15, marginLeft: 6 }}>›</Text>
                      </Pressable>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13 }, num]}>{cur.kcal.toLocaleString()} kcal</Text>
                      <MixButton label="Mix" onPress={() => openMix(`${dayIdx}:${slot}`, cur.recipe, slot)} />
                    </View>
                    <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 12 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
                      <TextLink label="＋ More" onPress={() => setAddSlot({ slot, epochDay: todayEpoch })} />
                      <TextLink label="Skip this meal" onPress={() => skipMeal(slot)} tone="neutral" />
                    </View>
                  </View>
                ) : null}

                {showPlanned ? plannedBlock(slot, cur, { loggable: true, addLink: true, skipLink: true }) : null}

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
      <Overview visible={showOverview} onClose={() => setShowOverview(false)} profile={profile} />
      <AddSheet
        visible={addSlot !== null}
        slotLabel={addSlot ? cap(addSlot.slot) : ''}
        planned={addSlot ? addPlanned(addSlot.slot) : null}
        onLog={(it) => {
          if (addSlot) {
            const past = addSlot.epochDay < todayEpoch;
            logFood(it.id, { slot: addSlot.slot, kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, name: it.name, source: it.source, taps: 2, ...(past ? { ts: tsFor(addSlot.epochDay, addSlot.slot) } : {}) });
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
function PantryLine({ cook, showReady }: { cook: Cookability | null; showReady: boolean }) {
  const { c } = useTheme();
  if (!cook) return null;
  if (cook.tier === 'oneShort') {
    const need = cook.missing.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
    return <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600', marginTop: 8 }}>Just need: {need}</Text>;
  }
  if (cook.tier === 'now' && showReady) {
    return <Text style={{ color: c('success'), fontSize: 13, fontWeight: '600', marginTop: 8 }}>✓ All in your kitchen</Text>;
  }
  return null;
}
