import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme';
import type { TimelineItem } from '../useToday';

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function Timeline({
  items,
  onEdit,
  onDelete,
}: {
  items: TimelineItem[];
  onEdit?: (item: TimelineItem) => void;
  onDelete?: (id: string) => void;
}) {
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
            key={it.id}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c('border') }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => onEdit?.(it)}>
              <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '600' }}>{it.name}</Text>
              <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>
                {it.slot} · {fmt(it.minutesOfDay)}
              </Text>
            </Pressable>
            <Text style={{ color: c('textSecondary'), fontSize: 14, marginRight: onDelete ? 12 : 0 }}>{it.kcal} kcal</Text>
            {onDelete ? (
              <Pressable
                onPress={() => onDelete(it.id)}
                hitSlop={8}
                accessibilityLabel={`Remove ${it.name}`}
                style={{ width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c('surfaceSunken') }}
              >
                <Text style={{ color: c('textMuted'), fontSize: 14, lineHeight: 16 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
