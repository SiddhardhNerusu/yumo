import { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import type { MealSlot } from '@usual/shared';
import { logEvents } from '@usual/brain';
import { useTheme } from '../theme';
import { useToday, type TimelineItem } from '../useToday';
import { useEventStore } from '../data/eventStore';
import { FOODS } from '../data/seed';
import { BudgetRing } from '../components/BudgetRing';
import { UsualCard } from '../components/UsualCard';
import { Timeline } from '../components/Timeline';
import { CoachLine } from '../components/CoachLine';
import { LogSearch, SEARCH_PORTION_G } from '../components/LogSearch';
import { TimelineEditSheet } from '../components/TimelineEditSheet';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export function Today({ budget }: { budget?: number }) {
  const { c, radius } = useTheme();
  const { events, logFood, deleteLog, skipMeal } = useEventStore();
  const [now] = useState(() => Date.now());
  const [showSearch, setShowSearch] = useState(false);
  const [editItem, setEditItem] = useState<TimelineItem | null>(null);
  const state = useToday(events, now, budget);

  // Distinct recently-logged foods (newest first) for one-tap re-logging.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: { foodId: string; name: string; kcal: number }[] = [];
    const logs = logEvents(events);
    for (let i = logs.length - 1; i >= 0; i--) {
      const e = logs[i];
      const fid = e?.foodId;
      if (!fid || fid === 'quick' || seen.has(fid)) continue;
      seen.add(fid);
      const nm = e?.meta?.['name'];
      out.push({ foodId: fid, name: typeof nm === 'string' ? nm : FOODS[fid]?.name ?? fid, kcal: e?.kcal ?? 0 });
      if (out.length >= 8) break;
    }
    return out;
  }, [events]);

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
        ) : state.slotSkipped ? (
          <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.lg, padding: 20 }}>
            <Text style={{ color: c('textMuted'), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cap(state.slot)}</Text>
            <Text style={{ color: c('textPrimary'), fontSize: 18, fontWeight: '700', marginTop: 6 }}>Meal off</Text>
            <Text style={{ color: c('textSecondary'), fontSize: 14, marginTop: 2 }}>No worries — your streak’s safe.</Text>
            <Pressable onPress={() => state.slotSkipId && deleteLog(state.slotSkipId)} style={{ marginTop: 10 }}>
              <Text style={{ color: c('accent'), fontWeight: '600', fontSize: 14 }}>Actually, log it →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <UsualCard
              state={state}
              onLog={(id) => logFood(id, { slot: state.slot as MealSlot, portionG: state.usual?.portionG, kcal: FOODS[id]?.kcal })}
            />
            <Pressable onPress={() => skipMeal(state.slot as MealSlot)} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: c('textMuted'), fontSize: 13 }}>Skip this meal</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => setShowSearch(true)}
          style={{ borderWidth: 1, borderColor: c('border'), borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 15 }}>＋ Log a food</Text>
        </Pressable>

        <Timeline items={state.timeline} onEdit={setEditItem} onDelete={deleteLog} />
      </ScrollView>

      <LogSearch
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onLog={(hit) => {
          logFood(`fdc:${hit.fdcId}`, {
            slot: state.slot as MealSlot,
            portionG: SEARCH_PORTION_G,
            kcal: Math.round((hit.per100g.kcal * SEARCH_PORTION_G) / 100),
            name: hit.description,
          });
          setShowSearch(false);
        }}
        onQuickAdd={(kcal) => {
          logFood('quick', { slot: state.slot as MealSlot, kcal, name: `Quick add · ~${kcal} kcal` });
          setShowSearch(false);
        }}
        recents={recents}
        onLogRecent={(r) => {
          logFood(r.foodId, { slot: state.slot as MealSlot, kcal: r.kcal, name: r.name });
          setShowSearch(false);
        }}
      />

      <TimelineEditSheet
        item={editItem}
        onClose={() => setEditItem(null)}
        onApply={({ scale, slot }) => {
          if (!editItem) return;
          deleteLog(editItem.id);
          logFood(editItem.foodId ?? 'quick', {
            slot: slot as MealSlot,
            portionG: editItem.portionG != null ? Math.round(editItem.portionG * scale) : undefined,
            kcal: Math.round(editItem.kcal * scale),
            name: editItem.name,
          });
          setEditItem(null);
        }}
        onDelete={() => {
          if (editItem) deleteLog(editItem.id);
          setEditItem(null);
        }}
      />
    </View>
  );
}
