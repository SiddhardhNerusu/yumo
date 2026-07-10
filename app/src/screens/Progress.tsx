import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { WeightChart } from '../components/WeightChart';
import { WEIGHTS, LOGGED_LAST_7, DAY_LABELS, STREAK } from '../data/progress-seed';

export function Progress({ onReset }: { onReset?: () => void }) {
  const { c, radius } = useTheme();
  const current = WEIGHTS[WEIGHTS.length - 1];
  const start = WEIGHTS[0];
  const change = current - start; // negative = loss
  const loggedCount = LOGGED_LAST_7.filter(Boolean).length;

  const card = {
    backgroundColor: c('surface'),
    borderWidth: 1,
    borderColor: c('border'),
    borderRadius: radius.lg,
    padding: 18,
  } as const;
  const kicker = {
    color: c('textMuted'),
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 32, gap: 14 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Progress</Text>

        <View style={[card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View>
            <Text style={{ color: c('textPrimary'), fontSize: 34, fontWeight: '800' }}>{STREAK.current}</Text>
            <Text style={{ color: c('textSecondary'), fontSize: 13 }}>day streak</Text>
          </View>
          {STREAK.frozen ? (
            <View style={{ backgroundColor: c('accentSubtle'), borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={{ color: c('accentSubtleText'), fontSize: 12, fontWeight: '600' }}>Frozen · not reset</Text>
            </View>
          ) : null}
        </View>

        <View style={card}>
          <Text style={kicker}>Weight</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <Text style={{ color: c('textPrimary'), fontSize: 26, fontWeight: '800' }}>{current.toFixed(1)} kg</Text>
            <Text style={{ color: change <= 0 ? c('success') : c('textSecondary'), fontSize: 14, fontWeight: '600' }}>
              {change <= 0 ? '▼' : '▲'} {Math.abs(change).toFixed(1)} kg
            </Text>
          </View>
          <WeightChart data={WEIGHTS} />
          <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>7-day trend · last 3 weeks</Text>
        </View>

        <View style={card}>
          <Text style={kicker}>This week</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {LOGGED_LAST_7.map((logged, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: logged ? c('accent') : c('surfaceSunken'), borderWidth: logged ? 0 : 1, borderColor: c('border') }} />
                <Text style={{ color: c('textMuted'), fontSize: 11 }}>{DAY_LABELS[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c('textSecondary'), fontSize: 13, marginTop: 12 }}>
            {loggedCount} of 7 days logged — the habit’s what counts.
          </Text>
        </View>

        <View style={{ backgroundColor: c('accentSubtle'), borderRadius: radius.md, padding: 14 }}>
          <Text style={{ color: c('accentSubtleText'), fontSize: 14, lineHeight: 20 }}>
            Down {Math.abs(change).toFixed(1)} kg over three weeks, steady as you like. Keep going.
          </Text>
        </View>

        {onReset ? (
          <Pressable onPress={onReset} style={{ alignItems: 'center', paddingVertical: 14, marginTop: 4 }}>
            <Text style={{ color: c('textMuted'), fontSize: 13 }}>Start over — clear profile &amp; logs</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
