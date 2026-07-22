import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import { Sheet, Serif, Kicker, TextLink, PrimaryButton } from './kit';
import { SwipeRow } from './SwipeRow';
import { BarcodeScanner } from './BarcodeScanner';
import { searchFoods, lookupBarcode } from '../data/repo';
import { POOL } from '../data/menu-seed';
import { SINGLE_FOODS } from '../data/foods-seed';
import { useMyMeals } from '../data/myMeals';
import { cookability } from '../data/cookability';
import { effortMin } from '../data/effort';
import type { MenuRecipe } from '@yumo/menu';

export interface Macros { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface AddItem {
  id: string;
  name: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** display portion for FOODS rows. */
  portion?: string;
  /** numeric grams when this item came from the portion stepper — M5 needs it so
   * "Save to my meals" can record the portion (the string `portion` is display). */
  portionG?: number;
  /** per-100g macros — present on gram-based FDC ingredients → enables the portion stepper. */
  per100g?: Macros;
  /** §7 sort metadata (recipes only) — cook time bucket + ingredient count. */
  effort?: MenuRecipe['effort'];
  ingredientCount?: number;
  source: string;
}

const num = { fontVariant: ['tabular-nums' as const] };

type SortKey = 'smart' | 'kcal' | 'protein' | 'quick' | 'ingredients';
const SORTS: { k: SortKey; label: string }[] = [
  { k: 'smart', label: '✦ Smart' },
  { k: 'kcal', label: 'Lowest kcal' },
  { k: 'protein', label: 'High protein' },
  { k: 'quick', label: 'Quickest' },
  { k: 'ingredients', label: 'Fewest ingredients' },
];
const SORT_SHORT: Record<SortKey, string> = { smart: 'Smart', kcal: 'Lowest kcal', protein: 'High protein', quick: 'Quickest', ingredients: 'Fewest' };
const CAPS: { v: number | null; label: string }[] = [
  { v: null, label: 'Any calories' },
  { v: 250, label: 'Under 250 kcal' },
  { v: 500, label: 'Under 500 kcal' },
  { v: 700, label: 'Under 700 kcal' },
];

const MEALS: AddItem[] = POOL.map((r) => ({
  id: r.id,
  name: r.name,
  kcal: Math.round(r.perServing.kcal),
  proteinG: Math.round(r.perServing.protein_g),
  carbsG: Math.round(r.perServing.carbs_g ?? 0),
  fatG: Math.round(r.perServing.fat_g ?? 0),
  effort: r.effort,
  ingredientCount: r.foodTokens.length,
  source: 'menu',
}));

const FOODS: AddItem[] = SINGLE_FOODS.map((f) => ({ id: f.id, name: f.name, kcal: f.kcal, portion: f.portion, source: 'search' }));

function BarcodeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {[3, 6, 8, 11, 14, 16, 19].map((x, i) => (
        <Rect key={i} x={x} y={5} width={i % 2 === 0 ? 1.4 : 2.2} height={14} fill={color} />
      ))}
    </Svg>
  );
}

const clampG = (g: number) => Math.max(5, Math.min(2000, g));
const macrosAt = (p: Macros, g: number) => ({
  kcal: Math.round((p.kcal * g) / 100),
  proteinG: Math.round((p.protein_g * g) / 100),
  carbsG: Math.round((p.carbs_g * g) / 100),
  fatG: Math.round((p.fat_g * g) / 100),
});

