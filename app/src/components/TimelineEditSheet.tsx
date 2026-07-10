import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import type { MealSlot } from '@usual/shared';
import { useTheme } from '../theme';
import type { TimelineItem } from '../useToday';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function TimelineEditSheet({
  item,
  onClose,
  onApply,
  onDelete,
}: {
  item: TimelineItem | null;
  onClose: () => void;
  onApply: (change: { scale: number; slot: string }) => void;
  onDelete: () => void;
}) {
  const { c, radius } = useTheme();
  const [scale, setScale] = useState(1);
  const [slot, setSlot] = useState('lunch');

  useEffect(() => {
    if (item) {
      setScale(1);
      setSlot(item.slot || 'lunch');
    }
  }, [item]);

  const kcal = item ? Math.round(item.kcal * scale) : 0;
  const grams = item?.portionG != null ? Math.round(item.portionG * scale) : null;

  const step = (d: number) => setScale((s) => Math.max(0.25, Math.min(3, +(s + d).toFixed(2))));

  const roundBtn = { width: 40, height: 40, borderRadius: 999, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: c('border') };

  return (
    <Modal visible={item !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: c('surface'), borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          {item ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: c('textPrimary'), fontSize: 19, fontWeight: '700', flex: 1, marginRight: 8 }} numberOfLines={1}>{item.name}</Text>
                <Pressable onPress={onClose}><Text style={{ color: c('textMuted'), fontSize: 15 }}>Close</Text></Pressable>
              </View>

              <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Portion</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 18 }}>
                <Pressable onPress={() => step(-0.25)} style={roundBtn}><Text style={{ color: c('textPrimary'), fontSize: 22 }}>−</Text></Pressable>
                <View style={{ alignItems: 'center', minWidth: 120 }}>
                  <Text style={{ color: c('textPrimary'), fontSize: 24, fontWeight: '800' }}>{kcal} kcal</Text>
                  {grams != null ? <Text style={{ color: c('textMuted'), fontSize: 13 }}>{grams} g</Text> : null}
                </View>
                <Pressable onPress={() => step(0.25)} style={roundBtn}><Text style={{ color: c('textPrimary'), fontSize: 22 }}>+</Text></Pressable>
              </View>

              <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Meal</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {SLOTS.map((sl) => (
                  <Pressable key={sl} onPress={() => setSlot(sl)} style={{ borderWidth: 1, borderColor: slot === sl ? c('accent') : c('border'), backgroundColor: slot === sl ? c('accent') : c('surface'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
                    <Text style={{ color: slot === sl ? c('accentText') : c('textSecondary'), fontWeight: '600', fontSize: 13 }}>{cap(sl)}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={onDelete} style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, borderColor: c('border') }}>
                  <Text style={{ color: c('danger'), fontWeight: '600' }}>Delete</Text>
                </Pressable>
                <Pressable onPress={() => onApply({ scale, slot })} style={{ flex: 1, backgroundColor: c('accent'), paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' }}>
                  <Text style={{ color: c('accentText'), fontWeight: '700', fontSize: 16 }}>Save</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
