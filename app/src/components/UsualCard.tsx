import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme';
import type { TodayState } from '../useToday';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function UsualCard({ state, onLog }: { state: TodayState; onLog: (foodId: string) => void }) {
  const { c, radius } = useTheme();
  const slotLabel = cap(state.slot);

  const cardStyle = {
    backgroundColor: c('surface'),
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: c('border'),
  } as const;
  const kicker = {
    color: c('textMuted'),
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };

  if (state.usual) {
    return (
      <View style={cardStyle}>
        <Text style={kicker}>{slotLabel}</Text>
        <Text style={{ color: c('textPrimary'), fontSize: 24, fontWeight: '700', marginTop: 6 }}>
          The usual?
        </Text>
        <Text style={{ color: c('textSecondary'), fontSize: 16, marginTop: 3 }}>
          {state.usual.name} · {state.usual.portionG}g
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => onLog(state.usual!.foodId)}
            style={{ flex: 1, backgroundColor: c('accent'), paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' }}
          >
            <Text style={{ color: c('accentText'), fontWeight: '700', fontSize: 16 }}>✓ Log it</Text>
          </Pressable>
          <Pressable
            style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: c('border') }}
          >
            <Text style={{ color: c('textSecondary'), fontWeight: '600' }}>Something else</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      <Text style={kicker}>{slotLabel}</Text>
      <Text style={{ color: c('textPrimary'), fontSize: 18, fontWeight: '700', marginTop: 6, marginBottom: 12 }}>
        Quick log
      </Text>
      <View style={{ gap: 8 }}>
        {state.tiles.map((t) => (
          <Pressable
            key={t.foodId}
            onPress={() => onLog(t.foodId)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c('surfaceSunken'), padding: 14, borderRadius: radius.md }}
          >
            <Text style={{ color: c('textPrimary'), fontSize: 15, fontWeight: '600' }}>{t.name}</Text>
            <Text style={{ color: c('textMuted'), fontSize: 13 }}>{t.kcal} kcal</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
