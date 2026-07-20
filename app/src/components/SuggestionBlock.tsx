import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Chip, TextLink } from './kit';
import { haptics } from '../haptics';
import type { SuggestSource, Suggestion } from '../data/suggest';

const num = { fontVariant: ['tabular-nums' as const] };

/**
 * The slot suggestion block (§R2). Replaces the old fixed "quick log + on the
 * menu" section: three interchangeable sources (For you / In budget / Kitchen)
 * plus a Mix chip that re-rolls. Owns its own source + Mix-offset state, so it
 * MUST be a top-level component (an inner one would reset on every Day render).
 */
export function SuggestionBlock({
  suggest,
  budgetTight,
  kitchenAvailable,
  canOpen,
  onOpen,
  onLog,
  onAddMore,
  onSkip,
}: {
  suggest: (source: SuggestSource, offset: number) => Suggestion[];
  budgetTight: boolean;
  kitchenAvailable: boolean;
  canOpen: (it: Suggestion) => boolean;
  onOpen: (it: Suggestion) => void;
  onLog: (it: Suggestion) => void;
  onAddMore: () => void;
  onSkip: () => void;
}) {
  const { c } = useTheme();
  const [source, setSource] = useState<SuggestSource>('foryou');
  const [offset, setOffset] = useState(0);
  const items = suggest(source, offset);

  const SOURCES: { v: SuggestSource; label: string }[] = [
    { v: 'foryou', label: 'For you' },
    { v: 'budget', label: 'In budget' },
    ...(kitchenAvailable ? [{ v: 'kitchen' as const, label: 'Kitchen' }] : []),
  ];

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Suggestions</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {SOURCES.map((s) => (
          <Chip key={s.v} label={s.label} selected={source === s.v} onPress={() => { setSource(s.v); setOffset(0); haptics.select(); }} />
        ))}
        <Pressable onPress={() => { setOffset((o) => o + 3); haptics.select(); }} accessibilityRole="button" accessibilityLabel="Mix — fresh suggestions" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 9, paddingHorizontal: 13, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600' }}>⇄ Mix</Text>
        </Pressable>
      </View>

      {source === 'budget' && budgetTight ? (
        <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>Not much room left — lighter picks:</Text>
      ) : null}

      <View style={{ marginTop: 8 }}>
        {items.length === 0 ? (
          <Text style={{ color: c('textMuted'), fontSize: 14, paddingVertical: 8 }}>Nothing to suggest right now.</Text>
        ) : (
          items.map((it, i) => {
            const id = it.kind === 'tile' ? it.tile.foodId : it.cur.recipe.id;
            const name = it.kind === 'tile' ? it.tile.name : it.cur.recipe.name;
            const kcal = it.kind === 'tile' ? it.tile.kcal : it.cur.kcal;
            const tappable = canOpen(it);
            return (
              <View key={`${id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}>
                <Pressable disabled={!tappable} onPress={() => onOpen(it)} accessibilityRole={tappable ? 'button' : undefined} accessibilityLabel={tappable ? `${name}, view recipe` : undefined} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ color: c('textPrimary'), fontSize: 16, flexShrink: 1 }} numberOfLines={1}>{name}</Text>
                  {tappable ? <Text style={{ color: c('textMuted'), fontSize: 15, marginLeft: 6 }}>›</Text> : null}
                </Pressable>
                <Text style={[{ color: c('textSecondary'), fontSize: 14, marginRight: 6 }, num]}>{kcal} kcal</Text>
                <Pressable onPress={() => onLog(it)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Log ${name}`} style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ color: c('accentSoft'), fontSize: 20, fontWeight: '600' }}>＋</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 1, backgroundColor: c('divider'), marginTop: 6 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 14 }}>
        <TextLink label="＋ More" onPress={onAddMore} />
        <TextLink label="Skip this meal" onPress={onSkip} tone="neutral" />
      </View>
    </View>
  );
}
