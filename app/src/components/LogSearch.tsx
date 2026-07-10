import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { searchFoods, type FoodHit } from '../data/repo';

/** Default portion for a searched food, grams. */
export const SEARCH_PORTION_G = 150;
const QUICK_ADD = [250, 500, 700];

export interface RecentFood {
  foodId: string;
  name: string;
  kcal: number;
}

export function LogSearch({
  visible,
  onClose,
  onLog,
  onQuickAdd,
  recents = [],
  onLogRecent,
}: {
  visible: boolean;
  onClose: () => void;
  onLog: (hit: FoodHit) => void;
  onQuickAdd: (kcal: number) => void;
  recents?: RecentFood[];
  onLogRecent?: (r: RecentFood) => void;
}) {
  const { c, radius } = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchFoods(q).then((r) => {
        setResults(r);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg'), paddingTop: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
          <TextInput
            autoFocus
            placeholder="Search foods or type a barcode…"
            placeholderTextColor={c('textMuted')}
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 16 }}
          />
          <Pressable onPress={onClose}>
            <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: c('textMuted'), fontSize: 13 }}>Quick add</Text>
          {QUICK_ADD.map((k) => (
            <Pressable
              key={k}
              onPress={() => onQuickAdd(k)}
              style={{ borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: c('surface') }}
            >
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>~{k} kcal</Text>
            </Pressable>
          ))}
        </View>

        {q.trim().length < 2 && recents.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 8 }}>Recent</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recents.map((r) => (
                <Pressable
                  key={r.foodId}
                  onPress={() => onLogRecent?.(r)}
                  style={{ borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: c('surface') }}
                >
                  <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{r.name} · {r.kcal}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={c('accent')} style={{ marginTop: 20 }} /> : null}

        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
          {results.map((hit) => {
            const kcal = Math.round((hit.per100g.kcal * SEARCH_PORTION_G) / 100);
            return (
              <Pressable
                key={hit.fdcId}
                onPress={() => onLog(hit)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.md, padding: 14 }}
              >
                <Text style={{ color: c('textPrimary'), fontSize: 14, flex: 1, marginRight: 8 }} numberOfLines={1}>{hit.description}</Text>
                <Text style={{ color: c('textMuted'), fontSize: 13 }}>{kcal} kcal</Text>
              </Pressable>
            );
          })}
          {!loading && q.trim().length >= 2 && results.length === 0 ? (
            <Text style={{ color: c('textMuted'), fontSize: 14, textAlign: 'center', marginTop: 24 }}>
              No matches — food search needs a connection.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
