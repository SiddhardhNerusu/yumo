import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../theme';

/** Tap-to-reveal recipe steps (§14.2 — never inline on the menu). */
export function RecipeSheet({
  recipe,
  onClose,
}: {
  recipe: { name: string; steps: string[] } | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={recipe !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: c('surface'), borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: c('textPrimary'), fontSize: 20, fontWeight: '700' }}>{recipe?.name ?? ''}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: c('textMuted'), fontSize: 15 }}>Close</Text>
            </Pressable>
          </View>
          <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            How to make it
          </Text>
          <ScrollView>
            {(recipe?.steps ?? []).map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                <View style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: c('accentSubtle'), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c('accentSubtleText'), fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
                </View>
                <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1, lineHeight: 22 }}>{step}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
