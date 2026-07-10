import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import type { TimelineItem } from '../useToday';

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function Timeline({ items }: { items: TimelineItem[] }) {
  const { c, radius } = useTheme();
  if (items.length === 0) return null;

  return (
    <View>
      <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Logged today
      </Text>
      <View style={{ backgroundColor: c('surface'), borderRadius: radius.lg, borderWidth: 1, borderColor: c('border') }}>
        {items.map((it, i) => (
          <View
            key={`${it.slot}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: c('border'),
            }}
          >
            <View>
              <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '600' }}>{it.name}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>
                {it.slot} · {fmt(it.minutesOfDay)}
              </Text>
            </View>
            <Text style={{ color: c('textSecondary'), fontSize: 14 }}>{it.kcal} kcal</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
