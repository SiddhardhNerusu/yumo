import { View } from 'react-native';
import { Chip } from '../ui/primitives';

/**
 * Selectable food picker. v1 is a wrapped chip grid (the physics-floating
 * version from §2.2 is a later Reanimated/Skia pass). `max` caps additions but
 * always allows deselecting.
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
  const atCap = max != null && selected.length >= max;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        const disabled = atCap && !isSelected;
        return (
          <Chip
            key={opt}
            label={opt}
            selected={isSelected}
            onPress={() => {
              if (disabled) return;
              onToggle(opt);
            }}
          />
        );
      })}
    </View>
  );
}