/** Round 52px stepper button used by the portion editor. */
function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', backgroundColor: c('surfaceSunken'), opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('textPrimary'), fontSize: 24, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function AddSheet({
  visible,
  slotLabel,
  planned,
  have,
  onLog,
  onClose,
}: {
  visible: boolean;
  slotLabel: string;
  planned: AddItem | null;
  /** kitchen tokens — enables the §7 "My kitchen" filter (recipes cookable now). */
  have?: Set<string>;
  onLog: (item: AddItem) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('smart');
  const [cap, setCap] = useState<number | null>(null);
  const [kitchenOnly, setKitchenOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'sort' | 'cap' | null>(null);
  const [hits, setHits] = useState<AddItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  // the ingredient being portioned (gram-based FDC food) + chosen grams.
  const [editing, setEditing] = useState<{ item: AddItem; grams: number } | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { setQ(''); setSort('smart'); setCap(null); setKitchenOnly(false); setMenuOpen(null); setHits([]); setFocused(false); setEditing(null); setScanning(false); setScanMsg(null); }
  }, [visible]);

  useEffect(() => {
    if (!visible || q.trim().length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchFoods(q)
        .then((r) => setHits(r.map((h) => ({
          id: `fdc:${h.fdcId}`,
          name: h.description,
          kcal: Math.round(h.per100g.kcal), // shown per 100 g; the stepper scales it
          portion: '100 g',
          per100g: h.per100g,
          source: 'search',
        }))))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, visible]);

  const { meals: savedMeals, remove: removeMeal } = useMyMeals();
  const myMealItems = useMemo<AddItem[]>(
    () => savedMeals.map((m) => ({ id: m.id, name: m.name, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG, portionG: m.portionG, portion: m.portion, source: 'mymeal' })),
    [savedMeals],
  );

  const filtering = q.trim().length > 0 || cap !== null || kitchenOnly || sort !== 'smart';
  const expanded = focused || q.trim().length > 0;
  const cookNow = (it: AddItem) => {
    if (it.source !== 'menu' || !have?.size) return false;
    const r = POOL.find((x) => x.id === it.id);
    return r ? cookability(r, have).tier === 'now' : false;
  };
  const match = (it: AddItem) =>
    (q.trim().length < 2 || it.name.toLowerCase().includes(q.trim().toLowerCase())) &&
    (cap === null || it.kcal <= cap) &&
    (!kitchenOnly || cookNow(it));
  const cmp = (a: AddItem, b: AddItem): number => {
    switch (sort) {
      case 'kcal': return a.kcal - b.kcal;
      case 'protein': return (b.proteinG ?? -1) - (a.proteinG ?? -1);
      case 'quick': return (a.effort ? effortMin(a.effort) : 999) - (b.effort ? effortMin(b.effort) : 999);
      case 'ingredients': return (a.ingredientCount ?? 999) - (b.ingredientCount ?? 999);
      default: return 0; // ✦ Smart = the engine / source order
    }
  };
  const sorted = (xs: AddItem[]) => (sort === 'smart' ? xs : [...xs].sort(cmp));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myMeals = useMemo(() => sorted(myMealItems.filter(match)), [q, cap, kitchenOnly, sort, myMealItems, have]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const meals = useMemo(() => sorted(MEALS.filter(match)), [q, cap, kitchenOnly, sort, have]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const foods = useMemo(() => sorted([...FOODS, ...hits].filter(match)), [q, cap, kitchenOnly, sort, hits, have]);
  const nothing = filtering && myMeals.length === 0 && meals.length === 0 && foods.length === 0 && !loading;

  // A gram-based ingredient (has per100g) opens the portion stepper; curated foods
  // and per-serving meals log in a single tap.
  const tap = (it: AddItem) => { if (it.per100g) setEditing({ item: it, grams: 100 }); else onLog(it); };

  const onScanned = async (ean: string) => {
    setScanning(false);
    setScanMsg(null);
    const food = await lookupBarcode(ean);
    if (food) setEditing({ item: { id: `off:${food.fdcId}`, name: food.description, kcal: Math.round(food.per100g.kcal), portion: '100 g', per100g: food.per100g, source: 'barcode' }, grams: 100 });
    else setScanMsg(`Couldn't find barcode ${ean}. Try search instead.`);
  };

  const Row = ({ it, meal }: { it: AddItem; meal?: boolean }) => (
    <Pressable onPress={() => tap(it)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '500' }} numberOfLines={2}>{it.name}</Text>
        {meal && it.proteinG != null ? (
          <Text style={[{ color: c('textMuted'), fontSize: 12, marginTop: 2 }, num]}>{it.proteinG}P · {it.carbsG}C · {it.fatG}F</Text>
        ) : it.portion ? (
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>{it.per100g ? `per ${it.portion} · tap to set amount` : it.portion}</Text>
        ) : null}
      </View>
      <Text style={[{ color: c('textSecondary'), fontSize: 14, marginRight: 12 }, num]}>{it.kcal} kcal</Text>
      <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600' }}>＋</Text>
    </Pressable>
  );

  // ── Portion stepper (for a gram-based ingredient) ──────────────────────────
  if (editing) {
    const p = editing.item.per100g!;
    const g = editing.grams;
    const m = macrosAt(p, g);
    const step = (d: number) => setEditing((e) => (e ? { ...e, grams: clampG(e.grams + d) } : e));
    const setG = (grams: number) => setEditing((e) => (e ? { ...e, grams } : e));
    return (
      <Sheet visible={visible} onClose={onClose}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <Serif size={22} weight="medium" color={c('textPrimary')} style={{ flex: 1, marginRight: 10 }}>{editing.item.name}</Serif>
          <TextLink label="Back" onPress={() => setEditing(null)} tone="neutral" />
        </View>
        <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 20 }}>Set the amount for {slotLabel.toLowerCase()}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 18 }}>
          <StepButton label="−" onPress={() => step(-10)} />
          <View style={{ alignItems: 'center', minWidth: 120 }}>
            <Text style={[{ color: c('textPrimary'), fontSize: 34, fontWeight: '800' }, num]}>{g}</Text>
            <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: -2 }}>grams</Text>
          </View>
          <StepButton label="＋" onPress={() => step(10)} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {[50, 100, 150, 200].map((preset) => {
            const on = g === preset;
            return (
              <Pressable key={preset} onPress={() => setG(preset)} style={{ borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: on ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: on ? c('accent') : 'rgba(247,242,234,0.09)' }}>
                <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{preset}g</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, backgroundColor: c('surfaceSunken'), borderRadius: 16, marginBottom: 20 }}>
          {([['kcal', `${m.kcal}`], ['protein', `${m.proteinG}g`], ['carbs', `${m.carbsG}g`], ['fat', `${m.fatG}g`]] as Array<[string, string]>).map(([label, val]) => (
            <View key={label} style={{ alignItems: 'center' }}>
              <Text style={[{ color: c('textPrimary'), fontSize: 17, fontWeight: '700' }, num]}>{val}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 11, marginTop: 2 }}>{label}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label={`Add ${m.kcal} kcal`} full onPress={() => onLog({ ...editing.item, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG, portion: `${g} g`, portionG: g })} />
      </Sheet>
    );
  }

  return (
    <>
      <Sheet visible={visible} onClose={onClose} expanded={expanded}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Serif size={24} weight="medium" color={c('textPrimary')}>Add to {slotLabel}</Serif>
          <TextLink label="Cancel" onPress={onClose} tone="neutral" />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <TextInput
            ref={inputRef}
            placeholder="Search foods or scan…"
            placeholderTextColor={c('textMuted')}
            value={q}
            onChangeText={setQ}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            style={{ flex: 1, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: focused ? c('accent') : c('border'), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 15 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode"
            onPress={() => { setScanMsg(null); setScanning(true); }}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 14, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <BarcodeIcon color={c('textSecondary')} />
          </Pressable>
        </View>

        {scanMsg ? <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 10 }}>{scanMsg}</Text> : null}

        {/* §7 sort · calorie cap · my kitchen (replaces the old ~250/~500/~700 caps) */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          <Pressable onPress={() => setMenuOpen((m) => (m === 'sort' ? null : 'sort'))} accessibilityRole="button" accessibilityLabel={`Sort: ${SORT_SHORT[sort]}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 }}>
            <Text style={{ color: c('textMuted'), fontSize: 12 }}>Sort </Text>
            <Text style={{ color: c('textPrimary'), fontSize: 13, fontWeight: '600' }}>{SORT_SHORT[sort]} ▾</Text>
          </Pressable>
          <Pressable onPress={() => setMenuOpen((m) => (m === 'cap' ? null : 'cap'))} accessibilityRole="button" accessibilityLabel={cap === null ? 'Calorie cap: any' : `Calorie cap: under ${cap}`} style={{ backgroundColor: cap !== null ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: cap !== null ? c('accent') : 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 }}>
            <Text style={{ color: cap !== null ? c('accentText') : c('textPrimary'), fontSize: 13, fontWeight: '600' }}>{cap === null ? 'Any kcal' : `Under ${cap}`} ▾</Text>
          </Pressable>
          <Pressable onPress={() => setKitchenOnly((k) => !k)} accessibilityRole="button" accessibilityState={{ selected: kitchenOnly }} accessibilityLabel="My kitchen only" style={{ backgroundColor: kitchenOnly ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: kitchenOnly ? c('accent') : 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 }}>
            <Text style={{ color: kitchenOnly ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>My kitchen</Text>
          </Pressable>
        </View>

        {menuOpen ? (
          <View style={{ backgroundColor: c('accentSubtle'), borderWidth: 1, borderColor: c('borderStrong'), borderRadius: 14, padding: 6, marginBottom: 8 }}>
            {(menuOpen === 'sort'
              ? SORTS.map((s) => ({ key: s.k, label: s.label, on: sort === s.k, pick: () => { setSort(s.k); setMenuOpen(null); } }))
              : CAPS.map((cp) => ({ key: String(cp.v), label: cp.label, on: cap === cp.v, pick: () => { setCap(cp.v); setMenuOpen(null); } }))
            ).map((o) => (
              <Pressable key={o.key} onPress={o.pick} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9, backgroundColor: o.on ? c('accentFaint') : 'transparent' }}>
                <Text style={{ color: o.on ? c('accentSoft') : c('textSecondary'), fontSize: 13.5, fontWeight: '600' }}>{o.label}</Text>
                {o.on ? <Text style={{ color: c('accent'), fontSize: 13 }}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={expanded ? { flex: 1 } : { maxHeight: 420 }} contentContainerStyle={{ paddingBottom: expanded ? 28 : 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {planned && !filtering ? (
            <View style={{ marginTop: 8 }}>
              <Kicker>From your menu</Kicker>
              <Pressable onPress={() => onLog(planned)} style={({ pressed }) => ({ marginTop: 8, backgroundColor: c('accentFaint'), borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Serif size={18} color={c('textPrimary')} style={{ flex: 1 }}>{planned.name}</Serif>
                <Text style={[{ color: c('accentSoft'), fontSize: 15, fontWeight: '700' }, num]}>{planned.kcal} kcal</Text>
              </Pressable>
            </View>
          ) : null}

          {myMeals.length ? (
            <View style={{ marginTop: 18 }}>
              <Kicker>My meals</Kicker>
              <View style={{ marginTop: 4 }}>
                {myMeals.map((it) => (
                  <SwipeRow key={it.id} onDelete={() => removeMeal(it.id)}>
                    <Row it={it} meal />
                  </SwipeRow>
                ))}
              </View>
            </View>
          ) : null}

          {foods.length ? (
            <View style={{ marginTop: 18 }}>
              <Kicker>Foods</Kicker>
              <View style={{ marginTop: 4 }}>{foods.map((it) => <Row key={it.id} it={it} />)}</View>
            </View>
          ) : null}

          {loading ? <ActivityIndicator color={c('accent')} style={{ marginTop: 16 }} /> : null}

          {meals.length ? (
            <View style={{ marginTop: 18 }}>
              <Kicker>Meals</Kicker>
              <View style={{ marginTop: 4 }}>{meals.map((it) => <Row key={it.id} it={it} meal />)}</View>
            </View>
          ) : null}

          {nothing ? (
            <Text style={{ color: c('textMuted'), fontSize: 14, textAlign: 'center', marginTop: 28 }}>Nothing matching — try a different search or filter.</Text>
          ) : null}
          <View style={{ height: 12 }} />
        </ScrollView>
      </Sheet>

      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={onScanned} />
    </>
  );
}
