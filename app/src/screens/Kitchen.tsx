import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Line } from 'react-native-svg';
import type { UserProfile } from '@yumo/menu';
import { useTheme } from '../theme';
import { useNow } from '../useNow';
import { useKitchen } from '../data/kitchenStore';
import { useShoppingList } from '../data/shoppingList';
import { ZONES, ZONE_LABEL, inStock, type KitchenItem, type Zone } from '../data/kitchen-model';
import { KitchenAddSheet } from '../components/kitchen/KitchenAddSheet';
import { Serif, Sheet, withAlpha } from '../components/kit';
import { track } from '../analytics';
import { haptics } from '../haptics';

const num = { fontVariant: ['tabular-nums' as const] };
const DAY = 86_400_000;
const KEEPS_DAYS = 60; // fresh for longer than this → an undated staple ("keeps")
const FILTER_KEY = 'yumo.kitchen.filter.v1';

// The door glyph is the ONLY illustration on the page (§2). Material fills are
// deliberate illustration colours (no theme token — a fridge is always cream),
// so they stay literal; the neutral border/handle derive from textPrimary.
const MATERIAL: Record<Zone, string> = { fridge: '#E8DFC9', freezer: '#D8DEE3', cupboard: '#6B4A32', counter: '#6B4A32' };

interface Fresh { text: string; warn: boolean; keeps: boolean; days: number }
function freshnessInfo(item: KitchenItem, now: number): Fresh {
  const days = Math.round((item.freshUntil - now) / DAY);
  if (days > KEEPS_DAYS) return { text: 'keeps', warn: false, keeps: true, days: Infinity };
  if (days <= 1) return { text: 'use today', warn: true, keeps: false, days };
  if (days <= 3) return { text: `${days} days`, warn: true, keeps: false, days };
  return { text: `${days} days`, warn: false, keeps: false, days };
}

function DoorGlyph({ zone }: { zone: Zone }) {
  return (
    <Svg width={30} height={38} viewBox="0 0 30 38">
      <Rect x={0.5} y={0.5} width={29} height={37} rx={6} fill={MATERIAL[zone]} stroke="rgba(247,242,234,0.14)" strokeWidth={1} />
      <Line x1={7} y1={11} x2={7} y2={27} stroke="rgba(247,242,234,0.25)" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ReceiptGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={17} viewBox="0 0 15 17">
      <Rect x={0.5} y={0.5} width={14} height={16} rx={2} fill="none" stroke={color} strokeWidth={1.2} />
      {[4, 7.5, 11].map((y, i) => <Line key={i} x1={3} y1={y} x2={i === 2 ? 8 : 12} y2={y} stroke={color} strokeWidth={1.2} strokeLinecap="round" />)}
    </Svg>
  );
}

/** §11 kicker — 11/700/1.3 uppercase textMuted. */
function Kick({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={{ color: c('textMuted'), fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' }}>{children}</Text>;
}

/** §4 row action bar — fades in (200ms), one open at a time. */
function ActionBar({ onUsed, onLow, onBin }: { onUsed: () => void; onLow: () => void; onBin: () => void }) {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, [a]);
  const btn = (label: string, onPress: () => void, bg: string, fg: string, border?: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border, borderRadius: 10, paddingVertical: 9, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }}>
      {btn('✓ Used up', onUsed, withAlpha(c('success'), 0.12), c('success'))}
      {btn('Running low', onLow, withAlpha(c('warning'), 0.13), c('warning'))}
      {btn('Bin', onBin, c('surfaceSunken'), c('textSecondary'), c('border'))}
    </Animated.View>
  );
}

/**
 * The Kitchen tab (§6a) — three unit cards filter one scalable inventory list.
 * No illustrated scene, no per-item icons, text-first rows. Freshness is days-left
 * (or "keeps"); amount surfaces only as a Low badge.
 */
