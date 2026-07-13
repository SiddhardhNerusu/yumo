import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Sheet, Serif, Kicker, PrimaryButton } from './kit';
import type { RecipeIngredientLine } from '../data/repo';

/** Tap-to-reveal recipe (§4/§14.2 — never inline): exact ingredient quantities
 * then the ≤6 numbered steps. */
export function RecipeSheet({
  recipe,
  onClose,
}: {
  recipe: { name: string; kcal?: number; steps: string[]; ingredients: RecipeIngredientLine[]; methods?: string[]; portion?: string } | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={recipe !== null} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: recipe?.portion ? 4 : 18 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')} style={{ flex: 1 }}>{recipe?.name ?? ''}</Serif>
        {recipe?.kcal != null ? (
          <Text style={{ color: c('textSecondary'), fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{recipe.kcal.toLocaleString()} kcal</Text>
        ) : null}
      </View>
      {recipe?.portion ? (
        <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600', marginBottom: 18 }}>Amounts for {recipe.portion}</Text>
      ) : null}

      <ScrollView>
        {recipe?.ingredients?.length ? (
          <View style={{ marginBottom: 22 }}>
            <Kicker>You'll need</Kicker>
            <View style={{ marginTop: 10 }}>
              {recipe.ingredients.map((ing, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}
                >
                  <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1 }}>{ing.name}</Text>
                  {ing.qty ? <Text style={{ color: c('textSecondary'), fontSize: 14, marginLeft: 12, fontVariant: ['tabular-nums'] }}>{ing.qty}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {recipe?.methods?.length ? (
          <View style={{ marginBottom: 22 }}>
            <Kicker>Cook it</Kicker>
            <View style={{ marginTop: 10, gap: 8 }}>
              {recipe.methods.map((m, i) => {
                const [appliance, detail] = m.split(/\s*—\s*|\s*-\s*/, 2);
                return (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c('surfaceSunken'), borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
                    <Text style={{ color: c('textPrimary'), fontSize: 14, fontWeight: '600' }}>{appliance}</Text>
                    {detail ? <Text style={{ color: c('textSecondary'), fontSize: 14, fontVariant: ['tabular-nums'] }}>{detail}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <Kicker>How to make it</Kicker>
        <View style={{ marginTop: 12, gap: 16 }}>
          {(recipe?.steps ?? []).map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: c('accentFaint'), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c('accentSoft'), fontWeight: '700', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1, lineHeight: 22.5 }}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton label="Done" onPress={onClose} flex />
      </View>
    </Sheet>
  );
}
