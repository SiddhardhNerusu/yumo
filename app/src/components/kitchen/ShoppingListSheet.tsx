import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { MenuRecipe } from '@yumo/menu';
import { useTheme } from '../../theme';
import { Sheet, Serif, PrimaryButton, TextLink } from '../kit';
import { cookability } from '../../data/cookability';
import { track } from '../../analytics';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** §6 shopping list — the gaps between this week's menu and what's in stock,
 * each tagged with the meal that needs it. "Add ticked" restocks (they fly in). */
export function ShoppingListSheet({ visible, recipes, haveTokens, paused = false, onClose, onBought }: { visible: boolean; recipes: MenuRecipe[]; haveTokens: Set<string>; paused?: boolean; onClose: () => void; onBought: (tokens: string[]) => void }) {
  const { c } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => { if (visible) setChecked(new Set()); }, [visible]);

  // token → first meal that needs it
  const gaps = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes) {
      for (const t of cookability(r, haveTokens).missing) if (!map.has(t)) map.set(t, r.name);
    }
    return [...map.entries()];
  }, [recipes, haveTokens]);

  // §11 shopping_list_generated — fire once when the sheet opens with real gaps.
  useEffect(() => { if (visible && !paused && gaps.length > 0) track('shopping_list_generated', { gaps: gaps.length }); }, [visible, paused, gaps.length]);

  const toggle = (t: string) => setChecked((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Shopping list</Serif>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 14 }}>What this week's menu needs that you don't have.</Text>

      {paused ? (
        <Text style={{ color: c('textSecondary'), fontSize: 15, paddingVertical: 24, textAlign: 'center' }}>Paused — you're using things up. 🌙</Text>
      ) : gaps.length === 0 ? (
        <Text style={{ color: c('textSecondary'), fontSize: 15, paddingVertical: 24, textAlign: 'center' }}>You've got everything for this week. 🙌</Text>
      ) : (
        <>
          <ScrollView style={{ maxHeight: 380 }}>
            {gaps.map(([t, meal]) => {
              const on = checked.has(t);
              return (
                <Pressable key={t} onPress={() => toggle(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: on ? c('accent') : 'rgba(247,242,234,0.25)', backgroundColor: on ? c('accent') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Text style={{ color: c('accentText'), fontSize: 11, fontWeight: '700' }}>✓</Text> : null}
                  </View>
                  <Text style={{ color: on ? c('textMuted') : c('textPrimary'), fontSize: 15, flex: 1, textDecorationLine: on ? 'line-through' : 'none' }}>{titleCase(t)}</Text>
                  <Text style={{ color: c('textMuted'), fontSize: 12 }} numberOfLines={1}>{meal}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 14 }}>
            <PrimaryButton label={checked.size ? `Add ${checked.size} to kitchen` : 'Add ticked to kitchen'} flex onPress={() => { if (checked.size) { track('shopping_list_checked', { count: checked.size }); onBought([...checked]); onClose(); } }} />
          </View>
        </>
      )}
    </Sheet>
  );
}
