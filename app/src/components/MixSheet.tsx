import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { MenuRecipe } from '@yumo/menu';
import { useTheme } from '../theme';
import { Sheet, Serif, OutlineButton } from './kit';

export interface MixOption {
  recipe: MenuRecipe;
  reason: string;
  /** §7 tokens you're ≤2 short of, when the alternative is a near-miss. */
  missing?: string[];
}

/** §4.4 Mix it up — the swap moment. Isocaloric alternatives with a reason chip
 * ("Uses your pantry" / "You like this" / "Something new") so the swap feels
 * intelligent, not random. */
export function MixSheet({
  visible,
  currentName,
  options,
  loading,
  onPick,
  onClose,
}: {
  visible: boolean;
  currentName: string;
  options: MixOption[];
  loading: boolean;
  onPick: (r: MenuRecipe) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Serif size={24} weight="medium" color={c('textPrimary')}>Mix it up</Serif>
      <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        Same slot, same calories — a different meal.
      </Text>

      {loading ? (
        <View style={{ paddingVertical: 28 }}><ActivityIndicator color={c('accent')} /></View>
      ) : options.length === 0 ? (
        <Text style={{ color: c('textMuted'), fontSize: 14, paddingVertical: 20 }}>No close alternative right now.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {options.map(({ recipe, reason, missing }) => {
            const p = Math.round(recipe.perServing.protein_g);
            const cb = Math.round(recipe.perServing.carbs_g ?? 0);
            const f = Math.round(recipe.perServing.fat_g ?? 0);
            return (
              <Pressable
                key={recipe.id}
                onPress={() => onPick(recipe)}
                style={({ pressed }) => ({
                  backgroundColor: c('surfaceSunken'),
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: pressed ? 'rgba(255,106,61,0.45)' : c('border'),
                  padding: 14,
                })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Serif size={19} color={c('textPrimary')} style={{ flex: 1 }}>{recipe.name}</Serif>
                  <Text style={{ color: c('textSecondary'), fontSize: 14, fontWeight: '700', marginLeft: 10, fontVariant: ['tabular-nums'] }}>
                    {Math.round(recipe.perServing.kcal).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <View style={{ backgroundColor: c('accentFaint'), borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Text style={{ color: c('accentSoft'), fontSize: 12, fontWeight: '600' }}>{reason}</Text>
                  </View>
                  <Text style={{ color: c('textMuted'), fontSize: 12, fontVariant: ['tabular-nums'] }}>{p}P · {cb}C · {f}F</Text>
                </View>
                {missing?.length ? (
                  <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 8 }}>
                    Just need: {missing.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <OutlineButton label={`Keep ${currentName}`} onPress={onClose} full />
      </View>
    </Sheet>
  );
}
