import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import type { MealSlot } from '@usual/shared';
import { useTheme } from '../theme';
import { useToday } from '../useToday';
import { useEventStore } from '../data/eventStore';
import { FOODS } from '../data/seed';
import { BudgetRing } from '../components/BudgetRing';
import { UsualCard } from '../components/UsualCard';
import { Timeline } from '../components/Timeline';
import { CoachLine } from '../components/CoachLine';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function Today({ budget }: { budget?: number }) {
  const { c, radius } = useTheme();
  const { events, logFood } = useEventStore();
  const [now] = useState(() => Date.now());
  const state = useToday(events, now, budget);

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 48, gap: 20 }}>
        <Text style={{ color: c('textPrimary'), fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Today</Text>

        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <BudgetRing eaten={state.eaten} budget={state.budget} />
        </View>

        <CoachLine text={state.coach} />

        {state.slotLogged ? (
          <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 20 }}>
            <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cap(state.slot)}</Text>
            <Text style={{ color: c('success'), fontSize: 18, fontWeight: '700', marginTop: 6 }}>Logged · {state.slotLogged}</Text>
            <Text style={{ color: c('textSecondary'), fontSize: 14, marginTop: 2 }}>Nice one — it’s in your day.</Text>
          </View>
        ) : (
          <UsualCard
            state={state}
            onLog={(id) => logFood(id, { slot: state.slot as MealSlot, portionG: state.usual?.portionG, kcal: FOODS[id]?.kcal })}
          />
        )}

        <Timeline items={state.timeline} />
      </ScrollView>
    </View>
  );
}
