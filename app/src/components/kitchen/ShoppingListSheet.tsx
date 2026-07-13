import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet, Serif, PrimaryButton, TextLink } from '../kit';
import { buildShoppingList, type ShopPick } from '../../data/shopping';
import { track } from '../../analytics';

/** §9 shop-able shopping list — this week's menu minus what's in stock, grouped by
 * aisle with household units. "Add ticked" restocks the kitchen (bought → in). */
export function ShoppingListSheet({ visible, picks, haveTokens, paused = false, onClose, onBought }: { visible: boolean; picks: ShopPick[]; haveTokens: Set<string>; paused?: boolean; onClose: () => void; onBought: (tokens: string[]) => void }) {
  const { c } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => { if (visible) setChecked(new Set()); }, [visible]);

  const groups = useMemo(() => buildShoppingList(picks, haveTokens), [picks, haveTokens]);
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  // §11 shopping_list_generated — fire once when the sheet opens with real gaps.
  useEffect(() => { if (visible && !paused && total > 0) track('shopping_list_generated', { gaps: total }); }, [visible, paused, total]);

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
      ) : total === 0 ? (
        <Text style={{ color: c('textSecondary'), fontSize: 15, paddingVertical: 24, textAlign: 'center' }}>You've got everything for this week. 🙌</Text>
      ) : (
        <>
          <ScrollView style={{ maxHeight: 420 }}>
            {groups.map((group) => (
              <View key={group.aisle} style={{ marginBottom: 18 }}>
                <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 }}>{group.label}</Text>
                {group.items.map((item) => {
                  const on = checked.has(item.token);
                  return (
                    <Pressable key={item.token} onPress={() => toggle(item.token)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: on ? c('accent') : 'rgba(247,242,234,0.25)', backgroundColor: on ? c('accent') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Text style={{ color: c('accentText'), fontSize: 11, fontWeight: '700' }}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: on ? c('textMuted') : c('textPrimary'), fontSize: 15, textDecorationLine: on ? 'line-through' : 'none' }}>{item.label}</Text>
                        {item.qty ? <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] }}>{item.qty}</Text> : null}
                      </View>
                      <Text style={{ color: c('textMuted'), fontSize: 12, maxWidth: 120 }} numberOfLines={1}>{item.meal}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label={checked.size ? `Add ${checked.size} to kitchen` : 'Add ticked to kitchen'} flex onPress={() => { if (checked.size) { track('shopping_list_checked', { count: checked.size }); onBought([...checked]); onClose(); } }} />
          </View>
        </>
      )}
    </Sheet>
  );
}
