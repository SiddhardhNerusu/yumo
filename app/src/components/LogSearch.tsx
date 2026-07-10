import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { searchFoods, type FoodHit } from '../data/repo';

/** Default portion for a searched food, grams. */
export const SEARCH_PORTION_G = 150;

export function LogSearch({
  visible,
  onClose,
  onLog,
}: {
  visible: boolean;
  onClose: () => void;
  onLog: (hit: FoodHit) => void;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            autoFocus
            placeholder="Search foods…"
            placeholderTextColor={c('textMuted')}
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 16 }}
          />
          <Pressable onPress={onClose}>
            <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>

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
