import { View, Text } from 'react-native';
import type { MenuRecipe } from '@yumo/menu';
import { useTheme } from '../../theme';
import { Sheet, Serif, PrimaryButton, TextLink } from '../kit';
import { POOL } from '../../data/menu-seed';
import { cookability } from '../../data/cookability';
import { tokenMatch, type KitchenItem } from '../../data/kitchen-model';
import { expiringItems, expiringUsedBy } from '../../data/expiring';
import { mealCost, gbp } from '../../data/kitchenMoney';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** §7/§8 "Tonight you can make…" — cook-now dinners on budget, expiring items first. */
export function TonightSheet({ visible, items, remaining, now, onLog, onClose }: { visible: boolean; items: KitchenItem[]; remaining: number; now: number; onLog: (r: MenuRecipe) => void; onClose: () => void }) {
  const { c } = useTheme();
  const have = new Set(items.filter((i) => i.level !== 'out').map((i) => i.token));
  const haveArr = [...have];
  const exp = expiringItems(items, now);

  // soft budget fit (§7 "fitting the remaining budget") — a preference, never a filter (principle 2).
  const budget = Math.max(0, remaining);
  const fits = (r: MenuRecipe) => budget > 0 && r.perServing.kcal <= budget;
  const picks = POOL
    .filter((r) => r.slotAffinity.includes('dinner'))
    .map((r) => ({ r, cook: cookability(r, have), expUses: expiringUsedBy(r, exp) }))
    // expiring-first (waste-saver), then fits-budget, then most-cookable, then lightest
    .sort((a, b) =>
      Number(b.expUses.length > 0) - Number(a.expUses.length > 0) ||
      Number(fits(b.r)) - Number(fits(a.r)) ||
      a.cook.missing.length - b.cook.missing.length ||
      a.r.perServing.kcal - b.r.perServing.kcal)
    .slice(0, 3);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Serif italic size={24} color={c('textPrimary')}>Tonight you can make…</Serif>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 16 }}>From what's already in your kitchen — fits your {Math.max(0, remaining).toLocaleString()} kcal left.</Text>

      <View style={{ gap: 10 }}>
        {picks.map(({ r, expUses }) => {
          const cost = mealCost(r, items);
          const expLabel = expUses[0]?.label;
          const yours = r.foodTokens.filter((t) => haveArr.some((h) => tokenMatch(t, h))).slice(0, 2).map(titleCase);
          return (
            <View key={r.id} style={{ backgroundColor: c('surfaceSunken'), borderRadius: 16, borderWidth: 1, borderColor: c('border'), padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Serif size={19} color={c('textPrimary')} style={{ flex: 1 }}>{r.name}</Serif>
                <Text style={{ color: c('textSecondary'), fontSize: 14, fontWeight: '700', marginLeft: 10, fontVariant: ['tabular-nums'] }}>
                  {Math.round(r.perServing.kcal)} kcal{cost != null ? <Text style={{ color: c('textMuted'), fontWeight: '600' }}> · ~{gbp(cost)}</Text> : null}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 }}>
                {expLabel ? (
                  <Text style={{ color: '#EDA33B', fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>🍃 Uses your {expLabel} before it turns</Text>
                ) : (
                  <Text style={{ color: c('success'), fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{yours.length ? `✓ Uses your ${yours.join(' + ')}` : '✓ From your kitchen'}</Text>
                )}
                <PrimaryButton label="Log it" onPress={() => onLog(r)} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
