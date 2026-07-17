import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Sheet, Serif, Kicker, TextLink } from './kit';
import type { MacroTargets, MacrosEaten } from '../data/macros';

const num = { fontVariant: ['tabular-nums' as const] };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface MealBreakdown {
  slot: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  items: Array<{ name: string; kcal: number }>;
}

/**
 * The Overview — MFP's best pattern (totals · goal · remaining per macro, plus a
 * per-meal breakdown) without its jargon or data overload: grams first, four
 * numbers per row, one plain-English line about what to do next.
 */
export function NutritionSheet({ visible, onClose, budget, eatenKcal, eaten, targets, meals, note }: {
  visible: boolean;
  onClose: () => void;
  budget: number;
  eatenKcal: number;
  eaten: MacrosEaten;
  targets: MacroTargets;
  meals: MealBreakdown[];
  note: string | null;
}) {
  const { c } = useTheme();
  const left = budget - eatenKcal;
  const rows: Array<{ label: string; got: number; want: number; accent: boolean }> = [
    { label: 'Protein', got: Math.round(eaten.proteinG), want: targets.proteinG, accent: true },
    { label: 'Carbs', got: Math.round(eaten.carbsG), want: targets.carbsG, accent: false },
    { label: 'Fat', got: Math.round(eaten.fatG), want: targets.fatG, accent: false },
  ];
  const logged = meals.filter((m) => m.items.length > 0);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Today's nutrition</Serif>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: 520 }}>
        {/* calories: eaten · left · budget */}
        <View style={{ flexDirection: 'row', backgroundColor: c('surfaceSunken'), borderRadius: 16, paddingVertical: 14 }}>
          {([['eaten', eatenKcal], [left >= 0 ? 'left' : 'over', Math.abs(left)], ['budget', budget]] as Array<[string, number]>).map(([label, v], i) => (
            <View key={label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c('divider') }}>
              <Text style={[{ color: c('textPrimary'), fontSize: 19, fontWeight: '800' }, num]}>{Math.round(v).toLocaleString()}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 11.5, marginTop: 2 }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* macros: eaten / target with a meter and a to-go read */}
        <View style={{ marginTop: 20 }}>
          <Kicker>Macros</Kicker>
          <View style={{ marginTop: 10, gap: 14 }}>
            {rows.map(({ label, got, want, accent }) => {
              const frac = Math.max(0, Math.min(1, want > 0 ? got / want : 0));
              const toGo = want - got;
              return (
                <View key={label}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
                    <Text>
                      <Text style={[{ color: c('textSecondary'), fontSize: 13, fontWeight: '700' }, num]}>{got}g</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 13 }}> of {want}g</Text>
                      <Text style={[{ color: toGo <= 0 ? c('success') : c('textMuted'), fontSize: 13 }, num]}>{toGo <= 0 ? '  ✓ done' : `  ·  ${toGo}g to go`}</Text>
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
                    <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 999, backgroundColor: accent ? c('accent') : c('textMuted') }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* per-meal breakdown */}
        {logged.length ? (
          <View style={{ marginTop: 22 }}>
            <Kicker>By meal</Kicker>
            <View style={{ marginTop: 6 }}>
              {logged.map((m, i) => (
                <View key={m.slot} style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '600' }}>{cap(m.slot)}</Text>
                    <Text>
                      <Text style={[{ color: c('textSecondary'), fontSize: 14, fontWeight: '700' }, num]}>{Math.round(m.kcal).toLocaleString()}</Text>
                      <Text style={{ color: c('textMuted'), fontSize: 12 }}> kcal</Text>
                    </Text>
                  </View>
                  <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 3 }, num]}>
                    {Math.round(m.proteinG)}g protein · {Math.round(m.carbsG)}g carbs · {Math.round(m.fatG)}g fat
                  </Text>
                  <Text style={{ color: c('textMuted'), fontSize: 12.5, marginTop: 3 }} numberOfLines={2}>
                    {m.items.map((it) => it.name).join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: c('textMuted'), fontSize: 14, textAlign: 'center', marginTop: 24 }}>Nothing logged yet — your day starts here.</Text>
        )}

        {note ? (
          <View style={{ marginTop: 18, backgroundColor: c('accentFaint'), borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }}>
            <Text style={{ color: c('accentSoft'), fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>{note}</Text>
          </View>
        ) : null}
        <View style={{ height: 10 }} />
      </ScrollView>
    </Sheet>
  );
}
