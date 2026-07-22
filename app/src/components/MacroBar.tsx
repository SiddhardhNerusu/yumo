import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { withAlpha } from './kit';
import type { MacroTargets, MacrosEaten } from '../data/macros';

const num = { fontVariant: ['tabular-nums' as const] };

/**
 * Three macro meters under the calorie ring — eaten / target in grams, grams-first,
 * no percentages. A single-accent ladder: protein full accent (the goal the engine
 * targets), carbs the accent at 0.55, fat at 0.28 — one hue, three weights.
 */
export function MacroBar({ eaten, targets }: { eaten: MacrosEaten; targets: MacroTargets }) {
  const { c } = useTheme();
  const accent = c('accent');
  const cols: Array<{ label: string; got: number; want: number; fill: string }> = [
    { label: 'protein', got: Math.round(eaten.proteinG), want: targets.proteinG, fill: accent },
    { label: 'carbs', got: Math.round(eaten.carbsG), want: targets.carbsG, fill: withAlpha(accent, 0.55) },
    { label: 'fat', got: Math.round(eaten.fatG), want: targets.fatG, fill: withAlpha(accent, 0.28) },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {cols.map(({ label, got, want, fill }) => {
        const frac = Math.max(0, Math.min(1, want > 0 ? got / want : 0));
        return (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: c('ringTrack'), overflow: 'hidden' }}>
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
