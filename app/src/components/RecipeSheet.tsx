import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Sheet, Serif, Kicker, PrimaryButton, OutlineButton } from './kit';
import type { RecipeIngredientLine } from '../data/repo';
import type { Cookability } from '../data/cookability';

const num = { fontVariant: ['tabular-nums' as const] };

export interface RecipeSheetData {
  name: string;
  kcal?: number;
  steps: string[];
  ingredients: RecipeIngredientLine[];
  methods?: string[];
  portion?: string;
  /** §8 stat chips + kitchen match (present when opened from a dish suggestion). */
  protein?: number;
  min?: number;
  cook?: Cookability | null;
  /** §8 footer actions — present only from a suggestion (slot context). */
  addLabel?: string;
  add?: () => void;
  swap?: () => void;
}

/** §8 dish detail: title + kcal, stat chips, "You'll need" (+ kitchen match),
 * numbered "How to make it", and a Swap/Add footer when opened from a suggestion
 * (else a plain Done). */
export function RecipeSheet({ recipe, onClose }: { recipe: RecipeSheetData | null; onClose: () => void }) {
  const { c } = useTheme();
  const chip = (label: string, accent?: boolean) => (
    <View style={{ backgroundColor: accent ? c('accentFaint') : c('surfaceSunken'), borderWidth: accent ? 0 : 1, borderColor: 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}>
      <Text style={{ color: accent ? c('accentSoft') : c('textSecondary'), fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  const kitchen = recipe?.cook ? (recipe.cook.tier === 'now' ? { label: '✓ All in your kitchen', ok: true } : { label: `${recipe.cook.missing.length} to buy`, ok: false }) : null;

  return (
    <Sheet visible={recipe !== null} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <Serif size={26} weight="medium" color={c('textPrimary')} style={{ flex: 1 }}>{recipe?.name ?? ''}</Serif>
        {recipe?.kcal != null ? (
          <Text style={[{ color: c('textSecondary'), fontSize: 15, fontWeight: '700', marginLeft: 10 }, num]}>{recipe.kcal.toLocaleString()} kcal</Text>
        ) : null}
      </View>

      {/* §8 stat chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {recipe?.portion ? chip(recipe.portion, true) : null}
        {recipe?.protein != null ? chip(`${recipe.protein}g protein`) : null}
        {recipe?.min != null ? chip(`${recipe.min} min`) : null}
        {recipe?.ingredients?.length ? chip(`${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? '' : 's'}`) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {recipe?.ingredients?.length ? (
          <View style={{ marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Kicker>You'll need</Kicker>
              {kitchen ? <Text style={{ color: kitchen.ok ? c('success') : c('textMuted'), fontSize: 12, fontWeight: '600' }}>{kitchen.label}</Text> : null}
            </View>
            <View style={{ marginTop: 10 }}>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}>
                  <Text style={{ color: c('textPrimary'), fontSize: 14.5, flex: 1 }}>{ing.name}</Text>
                  {ing.qty ? <Text style={[{ color: c('textSecondary'), fontSize: 14, marginLeft: 12 }, num]}>{ing.qty}</Text> : null}
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
                    {detail ? <Text style={[{ color: c('textSecondary'), fontSize: 14 }, num]}>{detail}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <Kicker>How to make it</Kicker>
        <View style={{ marginTop: 12, gap: 12 }}>
          {(recipe?.steps ?? []).map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: c('accentFaint'), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c('accentSoft'), fontWeight: '700', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: c('textLogged'), fontSize: 14.5, flex: 1, lineHeight: 21 }}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ marginTop: 16 }}>
        {recipe?.add ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {recipe.swap ? <OutlineButton label="⇄ Swap dish" flex={1} onPress={recipe.swap} /> : null}
            <PrimaryButton label={recipe.addLabel ?? 'Add'} flex={1.4} onPress={recipe.add} />
          </View>
        ) : (
          <PrimaryButton label="Done" onPress={onClose} full />
        )}
      </View>
    </Sheet>
  );
}
