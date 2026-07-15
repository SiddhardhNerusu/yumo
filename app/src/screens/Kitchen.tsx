import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { UserProfile, MenuRecipe } from '@yumo/menu';
import { logEvents, localParts } from '@yumo/brain';
import { useTheme } from '../theme';
import { useNow } from '../useNow';
import { DEMO_DATA } from '../data/demo';
import { useKitchen } from '../data/kitchenStore';
import { useEventStore } from '../data/eventStore';
import { getMenu } from '../data/repo';
import { computeStreak } from '../data/streak';
import { shoppingGaps } from '../data/cookability';
import { expiringItems } from '../data/expiring';
import { mealCost, gbp, MEAL_OUT_BASELINE, TYPICAL_MEAL_COST } from '../data/kitchenMoney';
import { KitchenRoom, tileColor } from '../components/kitchen/KitchenScene';
import { ItemSheet } from '../components/kitchen/ItemSheet';
import { KitchenAddSheet } from '../components/kitchen/KitchenAddSheet';
import { KitchenVoiceSheet, type VoiceAddItem } from '../components/kitchen/KitchenVoiceSheet';
import { buildFoodVocab } from '../data/foodVocab';
import { TonightSheet } from '../components/kitchen/TonightSheet';
import { ShoppingListSheet } from '../components/kitchen/ShoppingListSheet';
import type { ShopPick } from '../data/shopping';
import { Serif, Kicker, TextLink, OutlineButton, ACCENT_BORDER } from '../components/kit';
import { freshnessOf, ZONE_LABEL, type KitchenItem, type Zone, type Freshness } from '../data/kitchen-model';
import { track } from '../analytics';
import { haptics } from '../haptics';

// §3.6 receipt choreography — what flies onto the shelves when you scan (with prices for §8 money).
const RECEIPT_ITEMS: Array<{ token: string; label: string; zone: Zone; price: number }> = [
  { token: 'broccoli', label: 'Broccoli', zone: 'fridge', price: 0.6 },
  { token: 'cheddar', label: 'Cheddar', zone: 'fridge', price: 3 },
  { token: 'firm tofu', label: 'Firm tofu', zone: 'fridge', price: 1.8 },
  { token: 'wholemeal bread', label: 'Wholemeal bread', zone: 'cupboard', price: 1.1 },
];
const LOW = '#EDA33B';
const FRESH_TAG: Record<Freshness, { label: string; col: string } | null> = {
  fresh: { label: 'FRESH', col: '#5FC48C' },
  soon: { label: 'USE SOON', col: '#EDA33B' },
  today: { label: 'USE TODAY', col: '#FF7A5C' },
  gone: { label: 'USE TODAY', col: '#FF7A5C' },
};

function ReceiptGlyph() {
  return (
    <Svg width={22} height={27} viewBox="0 0 22 27">
      <Rect x={0} y={0} width={22} height={27} rx={3} fill="#EDE3D2" />
      {[6, 11, 16, 20].map((y, i) => <Rect key={i} x={4} y={y} width={i === 3 ? 8 : 14} height={1.6} rx={0.8} fill="#9C8F7C" />)}
    </Svg>
  );
}