export function Kitchen({ profile }: { profile: UserProfile }) {
  void profile;
  const { c } = useTheme();
  const kitchen = useKitchen();
  const shopping = useShoppingList();
  const now = useNow();

  const [filter, setFilter] = useState<Zone | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [snack, setSnack] = useState<{ text: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { track('kitchen_opened', {}); }, []);
  // persist the last unit filter across visits (§2).
  useEffect(() => { AsyncStorage.getItem(FILTER_KEY).then((v) => { if (v === 'fridge' || v === 'freezer' || v === 'cupboard') setFilter(v); }).catch(() => {}); }, []);
  const pickFilter = (z: Zone) => {
    setOpenId(null);
    setFilter((cur) => {
      const next = cur === z ? null : z;
      AsyncStorage.setItem(FILTER_KEY, next ?? '').catch(() => {});
      return next;
    });
  };

  const flash = (text: string, actionLabel?: string, onAction?: () => void) => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnack({ text, actionLabel, onAction });
    snackTimer.current = setTimeout(() => setSnack(null), 4000);
  };
  useEffect(() => () => { if (snackTimer.current) clearTimeout(snackTimer.current); }, []);

  const stock = useMemo(() => kitchen.items.filter((i) => inStock(i.level)), [kitchen.items]);
  const fresh = useMemo(() => new Map(stock.map((i) => [i.id, freshnessInfo(i, now)])), [stock, now]);

  const zoneCount = (z: Zone) => stock.filter((i) => (i.zone === 'counter' ? 'cupboard' : i.zone) === z).length;
  const soonCount = (z: Zone) => (z === 'freezer' ? 0 : stock.filter((i) => (i.zone === 'counter' ? 'cupboard' : i.zone) === z && !fresh.get(i.id)!.keeps && fresh.get(i.id)!.days <= 3).length);

  const q = query.trim().toLowerCase();
  const zoneOf = (i: KitchenItem): Zone => (i.zone === 'counter' ? 'cupboard' : i.zone);
  const visible = useMemo(() => stock.filter((i) => (!filter || zoneOf(i) === filter) && (q.length < 1 || i.label.toLowerCase().includes(q))), [stock, filter, q]);

  const sortRows = (rows: KitchenItem[]) => [...rows].sort((a, b) => {
    const fa = fresh.get(a.id)!, fb = fresh.get(b.id)!;
    if (fa.keeps !== fb.keeps) return fa.keeps ? 1 : -1; // undated staples last
    if (fa.keeps) return a.label.localeCompare(b.label); // then alphabetical
    return fa.days - fb.days; // else days-left ascending
  });

  // grouped (no filter) or flat (filtered)
  const groups: Array<{ zone: Zone | null; rows: KitchenItem[] }> = filter
    ? [{ zone: null, rows: sortRows(visible) }]
    : ZONES.map((z) => ({ zone: z, rows: sortRows(visible.filter((i) => zoneOf(i) === z)) })).filter((g) => g.rows.length);

  const noMatch = q.length >= 1 && visible.length === 0;
  const freeAddQuery = query.trim();

  const doFreeAdd = () => {
    if (freeAddQuery.length < 2) return;
    kitchen.addItem(freeAddQuery, filter ? { zone: filter } : {});
    track('item_added', { source: 'freeadd' });
    haptics.select();
    setQuery('');
  };

  const usedUp = (it: KitchenItem) => {
    setOpenId(null);
    kitchen.removeItem(it.id);
    track('item_used_up', {});
    flash(`${it.label} used up`, shopping.has(it.token) ? undefined : 'Add to list', shopping.has(it.token) ? undefined : () => { shopping.add(it.token, it.label); flash(`${it.label} added to shopping list`); });
  };
  const runLow = (it: KitchenItem) => {
    setOpenId(null);
    kitchen.setLevel(it.id, 'low');
    shopping.add(it.token, it.label);
    track('item_low', {});
    flash(`${it.label} added to shopping list`);
  };
  const bin = (it: KitchenItem) => {
    setOpenId(null);
    kitchen.wasteItem(it.id);
    track('item_wasted', {});
    haptics.impact();
    flash(`${it.label} binned`);
  };

  const buyAll = (tokens: string[]) => {
    kitchen.restock(tokens.map((t) => ({ token: t })));
    tokens.forEach((t) => { shopping.remove(t); track('item_added', { source: 'shopping' }); });
  };

  const placeholder = filter ? `Search the ${ZONE_LABEL[filter].toLowerCase()}…` : 'Search your kitchen…';

  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 58, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Kick>Your kitchen</Kick>
            <Serif size={30} weight="medium" color={c('textPrimary')} style={{ letterSpacing: -0.5, marginTop: 2 }}>Kitchen</Serif>
          </View>
          <Pressable onPress={() => setAddOpen(true)} accessibilityRole="button" accessibilityLabel="Scan receipt" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c('accentFaint'), borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, marginTop: 4, opacity: pressed ? 0.7 : 1 })}>
            <ReceiptGlyph color={c('accentSoft')} />
            <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '700' }}>Scan receipt</Text>
          </Pressable>
        </View>

        {/* Unit cards */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ZONES.map((z) => {
            const on = filter === z;
            const soon = soonCount(z);
            return (
              <Pressable key={z} onPress={() => pickFilter(z)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: on ? c('accentFaint') : c('surface'), borderWidth: 1, borderColor: on ? withAlpha(c('accent'), 0.55) : c('border') }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <DoorGlyph zone={z} />
                  {soon > 0 ? (
                    <View style={{ backgroundColor: withAlpha(c('warning'), 0.18), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                      <Text style={[{ color: c('warning'), fontSize: 10.5, fontWeight: '700' }, num]}>{soon} soon</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: on ? c('accentSoft') : c('textPrimary'), fontSize: 13, fontWeight: '700', marginTop: 10 }}>{ZONE_LABEL[z]}</Text>
                <Text style={[{ color: on ? withAlpha(c('accentSoft'), 0.7) : c('textMuted'), fontSize: 11.5, marginTop: 1 }, num]}>{zoneCount(z)} item{zoneCount(z) === 1 ? '' : 's'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={c('textMuted')}
          style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: c('textPrimary'), fontSize: 14 }}
        />
        {noMatch && freeAddQuery.length >= 2 ? (
          <Pressable onPress={doFreeAdd} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: withAlpha(c('textPrimary'), 0.25), borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '600' }}>＋ Add “{freeAddQuery}” to your kitchen</Text>
          </Pressable>
        ) : null}

        {/* Inventory list */}
        <View style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderTopColor: withAlpha(c('textPrimary'), 0.14), borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
          {visible.length === 0 ? (
            <Text style={{ color: c('textMuted'), fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>{q.length >= 1 ? 'Nothing matches — add it above.' : 'Your kitchen is empty — add what you have.'}</Text>
          ) : groups.map((g, gi) => (
            <View key={g.zone ?? 'all'}>
              {g.zone ? <View style={{ paddingTop: gi === 0 ? 10 : 14, paddingBottom: 4 }}><Kick>{ZONE_LABEL[g.zone]}</Kick></View> : null}
              {g.rows.map((it, ri) => {
                const f = fresh.get(it.id)!;
                const open = openId === it.id;
                return (
                  <View key={it.id} style={{ borderTopWidth: ri === 0 && (g.zone || gi === 0) ? 0 : 1, borderTopColor: withAlpha(c('textPrimary'), 0.06) }}>
                    <Pressable onPress={() => setOpenId(open ? null : it.id)} accessibilityRole="button" accessibilityLabel={`${it.label}, ${f.text}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
                      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c('textPrimary'), fontSize: 14.5, fontWeight: '600' }}>{it.label}</Text>
                      {it.level === 'low' ? (
                        <View style={{ backgroundColor: withAlpha(c('warning'), 0.13), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                          <Text style={{ color: c('warning'), fontSize: 11, fontWeight: '700' }}>Low</Text>
                        </View>
                      ) : null}
                      <Text style={[{ fontSize: 12.5, fontWeight: '600', color: f.warn ? c('warning') : c('textMuted') }, num]}>{f.text}</Text>
                    </Pressable>
                    {open ? <ActionBar onUsed={() => usedUp(it)} onLow={() => runLow(it)} onBin={() => bin(it)} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
          <Text style={[{ color: c('textMuted'), fontSize: 12 }, num]}>{stock.length} item{stock.length === 1 ? '' : 's'} · tap one for actions</Text>
          <Pressable onPress={() => setShowList(true)} accessibilityRole="button" hitSlop={8}>
            <Text style={[{ color: c('accentSoft'), fontSize: 13, fontWeight: '600' }, num]}>Shopping list · {shopping.count} ›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* snackbar */}
      {snack ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: c('textPrimary'), fontSize: 13.5, flex: 1 }} numberOfLines={1}>{snack.text}</Text>
          {snack.actionLabel && snack.onAction ? (
            <Pressable onPress={() => { snack.onAction!(); }} hitSlop={8}><Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '700' }}>{snack.actionLabel}</Text></Pressable>
          ) : null}
        </View>
      ) : null}

      <KitchenAddSheet zone={addOpen ? (filter ?? 'fridge') : null} onClose={() => setAddOpen(false)} onAdd={(name, zone) => { kitchen.addItem(name, { label: name, zone }); track('item_added', { source: 'manual', zone }); }} />
      <ShoppingListSheet visible={showList} items={shopping.items} onClose={() => setShowList(false)} onRemove={shopping.remove} onBought={buyAll} />
    </View>
  );
}

// ── shopping list sheet ──────────────────────────────────────────────────────

function ShoppingListSheet({ visible, items, onClose, onRemove, onBought }: { visible: boolean; items: { token: string; label: string }[]; onClose: () => void; onRemove: (token: string) => void; onBought: (tokens: string[]) => void }) {
  const { c } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (t: string) => setChecked((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const buy = () => { const tokens = [...checked]; if (tokens.length) onBought(tokens); setChecked(new Set()); onClose(); };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Shopping list</Serif>
        <Text style={{ color: c('textMuted'), fontSize: 13 }}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={{ color: c('textMuted'), fontSize: 14, paddingVertical: 20, textAlign: 'center' }}>Nothing to buy yet. “Used up” and “Running low” add items here.</Text>
      ) : (
        <>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {items.map((it) => {
              const on = checked.has(it.token);
              return (
                <View key={it.token} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c('divider') }}>
                  <Pressable onPress={() => toggle(it.token)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} hitSlop={6} style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? c('accent') : c('borderStrong'), backgroundColor: on ? c('accent') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Text style={{ color: c('accentText'), fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                  </Pressable>
                  <Text style={{ flex: 1, color: c('textPrimary'), fontSize: 15, textDecorationLine: on ? 'line-through' : 'none' }}>{it.label}</Text>
                  <Pressable onPress={() => onRemove(it.token)} hitSlop={8}><Text style={{ color: c('textMuted'), fontSize: 18 }}>×</Text></Pressable>
                </View>
              );
            })}
          </ScrollView>
          <Pressable onPress={buy} disabled={checked.size === 0} accessibilityRole="button" style={{ marginTop: 16, backgroundColor: c('accent'), borderRadius: 999, paddingVertical: 13, alignItems: 'center', opacity: checked.size === 0 ? 0.5 : 1 }}>
            <Text style={{ color: c('accentText'), fontSize: 14, fontWeight: '700' }}>Bought {checked.size || ''} — add to kitchen</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}
