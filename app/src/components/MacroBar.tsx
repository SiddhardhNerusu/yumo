import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import type { MacroTargets, MacrosEaten } from '../data/macros';

const num = { fontVariant: ['tabular-nums' as const] };

/**
 * Three quiet macro meters under the calorie ring — eaten / target in grams,
 * grams-first, no percentages, no jargon. Protein carries the accent (it's the
 * goal the engine actually targets); carbs/fat fill in a neutral tone so the
 * one-accent discipline holds.
 */
export function MacroBar({ eaten, targets }: { eaten: MacrosEaten; targets: MacroTargets }) {
  const { c } = useTheme();
  const cols: Array<{ label: string; got: number; want: number; fill: string }> = [
    { label: 'protein', got: Math.round(eaten.proteinG), want: targets.proteinG, fill: c('accent') },
    { label: 'carbs', got: Math.round(eaten.carbsG), want: targets.carbsG, fill: c('textMuted') },
    { label: 'fat', got: Math.round(eaten.fatG), want: targets.fatG, fill: c('textMuted') },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {cols.map(({ label, got, want, fill }) => {
        const frac = Math.max(0, Math.min(1, want > 0 ? got / want : 0));
        return (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ height: 5, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
              <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 999, backgroundColor: fill }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
              <Text style={{ color: c('textMuted'), fontSize: 11.5 }}>{label}</Text>
              <Text style={[{ color: c('textSecondary'), fontSize: 11.5, fontWeight: '600' }, num]}>{got} / {want}g</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
