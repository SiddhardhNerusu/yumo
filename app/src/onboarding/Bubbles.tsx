import { useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '../theme';
import { RELATED } from '../data/food-graph';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Interactive food picker (§2.2). Tapping a food selects it AND spawns its
 * related foods, which animate in and are themselves tappable (rice → fried
 * rice, biryani, rice bowl…). `max` caps additions but always allows
 * deselecting. Full floating-physics bubbles are a later Reanimated pass — this
 * delivers the tap-to-expand behaviour with a lightweight LayoutAnimation.
 */
export function Bubbles({
  options,
  selected,
  onToggle,
  max,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
}) {
  const { c } = useTheme();
  const [revealed, setRevealed] = useState<string[]>([]); // related foods spawned by taps
  const atCap = max != null && selected.length >= max;

  // Base options, then any spawned related foods (deduped, order preserved).
  const seen = new Set<string>();
  const display: { label: string; suggested: boolean }[] = [];
  for (const o of options) if (!seen.has(o)) { seen.add(o); display.push({ label: o, suggested: false }); }
  for (const r of revealed) if (!seen.has(r)) { seen.add(r); display.push({ label: r, suggested: true }); }

  const onTap = (label: string) => {
    const isSelected = selected.includes(label);

    // Spawn related foods on first tap (before it's deselected).
    const related = RELATED[label];
    if (related && !isSelected) {
      const fresh = related.filter((x) => !seen.has(x));
      if (fresh.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
        setRevealed((prev) => [...prev, ...fresh]);
      }
    }

    if (!isSelected && atCap) return; // at the cap, don't add more
    onToggle(label);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {display.map(({ label, suggested }) => {
        const isSelected = selected.includes(label);
        const disabled = atCap && !isSelected;
        return (
          <Pressable
            key={label}
            onPress={() => onTap(label)}
            style={{
              backgroundColor: isSelected ? c('accent') : suggested ? c('accentSubtle') : c('surface'),
              borderColor: isSelected ? c('accent') : suggested ? c('accent') : c('border'),
              borderWidth: 1,
              borderRadius: 999,
              paddingVertical: 9,
              paddingHorizontal: 15,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text
              style={{
                color: isSelected ? c('accentText') : suggested ? c('accentSubtleText') : c('textSecondary'),
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {suggested && !isSelected ? '+ ' : ''}
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
