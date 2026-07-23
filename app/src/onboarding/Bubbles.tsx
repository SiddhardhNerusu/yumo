import { useState } from 'react';
import { View, Text, Pressable, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
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
  searchable,
  allowFreeAdd,
  placeholder = 'Search…',
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
  /** show a search field that filters the pills. */
  searchable?: boolean;
  /** when searching, offer to add an unknown item the list doesn't have. */
  allowFreeAdd?: boolean;
  placeholder?: string;
}) {
  const { c } = useTheme();
  const [revealed, setRevealed] = useState<string[]>([]); // related foods spawned by taps
  const [query, setQuery] = useState('');
  const atCap = max != null && selected.length >= max;

  // Base options, then any spawned related foods (deduped, order preserved).
  const seen = new Set<string>();
  const all: { label: string; suggested: boolean }[] = [];
  for (const o of options) if (!seen.has(o)) { seen.add(o); all.push({ label: o, suggested: false }); }
  for (const r of revealed) if (!seen.has(r)) { seen.add(r); all.push({ label: r, suggested: true }); }
  const q = query.trim().toLowerCase();
  const display = q ? all.filter((d) => d.label.toLowerCase().includes(q)) : all;
  const canFreeAdd = allowFreeAdd && q.length >= 2 && !all.some((d) => d.label.toLowerCase() === q);

  const freeAdd = () => {
    const label = query.trim();
    if (!label) return;
    if (!revealed.includes(label)) setRevealed((prev) => [...prev, label]);
    if (!selected.includes(label) && !atCap) onToggle(label);
    setQuery('');
  };

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
    <View style={{ gap: 12 }}>
      {searchable ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={c('textMuted')}
          autoCorrect={false}
          style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 14 }}
        />
      ) : null}
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
      {canFreeAdd ? (
        <Pressable
          onPress={freeAdd}
          style={{ borderWidth: 1, borderColor: c('accent'), borderStyle: 'dashed', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 }}
        >
          <Text style={{ color: c('accentSoft'), fontSize: 14, fontWeight: '600' }}>＋ Add “{query.trim()}”</Text>
        </Pressable>
      ) : null}
      {display.length === 0 && !canFreeAdd ? (
        <Text style={{ color: c('textMuted'), fontSize: 13, paddingVertical: 6 }}>Nothing matches.</Text>
      ) : null}
      </View>
    </View>
  );
}
