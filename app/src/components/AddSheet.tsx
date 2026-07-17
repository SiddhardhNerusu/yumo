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
  source: string;
}

const BANDS = [250, 500, 700] as const;
const num = { fontVariant: ['tabular-nums' as const] };

/** Nearest calorie band, or null for 'all'. */
function nearestBand(kcal: number): number {
  return BANDS.reduce((best, b) => (Math.abs(b - kcal) < Math.abs(best - kcal) ? b : best), BANDS[0]);
}

const MEALS: AddItem[] = POOL.map((r) => ({
  id: r.id,
  name: r.name,
  kcal: Math.round(r.perServing.kcal),
  proteinG: Math.round(r.perServing.protein_g),
  carbsG: Math.round(r.perServing.carbs_g ?? 0),
  fatG: Math.round(r.perServing.fat_g ?? 0),
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
  onLog,
  onClose,
}: {
  visible: boolean;
  slotLabel: string;
  planned: AddItem | null;
  onLog: (item: AddItem) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [band, setBand] = useState<number | null>(null);
  const [hits, setHits] = useState<AddItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  // the ingredient being portioned (gram-based FDC food) + chosen grams.
  const [editing, setEditing] = useState<{ item: AddItem; grams: number } | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { setQ(''); setBand(null); setHits([]); setFocused(false); setEditing(null); setScanning(false); setScanMsg(null); }
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

  const filtering = q.trim().length > 0 || band !== null;
  const expanded = focused || q.trim().length > 0;
  const match = (it: AddItem) => (q.trim().length < 2 || it.name.toLowerCase().includes(q.trim().toLowerCase())) && (band === null || nearestBand(it.kcal) === band);
  const myMeals = useMemo(() => myMealItems.filter(match), [q, band, myMealItems]);
  const meals = useMemo(() => MEALS.filter(match), [q, band]);
  const foods = useMemo(() => [...FOODS.filter(match), ...hits.filter((h) => band === null || nearestBand(h.kcal) === band)], [q, band, hits]);
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

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {([['All', null], ['~250', 250], ['~500', 500], ['~700', 700]] as Array<[string, number | null]>).map(([label, val]) => {
            const on = band === val;
            return (
              <Pressable key={label} onPress={() => setBand(val)} style={{ flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: on ? c('accent') : 'rgba(247,242,234,0.09)' }}>
                <Text style={{ color: on ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

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
