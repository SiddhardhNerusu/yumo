import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet, Serif, Kicker, Chip, TextLink } from '../kit';
import { tileColor } from './KitchenScene';
import { ZONES, ZONE_LABEL, type KitchenItem, type Zone, type Level, type Freshness, freshnessOf } from '../../data/kitchen-model';

const LEVELS: Level[] = ['plenty', 'some', 'low', 'out'];
const LEVEL_LABEL: Record<Level, string> = { plenty: 'Plenty', some: 'Some', low: 'Low', out: 'Out' };
const FRESH_CHIPS: Array<[Freshness, string]> = [['fresh', 'Fresh'], ['soon', 'Use soon'], ['today', 'Use today']];
const FRESH_WORD: Record<Freshness, string> = { fresh: 'fresh', soon: 'use soon', today: 'use today', gone: 'use today' };

/** §4 item detail — colour swatch, fuzzy level, freshness override, move, toss. */
export function ItemSheet({ item, now, onClose, onLevel, onFreshness, onZone, onToss }: {
  item: KitchenItem | null;
  now: number;
  onClose: () => void;
  onLevel: (id: string, level: Level) => void;
  onFreshness: (id: string, f: Freshness) => void;
  onZone: (id: string, zone: Zone) => void;
  onToss: (id: string) => void;
}) {
  const { c } = useTheme();
  const fresh = item ? freshnessOf(item, now) : 'fresh';
  const freshSel: Freshness = fresh === 'gone' ? 'today' : fresh;

  return (
    <Sheet visible={item !== null} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item ? tileColor(item.token) : c('surfaceSunken') }} />
        <View style={{ flex: 1 }}>
          <Serif size={22} weight="medium" color={c('textPrimary')}>{item?.label ?? ''}</Serif>
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 1 }}>{item ? `${ZONE_LABEL[item.zone]} · ${FRESH_WORD[fresh]}` : ''}</Text>
        </View>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>

      <Kicker>How much left?</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8, marginBottom: 18 }}>
        {LEVELS.map((l) => <Chip key={l} label={LEVEL_LABEL[l]} selected={item?.level === l} onPress={() => item && onLevel(item.id, l)} />)}
      </View>

      <Kicker>Freshness</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8, marginBottom: 6 }}>
        {FRESH_CHIPS.map(([f, label]) => <Chip key={f} label={label} selected={freshSel === f} onPress={() => item && onFreshness(item.id, f)} />)}
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 12, lineHeight: 17, marginBottom: 18 }}>Estimated from typical shelf life — trust the label and your nose.</Text>

      <Kicker>Move to</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8, marginBottom: 20 }}>
        {ZONES.map((z) => <Chip key={z} label={ZONE_LABEL[z]} selected={item?.zone === z} onPress={() => item && onZone(item.id, z)} />)}
      </View>

      <Pressable onPress={() => item && onToss(item.id)} style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? '#FF7A5C' : c('borderStrong'), borderRadius: 999, paddingVertical: 12, alignItems: 'center' })}>
        {({ pressed }) => <Text style={{ color: pressed ? '#FF7A5C' : c('textSecondary'), fontSize: 14, fontWeight: '600' }}>Toss it — happens to everyone</Text>}
      </Pressable>
    </Sheet>
  );
}