export function Kitchen({ profile, onClose }: { profile: UserProfile; onClose: () => void }) {
  const { c } = useTheme();
  const kitchen = useKitchen();
  const { events, logFood } = useEventStore();
  const now = useNow();

  const [focused, setFocused] = useState<Zone | null>(null);
  const [selected, setSelected] = useState<KitchenItem | null>(null);
  const [addZone, setAddZone] = useState<Zone | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [showTonight, setShowTonight] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [openZones, setOpenZones] = useState<Set<Zone>>(new Set());
  const [tossingIds, setTossingIds] = useState<Set<string>>(new Set());
  const [menuPicks, setMenuPicks] = useState<ShopPick[]>([]);
  const menuRecipes = useMemo(() => menuPicks.map((p) => p.recipe), [menuPicks]);

  useEffect(() => {
    track('kitchen_opened', {});
    getMenu(profile).then((r) => setMenuPicks(r.plan.days.flatMap((d) => d.picks.map((p) => ({ recipe: p.recipe, portionScale: p.portionScale }))))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const have = useMemo(() => kitchen.availableTokens(), [kitchen.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const gaps = useMemo(() => shoppingGaps(menuRecipes, have), [menuRecipes, have]);
  const streak = useMemo(() => computeStreak(events, now).current, [events, now]);
  const remaining = useMemo(() => {
    const today = localParts(now, 0).epochDay;
    const eaten = logEvents(events).filter((e) => localParts(e.ts, 0).epochDay === today).reduce((s, e) => s + (e.kcal ?? 0), 0);
    return Math.max(0, profile.budgetKcal - eaten);
  }, [events, now, profile.budgetKcal]);

  const inStock = kitchen.items.filter((i) => i.level !== 'out');
  const runningLow = inStock.filter((i) => i.level === 'low').length;
  const selectedLive = selected ? kitchen.items.find((i) => i.id === selected.id) ?? null : null;

  // §8 waste-saver + money recap.
  const expiring = useMemo(() => expiringItems(kitchen.items, now), [kitchen.items, now]);
  const perMealCost = useMemo(() => {
    const costs = menuRecipes.map((r) => mealCost(r, kitchen.items)).filter((x): x is number => x != null);
    return costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : TYPICAL_MEAL_COST;
  }, [menuRecipes, kitchen.items]);
  const saved = Math.round(kitchen.stats.cooked * Math.max(0, MEAL_OUT_BASELINE - perMealCost));
  const usedPct = kitchen.usedPct != null ? Math.round(kitchen.usedPct * 100) : null;
  const recap = [usedPct != null ? `Used ${usedPct}% of what you stocked` : null, saved > 0 ? `≈ ${gbp(saved)} saved cooking in` : null].filter(Boolean).join(' · ');

  const openTonight = () => { setShowTonight(true); track('tonight_viewed', {}); };
  const toggleEmpty = () => { const next = !kitchen.emptyMode; kitchen.setEmptyMode(next); track('empty_mode_on', { on: next }); };
  const voiceVocab = useMemo(() => buildFoodVocab(kitchen.items), [kitchen.items]);
  const addByVoice = (voiced: VoiceAddItem[]) => {
    kitchen.restock(voiced.map((i) => ({ token: i.token, label: i.label, level: i.level })));
    voiced.forEach(() => track('item_added', { source: 'voice' }));
  };

  const focus = (z: Zone | null) => { setFocused(z); if (z) track(z === 'counter' ? 'kitchen_counter_focused' : 'kitchen_zone_focused', {}); };
  // §3.6 tap → doors open → items fly in at 750ms → doors close at 2900ms.
  const scan = () => {
    if (scanned) return;
    setScanned(true);
    track('receipt_scanned', { lines: RECEIPT_ITEMS.length, matched: RECEIPT_ITEMS.length });
    RECEIPT_ITEMS.forEach((it) => track('item_added', { source: 'receipt', zone: it.zone }));
    haptics.impact(); // doors swing open
    setOpenZones(new Set<Zone>(['fridge', 'cupboard']));
    setTimeout(() => { haptics.impact(); kitchen.restock(RECEIPT_ITEMS); }, 750); // items land
    setTimeout(() => setOpenZones(new Set()), 2900);
  };
  // §3.7 toss: sheet closes now, tile plays tossOut, item removed ~500ms later.
  const toss = (id: string) => {
    setSelected(null);
    haptics.impact();
    setTossingIds((s) => new Set(s).add(id));
    track('item_wasted', {});
    setTimeout(() => {
      kitchen.wasteItem(id);
      setTossingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }, 500);
  };
  const logDinner = (r: MenuRecipe) => {
    // §11 north star: 'cooknow' source distinguishes cook-from-kitchen logs from ordinary menu logs.
    const decrementedIds = kitchen.decrementForRecipe(r);
    logFood(r.id, { slot: 'dinner', kcal: Math.round(r.perServing.kcal), proteinG: Math.round(r.perServing.protein_g), name: r.name, source: 'cooknow', taps: 1, meta: { decrementedIds } });
    track('tonight_accepted', {});
    setShowTonight(false);
  };

  const focusedItems = focused ? kitchen.items.filter((i) => i.zone === focused && i.level !== 'out') : [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c('bg') }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Kicker>Your kitchen</Kicker>
              <Serif size={36} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Kitchen</Serif>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ marginTop: 8 }}><Text style={{ color: c('textSecondary'), fontSize: 15, fontWeight: '600' }}>Close</Text></Pressable>
          </View>

          {/* room-view banner / focused back-chip */}
          {focused ? (
            <Pressable onPress={() => focus(null)} style={{ alignSelf: 'flex-start', marginTop: 16, marginBottom: 16, backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>‹ Back to kitchen</Text>
            </Pressable>
          ) : (
            <Pressable onPress={scanned ? undefined : (DEMO_DATA ? scan : () => setAddZone('fridge'))} style={{ marginTop: 16, marginBottom: 18, backgroundColor: c('accentFaint'), borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                {/* Real receipt OCR (Kitchen plan Phase C) isn't built yet, so production
                    opens the real add flow instead of faking a scan. The canned fly-in
                    stays for the dev showcase only. */}
                <Text style={{ color: c('accentSoft'), fontSize: 15, fontWeight: '700' }}>{DEMO_DATA ? 'Scan a receipt' : 'Add groceries'}</Text>
                <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 2 }}>{DEMO_DATA ? (scanned ? 'Scanned — the shopping flew in ✓' : 'Watch the shopping fly into your fridge') : 'Add what you bought to your kitchen'}</Text>
              </View>
              <ReceiptGlyph />
            </Pressable>
          )}

          {/* §8 waste-saver — gentle "use it up" nudge (room view only) */}
          {!focused && expiring.length > 0 ? (
            <Pressable onPress={openTonight} style={{ marginTop: -6, marginBottom: 16, backgroundColor: 'rgba(237,163,59,0.13)', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: LOW, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>🍃 {expiring.length} thing{expiring.length > 1 ? 's' : ''} to use soon</Text>
              <Text style={{ color: LOW, fontSize: 13, fontWeight: '600' }}>Tonight's dinners →</Text>
            </Pressable>
          ) : null}

          <KitchenRoom
            items={kitchen.items}
            now={now}
            recentlyAdded={kitchen.recentlyAdded}
            tossing={tossingIds}
            focused={focused}
            openZones={openZones}
            onFocus={focus}
            onItemPress={(it) => (focused ? setSelected(it) : focus(it.zone))}
            streak={streak}
            shoppingCount={kitchen.emptyMode ? 0 : gaps.length}
            onTonight={openTonight}
            onShopping={() => setShowShopping(true)}
          />

          {/* below-scene: room stats OR focused item list */}
          {focused ? (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <Serif size={22} weight="medium" color={c('textPrimary')}>{focused === 'counter' ? 'On the counter' : `In the ${ZONE_LABEL[focused].toLowerCase()}`}</Serif>
                <Text style={{ color: c('textMuted'), fontSize: 13 }}>{focusedItems.length} items</Text>
              </View>
              {focusedItems.map((it) => {
                const tag = FRESH_TAG[freshnessOf(it, now)];
                return (
                  <Pressable key={it.id} onPress={() => setSelected(it)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c('divider') }}>
                    <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: tileColor(it.token) }} />
                    <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1 }}>{it.label}</Text>
                    {tag ? <Text style={{ color: tag.col, fontSize: 11, fontWeight: '700' }}>{tag.label}</Text> : null}
                    <Text style={{ color: c('textMuted'), fontSize: 13, width: 54, textAlign: 'right', textTransform: 'capitalize' }}>{it.level}</Text>
                  </Pressable>
                );
              })}
              <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
                <OutlineButton label="＋ Add item" onPress={() => setAddZone(focused)} />
                <OutlineButton label="🎙 By voice" onPress={() => setShowVoice(true)} />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 }}>
                <Text>
                  <Text style={{ color: c('textPrimary'), fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{inStock.length}</Text>
                  <Text style={{ color: c('textMuted'), fontSize: 14 }}> items</Text>
                </Text>
                {runningLow > 0 ? <Text style={{ color: LOW, fontSize: 14, fontWeight: '700' }}>{runningLow} running low</Text> : null}
              </View>
              {recap ? <Text style={{ color: c('textMuted'), fontSize: 12.5, marginTop: 6 }}>{recap}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={() => setShowVoice(true)} accessibilityRole="button" accessibilityLabel="Add by voice" style={{ backgroundColor: c('chipSurface'), borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '700' }}>🎙 Add by voice</Text>
                </Pressable>
                <Pressable onPress={toggleEmpty} style={{ backgroundColor: kitchen.emptyMode ? c('accentFaint') : c('chipSurface'), borderWidth: 1, borderColor: kitchen.emptyMode ? ACCENT_BORDER : c('border'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ color: kitchen.emptyMode ? c('accentSoft') : c('textSecondary'), fontSize: 13, fontWeight: '700' }}>{kitchen.emptyMode ? '✓ Using things up' : 'Using things up'}</Text>
                </Pressable>
              </View>
              {kitchen.emptyMode ? <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 6 }}>Menu leans on what's in — shopping suggestions paused.</Text> : null}
              <Text style={{ color: c('textMuted'), fontSize: 13, textAlign: 'center', marginTop: 14 }}>Tap a unit or the counter to look inside · the fridge notes are tappable</Text>
            </>
          )}
        </ScrollView>

        <ItemSheet
          item={selectedLive}
          now={now}
          onClose={() => setSelected(null)}
          onLevel={kitchen.setLevel}
          onFreshness={kitchen.setFreshness}
          onZone={kitchen.moveZone}
          onToss={toss}
        />
        <KitchenAddSheet zone={addZone} onClose={() => setAddZone(null)} onAdd={(name, zone) => { kitchen.addItem(name, { label: name, zone }); track('item_added', { source: 'manual', zone }); }} />
        <KitchenVoiceSheet visible={showVoice} vocab={voiceVocab} onClose={() => setShowVoice(false)} onAdd={addByVoice} />
        <TonightSheet visible={showTonight} items={kitchen.items} remaining={remaining} now={now} onLog={logDinner} onClose={() => setShowTonight(false)} />
        <ShoppingListSheet visible={showShopping} picks={menuPicks} haveTokens={have} paused={kitchen.emptyMode} onClose={() => setShowShopping(false)} onBought={(tokens) => { kitchen.restock(tokens.map((t) => ({ token: t }))); tokens.forEach(() => track('item_added', { source: 'shopping' })); }} />
      </View>
    </Modal>
  );
}
