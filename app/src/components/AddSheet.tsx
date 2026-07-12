import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import { Sheet, Serif, Kicker, TextLink } from './kit';
import { searchFoods } from '../data/repo';
import { POOL } from '../data/menu-seed';
import { SINGLE_FOODS } from '../data/foods-seed';

export interface AddItem {
  id: string;
  name: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** display portion for FOODS rows. */
  portion?: string;
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

  useEffect(() => {
    if (!visible) { setQ(''); setBand(null); setHits([]); return; }
  }, [visible]);

  useEffect(() => {
    if (!visible || q.trim().length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchFoods(q)
        .then((r) => setHits(r.map((h) => ({ id: `fdc:${h.fdcId}`, name: h.description, kcal: Math.round((h.per100g.kcal * 150) / 100), proteinG: Math.round((h.per100g.protein_g * 150) / 100), portion: '150 g', source: 'search' }))))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, visible]);

  const filtering = q.trim().length > 0 || band !== null;
  const match = (it: AddItem) => (q.trim().length < 2 || it.name.toLowerCase().includes(q.trim().toLowerCase())) && (band === null || nearestBand(it.kcal) === band);
  const meals = useMemo(() => MEALS.filter(match), [q, band]);
  const foods = useMemo(() => [...FOODS.filter(match), ...hits.filter((h) => band === null || nearestBand(h.kcal) === band)], [q, band, hits]);

  const nothing = filtering && meals.length === 0 && foods.length === 0 && !loading;

  const Row = ({ it, meal }: { it: AddItem; meal?: boolean }) => (
    <Pressable onPress={() => onLog(it)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '500' }}>{it.name}</Text>
        {meal ? (
          <Text style={[{ color: c('textMuted'), fontSize: 12, marginTop: 2 }, num]}>{it.proteinG}P · {it.carbsG}C · {it.fatG}F</Text>
        ) : it.portion ? (
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>{it.portion}</Text>
        ) : null}
      </View>
      <Text style={[{ color: c('textSecondary'), fontSize: 14, marginRight: 12 }, num]}>{it.kcal} kcal</Text>
      <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600' }}>＋</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Add to {slotLabel}</Serif>
        <TextLink label="Cancel" onPress={onClose} tone="neutral" />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <TextInput
          placeholder="Search foods or scan…"
          placeholderTextColor={c('textMuted')}
          value={q}
          onChangeText={setQ}
          style={{ flex: 1, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 15 }}
        />
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), alignItems: 'center', justifyContent: 'center' }}>
          <BarcodeIcon color={c('textMuted')} />
        </View>
      </View>

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

      <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
        {planned && !filtering ? (
          <View style={{ marginTop: 8 }}>
            <Kicker>From your menu</Kicker>
            <Pressable onPress={() => onLog(planned)} style={({ pressed }) => ({ marginTop: 8, backgroundColor: c('accentFaint'), borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Serif size={18} color={c('textPrimary')} style={{ flex: 1 }}>{planned.name}</Serif>
              <Text style={[{ color: c('accentSoft'), fontSize: 15, fontWeight: '700' }, num]}>{planned.kcal} kcal</Text>
            </Pressable>
          </View>
        ) : null}

        {meals.length ? (
          <View style={{ marginTop: 18 }}>
            <Kicker>Meals</Kicker>
            <View style={{ marginTop: 4 }}>{meals.map((it) => <Row key={it.id} it={it} meal />)}</View>
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={c('accent')} style={{ marginTop: 16 }} /> : null}

        {foods.length ? (
          <View style={{ marginTop: 18 }}>
            <Kicker>Foods</Kicker>
            <View style={{ marginTop: 4 }}>{foods.map((it) => <Row key={it.id} it={it} />)}</View>
          </View>
        ) : null}

        {nothing ? (
          <Text style={{ color: c('textMuted'), fontSize: 14, textAlign: 'center', marginTop: 28 }}>Nothing matching — try a different search or filter.</Text>
        ) : null}
        <View style={{ height: 12 }} />
      </ScrollView>
    </Sheet>
  );
}
