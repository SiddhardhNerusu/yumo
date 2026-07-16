import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, ClipPath, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Serif } from '../kit';
import { freshnessOf, type KitchenItem, type Zone, type Freshness } from '../../data/kitchen-model';
import { kindOf, ROUND_KINDS, type Kind } from '../../data/kitchen-kinds';

// ── design space ─────────────────────────────────────────────────────────────
const DW = 350;
const DH = 436;
const FLOOR_Y = 408;
type Rectangle = { x: number; y: number; w: number; h: number };
const UNITS: Record<Zone, Rectangle> = {
  cupboard: { x: 8, y: 22, w: 150, h: 128 },
  fridge: { x: 196, y: 22, w: 146, h: 246 },
  freezer: { x: 196, y: 271, w: 146, h: 118 },
  counter: { x: 0, y: 190, w: 170, h: 246 },
};
const DOOR_ZONES: Zone[] = ['cupboard', 'fridge', 'freezer'];
const ALL_ZONES: Zone[] = ['cupboard', 'fridge', 'freezer', 'counter'];

// ── colour helpers ────────────────────────────────────────────────────────────
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
/** CSS color-mix(in srgb, a wa%, b) — wa is a's weight in [0,1]. */
function mix(a: string, b: string, wa: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x * wa + y * (1 - wa)).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

// ── tile colour vocabulary ────────────────────────────────────────────────────
const TILE_COLORS: Array<[RegExp, string]> = [
  [/\begg/, '#F7E9C8'],
  [/milk|yogurt|yoghurt|rice|ice cream|cream/, '#F1E6D0'],
  [/spinach|\bpeas?\b|broccoli|kale|lettuce|herb|courgette|greens|edamame/, '#5FC48C'],
  [/chicken|salmon|fish|turkey|prawn|beef|pork|lamb|tuna|meat|tofu/, '#E58F6E'],
  [/butter|oat|peanut|cheddar|cheese|honey/, '#EDA33B'],
  [/pasta|leftover|noodle|couscous/, '#C97E5A'],
  [/tomato|berry|berries|salsa|pepper/, '#D96248'],
  [/orange/, '#E8963C'],
  [/apple/, '#C24B3A'],
  [/veg|carrot|cauliflower|mushroom|onion|garlic|cucumber|frozen/, '#BFD9D4'],
  [/bread|sourdough|toast|bagel|flour|wrap|tortilla|pitta/, '#C9A15E'],
  [/banana/, '#EDD35C'],
];
export function tileColor(token: string): string {
  const t = token.toLowerCase();
  for (const [re, col] of TILE_COLORS) if (re.test(t)) return col;
  return '#C9BEAF';
}

const FRESH_COL: Record<Freshness, string> = { fresh: '#5FC48C', soon: '#EDA33B', today: '#FF7A5C', gone: '#FF7A5C' };
const hashOf = (id: string) => (id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0);

// ── camera transform for a focus target ───────────────────────────────────────
// The springy zoom (§3.1). iOS rasterises a transform-scaled layer at its
// original size, so the zoomed ROOM goes soft mid-flight — that's fine in motion.
// At rest, a full-resolution FocusedUnit overlay cross-fades in over the unit
// (see below), so what the user READS is always crisp. Never leave a scaled-up
// layer as the resting state.
function camFor(zone: Zone | null): { tx: number; ty: number; s: number } {
  if (!zone) return { tx: 0, ty: 0, s: 1 };
  const u = UNITS[zone];
  const s = Math.min((DW * 0.92) / u.w, (DH * 0.9) / u.h);
  const ucx = u.x + u.w / 2;
  const ucy = u.y + u.h / 2;
  // transform order [translate, scale] with scale about the view centre C:
  // p → C + s(p−C) + t. Solving unit-centre ↦ C gives t = −s(uc − C).
  return { tx: -s * (ucx - DW / 2), ty: -s * (ucy - DH / 2), s };
}

// ── appliance / cabinet faces ─────────────────────────────────────────────────
let gidc = 0;
function FaceWhite({ w, h, radius }: { w: number; h: number; radius: number }) {
  const gid = useRef(`fw${gidc++}`).current;
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor="#F2ECE2" />
          <Stop offset="0.55" stopColor="#E4DCCD" />
          <Stop offset="1" stopColor="#D3CBBB" />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={radius} fill={`url(#${gid})`} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
      <Rect x={4} y={2} width={w - 8} height={2} rx={1} fill="rgba(255,255,255,0.45)" />
    </Svg>
  );
}
function FaceWood({ w, h, radius }: { w: number; h: number; radius: number }) {
  const gid = useRef(`wd${gidc++}`).current;
  // near-vertical grain: stripes run DOWN the door (97°/94° gradient axis), repeating across X.
  const grain = [];
  for (let i = 0; i < Math.ceil(w / 8) + 1; i++) grain.push(<Rect key={`d${i}`} x={i * 8} y={-6} width={2} height={h + 12} fill="#000000" fillOpacity={0.16} transform={`rotate(7 ${i * 8} ${h / 2})`} />);
  for (let i = 0; i < Math.ceil(w / 13) + 1; i++) grain.push(<Rect key={`l${i}`} x={i * 13 + 4} y={-6} width={1} height={h + 12} fill="#FFC88C" fillOpacity={0.05} transform={`rotate(4 ${i * 13} ${h / 2})`} />);
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor="#4C3A26" />
          <Stop offset="1" stopColor="#2F2114" />
        </LinearGradient>
        <ClipPath id={`${gid}c`}><Rect x={0} y={0} width={w} height={h} rx={radius} /></ClipPath>
      </Defs>
      <G clipPath={`url(#${gid}c)`}>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${gid})`} />
        {grain}
        <Rect x={0} y={0} width={w} height={2.5} fill="rgba(247,242,234,0.06)" />
      </G>
    </Svg>
  );
}

// ── glyph tile (SVG: gradient fill + kind silhouette) ─────────────────────────
function glyphShapes(kind: Kind, w: number, h: number, dark: string, light: string): ReactNode[] {
  const R = (fx: number, fy: number, fw: number, fh: number, fill: string, rx = 1.5) =>
    <Rect key={`${fx}-${fy}-${fill}`} x={fx * w} y={fy * h} width={fw * w} height={fh * h} rx={rx} fill={fill} />;
  const dot = (fx: number, fy: number, fw: number, fh: number, fill: string) => R(fx, fy, fw, fh, fill, Math.min(fw * w, fh * h) / 2);
  switch (kind) {
    case 'carton': return [R(0.12, 0, 0.76, 0.18, dark), R(0.2, 0.4, 0.6, 0.26, light)];
    case 'jar': return [R(0.08, 0, 0.84, 0.16, dark), R(0.16, 0.36, 0.68, 0.32, light)];
    case 'tin': return [R(0, 0.06, 1, 0.08, light), R(0, 0.84, 1, 0.08, dark)];
    case 'eggs': return [dot(0.11, 0.32, 0.18, 0.24, light), dot(0.41, 0.32, 0.18, 0.24, light), dot(0.71, 0.32, 0.18, 0.24, light)];
    case 'produce': return [dot(-0.08, -0.1, 0.56, 0.52, light), dot(0.48, -0.06, 0.5, 0.46, dark)];
    case 'fruit': return [dot(0.58, -0.06, 0.26, 0.26, '#4AA875')];
    case 'tub': return [R(-0.04, 0, 1.08, 0.2, dark, 3)];
    case 'loaf': return [dot(0.16, 0.26, 0.12, 0.48, dark), dot(0.42, 0.26, 0.12, 0.48, dark), dot(0.68, 0.26, 0.12, 0.48, dark)];
    default: return [R(0.18, 0.32, 0.64, 0.32, light, 2)];
  }
}
function GlyphTile({ kind, w, h, color }: { kind: Kind; w: number; h: number; color: string }) {
  const gid = useRef(`gt${gidc++}`).current;
  const radius = ROUND_KINDS.has(kind) ? Math.min(w, h) / 2 : kind === 'loaf' ? 9 : 6;
  const dark = mix(color, '#170D04', 0.62);
  const light = 'rgba(255,255,255,0.3)';
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={gid} x1="0.15" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="0.2" stopColor={color} />
          <Stop offset="1" stopColor={mix(color, '#1A0F06', 0.7)} />
        </LinearGradient>
        <ClipPath id={`${gid}c`}><Rect x={0} y={0} width={w} height={h} rx={radius} /></ClipPath>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={radius} fill={`url(#${gid})`} />
      <G clipPath={`url(#${gid}c)`}>{glyphShapes(kind, w, h, dark, light)}</G>
    </Svg>
  );
}

// §3.5 feathered amber glow (soft-edge reproduction of the CSS blur-5 bar).
function SoftGlow({ w, h }: { w: number; h: number }) {
  const gid = useRef(`sg${gidc++}`).current;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={gid} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#EDA33B" stopOpacity={0.32} />
          <Stop offset="0.5" stopColor="#EDA33B" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#EDA33B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={`url(#${gid})`} />
    </Svg>
  );
}
/** Pulsing use-soon glow at a unit's base — renders on TOP of the door, room view only. */
function UseSoonGlow({ unitW, chromeV, bottom = -12 }: { unitW: number; chromeV: Animated.Value; bottom?: number }) {
  const glow = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.8, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.35, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);
  const w = unitW * 0.72;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom, left: unitW * 0.14, width: w, height: 16, opacity: Animated.multiply(glow, chromeV) }}>
      <SoftGlow w={w} h={16} />
    </Animated.View>
  );
}

const SPRING = Easing.bezier(0.34, 1.45, 0.5, 1);
const FLY_EZ = Easing.bezier(0.34, 1.2, 0.5, 1);
const TOSS_EZ = Easing.bezier(0.5, 0, 0.8, 0.4);

/** One shelf tile — glyph, label, freshness dot, and the settle/fly/toss motion. */
function Tile({ item, slotCenterX, shelfY, now, labelV, isOpen, justAdded, tossing, index, flyIndex, onPress }: {
  item: KitchenItem; slotCenterX: number; shelfY: number; now: number; labelV: Animated.Value;
  isOpen: boolean; justAdded: boolean; tossing: boolean; index: number; flyIndex: number; onPress: () => void;
}) {
  const kind = kindOf(item.token);
  const col = tileColor(item.token);
  const fresh = freshnessOf(item, now);
  const low = item.level === 'low';
  // uniform footprint so tiles line up cleanly on the shelf; round kinds differ
  // only by corner radius (handled in GlyphTile), which now reads as deliberate.
  const w = 30;
  const h = 30;

  const left = slotCenterX - w / 2;
  const top = shelfY - 11 - h;

  const settle = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const fly = useRef(new Animated.Value(justAdded ? 0 : 1)).current;
  const toss = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (justAdded) return; // fly-in owns the transform this cycle
    Animated.timing(settle, { toValue: isOpen ? 1 : 0, duration: isOpen ? 520 : 200, delay: isOpen ? 380 + index * 55 : 0, easing: isOpen ? SPRING : Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [isOpen, justAdded, settle, index]);
  useEffect(() => {
    if (!justAdded) return;
    fly.setValue(0);
    // stagger by fly-in order (among just-added items), NOT zone position — else a
    // receipt item appended at zone idx 8+ would delay past the recentlyAdded window.
    Animated.timing(fly, { toValue: 1, duration: 750, delay: 200 + flyIndex * 130, easing: FLY_EZ, useNativeDriver: true }).start();
  }, [justAdded, fly, flyIndex]);
  useEffect(() => {
    if (tossing) Animated.timing(toss, { toValue: 1, duration: 480, easing: TOSS_EZ, useNativeDriver: true }).start();
  }, [tossing, toss]);

  let transform: object[];
  let opacity: Animated.Value | Animated.AnimatedInterpolation<number> = fly;
  if (tossing) {
    transform = [{ translateY: toss.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) }, { scale: toss.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }, { rotate: toss.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) }];
    opacity = toss.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  } else if (justAdded) {
    transform = [{ translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [-320, 0] }) }, { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }, { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['12deg', '0deg'] }) }];
    opacity = fly;
  } else {
    transform = [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }, { scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }];
    opacity = 1 as unknown as Animated.Value;
  }

  return (
    <>
      <Animated.View style={{ position: 'absolute', left, top, width: w, height: h, opacity, transform: transform as never }}>
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={item.label} style={{ opacity: low ? 0.6 : 1 }}>
          <GlyphTile kind={kind} w={w} h={h} color={col} />
        </Pressable>
      </Animated.View>
      {/* freshness dot — top-right corner, revealed on focus (soft, ringless) */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: left + w - 5, top: top - 4, width: 9, height: 9, borderRadius: 5, backgroundColor: FRESH_COL[fresh], opacity: labelV, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1 } }} />
      {/* label — between tile and shelf */}
      <Animated.Text numberOfLines={1} style={{ position: 'absolute', top: shelfY - 10.5, left: slotCenterX - 22.5, width: 45, textAlign: 'center', color: '#D8CDBB', fontSize: 6, fontWeight: '600', opacity: labelV }}>{item.label}</Animated.Text>
    </>
  );
}

// ── inset-shadowed, dynamically-shelved interior for a door unit ──────────────
function Interior({ zone, items, now, labelV, openV, isOpen, recentlyAdded, tossing, onItemPress }: {
  zone: Zone; items: KitchenItem[]; now: number; labelV: Animated.Value; openV: Animated.Value; isOpen: boolean;
  recentlyAdded: Set<string>; tossing: Set<string>; onItemPress: (i: KitchenItem) => void;
}) {
  const u = UNITS[zone];
  const frost = zone === 'freezer';
  const iid = useRef(`in${gidc++}`).current;
  const innerW = u.w - 10;
  const innerH = u.h - 10;
  const n = items.length;
  const nRows = Math.max(1, Math.ceil(n / 3));
  const rowStep = (innerH - 16) / nRows;
  const bg1 = frost ? '#12161A' : '#100D0A';
  const bg2 = frost ? '#1A2129' : '#1A130C';
  const shelfCol = frost ? 'rgba(159,199,224,0.3)' : 'rgba(247,242,234,0.22)';
  // fly-in ordinal among just-added items (0,1,2…) so the receipt stagger stays 200–590ms.
  let fc = 0;
  const flyIdx = items.map((it) => (recentlyAdded.has(it.id) ? fc++ : 0));

  return (
    <View style={{ position: 'absolute', left: 5, top: 5, width: innerW, height: innerH, borderRadius: zone === 'cupboard' ? 8 : 10, overflow: 'hidden' }}>
      {/* depth: vertical gradient + top & side inset shadows */}
      <Svg width={innerW} height={innerH} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={`${iid}b`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={bg1} /><Stop offset="1" stopColor={bg2} /></LinearGradient>
          <LinearGradient id={`${iid}t`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity={0.55} /><Stop offset="1" stopColor="#000000" stopOpacity={0} /></LinearGradient>
          <LinearGradient id={`${iid}l`} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#000000" stopOpacity={0.3} /><Stop offset="1" stopColor="#000000" stopOpacity={0} /></LinearGradient>
          <LinearGradient id={`${iid}r`} x1="1" y1="0" x2="0" y2="0"><Stop offset="0" stopColor="#000000" stopOpacity={0.3} /><Stop offset="1" stopColor="#000000" stopOpacity={0} /></LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={innerW} height={innerH} fill={`url(#${iid}b)`} />
        <Rect x={0} y={0} width={innerW} height={18} fill={`url(#${iid}t)`} />
        <Rect x={0} y={0} width={6} height={innerH} fill={`url(#${iid}l)`} />
        <Rect x={innerW - 6} y={0} width={6} height={innerH} fill={`url(#${iid}r)`} />
      </Svg>

      {/* quiet zone name */}
      <Text style={{ position: 'absolute', top: 4, left: 7, color: frost ? '#9FC7E0' : '#9C8F7C', fontSize: 5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.75 }}>{frost ? '❄ Freezer' : zone}</Text>

      {/* shelf boards */}
      {Array.from({ length: nRows }).map((_, r) => {
        const y = 14 + (r + 1) * rowStep;
        return (
          <View key={r} pointerEvents="none" style={{ position: 'absolute', left: 6, right: 6, top: y }}>
            <View style={{ height: 3.5, borderRadius: 1, backgroundColor: shelfCol }} />
            <View style={{ height: 3, backgroundColor: 'rgba(0,0,0,0.28)', opacity: 0.6 }} />
          </View>
        );
      })}

      {/* tiles */}
      {items.map((it, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const itemsInRow = Math.min(3, n - row * 3);
        const xStart = (innerW - itemsInRow * 45) / 2;
        const slotCenterX = xStart + col * 45 + 22.5;
        const shelfY = 14 + (row + 1) * rowStep;
        return <Tile key={it.id} item={it} slotCenterX={slotCenterX} shelfY={shelfY} now={now} labelV={labelV} isOpen={isOpen} justAdded={recentlyAdded.has(it.id)} tossing={tossing.has(it.id)} index={idx} flyIndex={flyIdx[idx]!} onPress={() => onItemPress(it)} />;
      })}

      {/* door-shadow sweep — 1 when closed → 0 when open */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: innerW, height: innerH, opacity: openV.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
        <Svg width={innerW} height={innerH}>
          <Defs><LinearGradient id={`${iid}s`} x1="0" y1="0" x2="1" y2="0.17"><Stop offset="0" stopColor="#000000" stopOpacity={0.5} /><Stop offset="0.55" stopColor="#000000" stopOpacity={0} /></LinearGradient></Defs>
          <Rect x={0} y={0} width={innerW} height={innerH} fill={`url(#${iid}s)`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** One tile in the crisp focused layer — full-res GlyphTile + a springy settle. */
function FocusedTile({ item, now, z, x, shelfY, index, onPress }: {
  item: KitchenItem; now: number; z: number; x: number; shelfY: number; index: number; onPress: () => void;
}) {
  const size = 30 * z;
  const labelW = 45 * z;
  const fresh = freshnessOf(item, now);
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(settle, { toValue: 1, duration: 420, delay: index * 45, easing: SPRING, useNativeDriver: true }).start();
  }, [settle, index]);
  return (
    <Animated.View style={{ position: 'absolute', left: x - labelW / 2, top: shelfY - 11 * z - size, width: labelW, alignItems: 'center', opacity: settle, transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={item.label} style={{ opacity: item.level === 'low' ? 0.6 : 1 }}>
        <GlyphTile kind={kindOf(item.token)} w={size} h={size} color={tileColor(item.token)} />
      </Pressable>
      <View pointerEvents="none" style={{ position: 'absolute', right: labelW / 2 - size / 2 - 5, top: -4, width: 11, height: 11, borderRadius: 6, backgroundColor: FRESH_COL[fresh], shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1 } }} />
      <Text numberOfLines={1} style={{ marginTop: 5, width: labelW, textAlign: 'center', color: '#D8CDBB', fontSize: Math.max(11, Math.round(6 * z)), fontWeight: '600' }}>{item.label}</Text>
    </Animated.View>
  );
}

/**
 * The crisp zoomed unit. The camera zoom transform-scales the room (soft, fine in
 * motion); this layer re-renders the SAME interior at full native resolution at
 * the camera's resting size, so the focused fridge is sharp — readable labels,
 * real tap targets. Cross-faded in by KitchenRoom once the camera lands.
 */
function FocusedUnit({ zone, items, now, z, w, h, onItemPress }: {
  zone: Zone; items: KitchenItem[]; now: number; z: number; w: number; h: number; onItemPress: (i: KitchenItem) => void;
}) {
  const frost = zone === 'freezer';
  const gid = useRef(`fu${gidc++}`).current;
  const inset = 5 * z;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const n = items.length;
  const nRows = Math.max(1, Math.ceil(n / 3));
  const rowStep = (innerH - 16 * z) / nRows;
  const bg1 = frost ? '#12161A' : '#100D0A';
  const bg2 = frost ? '#1A2129' : '#1A130C';
  const shelfCol = frost ? 'rgba(159,199,224,0.3)' : 'rgba(247,242,234,0.22)';
  const slotW = 45 * z;
  const title = zone === 'counter' ? 'On the counter' : frost ? '❄ Freezer' : zone;
  return (
    <View style={{ width: w, height: h, borderRadius: 16, backgroundColor: '#0E0B08', borderWidth: 1.5, borderColor: 'rgba(247,242,234,0.14)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } }}>
      {/* interior light bloom */}
      <View pointerEvents="none" style={{ position: 'absolute', left: inset, top: -h * 0.3, width: innerW, height: h * 0.7, borderRadius: w, backgroundColor: frost ? 'rgba(120,180,220,0.12)' : 'rgba(255,106,61,0.13)' }} />
      <View style={{ position: 'absolute', left: inset, top: inset, width: innerW, height: innerH, borderRadius: 12, overflow: 'hidden' }}>
        <Svg width={innerW} height={innerH} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={`${gid}b`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={bg1} /><Stop offset="1" stopColor={bg2} /></LinearGradient>
            <LinearGradient id={`${gid}t`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity={0.55} /><Stop offset="1" stopColor="#000000" stopOpacity={0} /></LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={innerW} height={innerH} fill={`url(#${gid}b)`} />
          <Rect x={0} y={0} width={innerW} height={18 * z} fill={`url(#${gid}t)`} />
        </Svg>
        <Text style={{ position: 'absolute', top: 8, left: 12, color: frost ? '#9FC7E0' : '#9C8F7C', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 }}>{title}</Text>
        {Array.from({ length: nRows }).map((_, r) => {
          const y = 14 * z + (r + 1) * rowStep;
          return (
            <View key={r} pointerEvents="none" style={{ position: 'absolute', left: 6 * z, right: 6 * z, top: y }}>
              <View style={{ height: Math.max(3.5, 3.5 * z), borderRadius: 2, backgroundColor: shelfCol }} />
              <View style={{ height: 3 * z, backgroundColor: 'rgba(0,0,0,0.28)', opacity: 0.6 }} />
            </View>
          );
        })}
        {items.map((it, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          const itemsInRow = Math.min(3, n - row * 3);
          const xStart = (innerW - itemsInRow * slotW) / 2;
          const x = xStart + col * slotW + slotW / 2;
          const shelfY = 14 * z + (row + 1) * rowStep;
          return <FocusedTile key={it.id} item={it} now={now} z={z} x={x} shelfY={shelfY} index={idx} onPress={() => onItemPress(it)} />;
        })}
        {n === 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: innerH / 2 - 10, alignItems: 'center' }}>
            <Text style={{ color: '#9C8F7C', fontSize: 13 }}>Nothing in here yet</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function KitchenRoom({ items, now, recentlyAdded, tossing, focused, openZones, onFocus, onItemPress, streak, shoppingCount, onTonight, onShopping }: {
  items: KitchenItem[];
  now: number;
  recentlyAdded: Set<string>;
  tossing: Set<string>;
  focused: Zone | null;
  openZones: Set<Zone>;
  onFocus: (z: Zone | null) => void;
  onItemPress: (i: KitchenItem) => void;
  streak: number;
  shoppingCount: number;
  onTonight: () => void;
  onShopping: () => void;
}) {
  const { c } = useTheme();
  const { width: winW } = useWindowDimensions();
  const contentW = winW - 40;
  // NEVER upscale via transform: on wide devices (Pro Max) sf > 1 rasterised the
  // whole room slightly blurry at rest. Cap at 1 and letterbox instead — crisp.
  const sf = Math.min(1, contentW / DW);
  const boxH = DH * sf;
  const byZone = (z: Zone) => items.filter((it) => it.zone === z && it.level !== 'out');
  const isOpenZone = (z: Zone) => focused === z || openZones.has(z);

  const camTx = useRef(new Animated.Value(0)).current;
  const camTy = useRef(new Animated.Value(0)).current;
  const camS = useRef(new Animated.Value(1)).current;
  const openV = useRef<Record<Zone, Animated.Value>>({ cupboard: new Animated.Value(0), fridge: new Animated.Value(0), freezer: new Animated.Value(0), counter: new Animated.Value(0) }).current;
  const dimV = useRef<Record<Zone, Animated.Value>>({ cupboard: new Animated.Value(1), fridge: new Animated.Value(1), freezer: new Animated.Value(1), counter: new Animated.Value(1) }).current;
  const pressV = useRef<Record<Zone, Animated.Value>>({ cupboard: new Animated.Value(1), fridge: new Animated.Value(1), freezer: new Animated.Value(1), counter: new Animated.Value(1) }).current;
  const chromeV = useRef(new Animated.Value(1)).current;
  // crisp focused layer: which zone it shows (held through the fade-out) + its fade.
  const [crispZone, setCrispZone] = useState<Zone | null>(null);
  const crispFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cam = camFor(focused);
    const EZ = Easing.bezier(0.3, 1.16, 0.35, 1); // springy §3.1
    Animated.parallel([
      Animated.timing(camTx, { toValue: cam.tx, duration: 850, easing: EZ, useNativeDriver: true }),
      Animated.timing(camTy, { toValue: cam.ty, duration: 850, easing: EZ, useNativeDriver: true }),
      Animated.timing(camS, { toValue: cam.s, duration: 850, easing: EZ, useNativeDriver: true }),
      Animated.timing(chromeV, { toValue: focused ? 0 : 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ...ALL_ZONES.map((z) => Animated.timing(openV[z], { toValue: isOpenZone(z) ? 1 : 0, duration: z === 'counter' ? 500 : 800, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true })),
      ...ALL_ZONES.map((z) => Animated.timing(dimV[z], { toValue: focused && focused !== z ? 0.12 : 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    ]).start();
    // crisp layer: fade in as the camera lands (blurry only in motion, never at rest);
    // on unfocus fade out fast, then drop the layer so the room shows through.
    if (focused) {
      setCrispZone(focused);
      Animated.timing(crispFade, { toValue: 1, delay: 520, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(crispFade, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setCrispZone(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, openZones]);

  const dip = (z: Zone, down: boolean) => Animated.timing(pressV[z], { toValue: down ? 0.985 : 1, duration: 150, useNativeDriver: true }).start();

  // ── a door / drawer unit ────────────────────────────────────────────────────
  const doorUnit = (zone: Zone, kind: 'french' | 'door' | 'drawer') => {
    const u = UNITS[zone];
    const open = openV[zone];
    const white = zone !== 'cupboard';
    const rTop = zone === 'freezer' ? 0 : 14;
    const rBot = zone === 'fridge' ? 0 : zone === 'cupboard' ? 12 : 14;
    const doorFade = open.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.5, kind === 'drawer' ? 0.25 : 0.08] });
    const handleCol = white ? 'rgba(58,48,38,0.4)' : 'rgba(247,242,234,0.28)';
    const swing = (w: number, hinge: 'left' | 'right', angle: string) => {
      const a = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', angle] });
      return [{ perspective: 1000 }, { translateX: hinge === 'left' ? -w / 2 : w / 2 }, { rotateY: a }, { translateX: hinge === 'left' ? w / 2 : -w / 2 }];
    };
    const drawerY = open.interpolate({ inputRange: [0, 1], outputRange: [0, u.h * 0.74] });
    const Face = white ? FaceWhite : FaceWood;
    // §3.5 use-soon glow when this zone holds anything past-fresh (room view only)
    const hasSoon = byZone(zone).some((it) => freshnessOf(it, now) !== 'fresh');

    return (
      <Animated.View key={zone} style={{ position: 'absolute', left: u.x, top: u.y, width: u.w, height: u.h, opacity: dimV[zone], transform: [{ scale: pressV[zone] }] }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: u.w, height: u.h, backgroundColor: '#0E0B08', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(247,242,234,0.1)' }} />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 6, top: -u.h * 0.35, width: u.w * 0.8, height: u.h * 0.8, borderRadius: u.w, backgroundColor: zone === 'freezer' ? 'rgba(120,180,220,0.14)' : 'rgba(255,106,61,0.16)', opacity: open }} />
        <Interior zone={zone} items={byZone(zone)} now={now} labelV={open} openV={open} isOpen={isOpenZone(zone)} recentlyAdded={recentlyAdded} tossing={tossing} onItemPress={onItemPress} />

        {/* doors */}
        {kind === 'french' ? (
          ([['left', 0], ['right', u.w / 2]] as Array<['left' | 'right', number]>).map(([hinge, left], i) => (
            <Animated.View key={i} style={{ position: 'absolute', left, top: 0, width: u.w / 2, height: u.h, opacity: doorFade, transform: swing(u.w / 2, hinge, hinge === 'left' ? '-112deg' : '112deg'), backfaceVisibility: 'hidden' }}>
              <Face w={u.w / 2} h={u.h} radius={rTop} />
              <View style={{ position: 'absolute', top: 30, bottom: 30, width: 4, borderRadius: 2, backgroundColor: handleCol, [hinge === 'left' ? 'right' : 'left']: 8 }} />
            </Animated.View>
          ))
        ) : kind === 'drawer' ? (
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: u.w, height: u.h, borderBottomLeftRadius: rBot, borderBottomRightRadius: rBot, overflow: 'hidden', opacity: doorFade, transform: [{ translateY: drawerY }] }}>
            <Face w={u.w} h={u.h} radius={0} />
            <View style={{ position: 'absolute', top: 9, left: u.w / 2 - 20, width: 40, height: 4, borderRadius: 2, backgroundColor: handleCol }} />
            <Text style={{ position: 'absolute', bottom: 8, alignSelf: 'center', color: '#5B7A8C', fontSize: 7, fontWeight: '700', letterSpacing: 1 }}>❄ FREEZER</Text>
          </Animated.View>
        ) : (
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: u.w, height: u.h, borderTopLeftRadius: rTop, borderTopRightRadius: rTop, overflow: 'hidden', opacity: doorFade, transform: swing(u.w, 'left', '-114deg'), backfaceVisibility: 'hidden' }}>
            <Face w={u.w} h={u.h} radius={0} />
            <View style={{ position: 'absolute', top: 24, bottom: 24, right: 8, width: 5, borderRadius: 3, backgroundColor: handleCol }} />
            {/* magnets */}
            <View style={{ position: 'absolute', top: 10, left: 9, gap: 5 }}>
              <Pressable onPress={onTonight} hitSlop={12} accessibilityRole="button" accessibilityLabel="Tonight you can make" style={{ transform: [{ rotate: '-2deg' }], backgroundColor: '#F3E9D8', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: 'rgba(58,48,38,0.25)' }}>
                <Serif italic size={9.5} color="#3A2E1E">Tonight you can make…</Serif>
              </Pressable>
              <Pressable onPress={onShopping} hitSlop={12} accessibilityRole="button" accessibilityLabel={shoppingCount > 0 ? `Shopping list, ${shoppingCount} items` : 'Shopping list'} style={{ transform: [{ rotate: '1.5deg' }], backgroundColor: '#E9EFE6', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: 'rgba(46,58,42,0.25)' }}>
                <Text style={{ color: '#2E3A2A', fontSize: 9, fontWeight: '700' }}>Shopping list</Text>
                {shoppingCount > 0 ? <View style={{ backgroundColor: c('accent'), borderRadius: 999, minWidth: 13, height: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: c('accentText'), fontSize: 8, fontWeight: '700' }}>{shoppingCount}</Text></View> : null}
              </Pressable>
              <StreakMagnet streak={streak} accent={c('accent')} text={c('accentText')} />
            </View>
          </Animated.View>
        )}

        {/* §3.5 use-soon glow — on top of the closed door so it reads at the unit's base */}
        {hasSoon ? <UseSoonGlow unitW={u.w} chromeV={chromeV} /> : null}

        {/* tap target (room view) */}
        {focused !== zone ? <Pressable onPress={() => onFocus(zone)} onPressIn={() => dip(zone, true)} onPressOut={() => dip(zone, false)} style={{ position: 'absolute', left: 0, top: 0, width: u.w, height: u.h }} /> : null}

        {/* count badge — subtle dark chip, tucked inside the corner (not a bright pill) */}
        <Animated.View style={{ position: 'absolute', top: 5, right: 5, opacity: chromeV, backgroundColor: 'rgba(14,11,8,0.7)', borderWidth: 1, borderColor: 'rgba(247,242,234,0.14)', borderRadius: 999, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }} pointerEvents="none">
          <Text style={{ color: '#CDBFA9', fontSize: 9.5, fontWeight: '700' }}>{byZone(zone).length}</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  // ── the counter (composed worktop; items live on top, no doors) ──────────────
  const counterUnit = () => {
    const u = UNITS.counter;
    const cItems = byZone('counter');
    const hasSoon = cItems.some((it) => freshnessOf(it, now) !== 'fresh');
    const fruits = cItems.filter((it) => it.token && kindOf(it.token) !== 'loaf').slice(0, 3);
    const loaf = cItems.find((it) => kindOf(it.token) === 'loaf');
    const FRUIT_SLOTS: Array<[number, number, number]> = [[24, 84, 15], [36, 81, 14], [30, 74, 13]];
    const JAR_COLS = ['#E8A13C', '#D96248', '#6FB77F', '#E9DEC9', '#C57A55'];
    const reveal = openV.counter;

    return (
      <Animated.View style={{ position: 'absolute', left: u.x, top: u.y, width: u.w, height: u.h, opacity: dimV.counter, transform: [{ scale: pressV.counter }] }}>
        {/* open shelf + jars */}
        <View style={{ position: 'absolute', left: 24, top: 6, width: 118, height: 26, borderRadius: 3 }}>
          <FaceWood w={118} h={26} radius={3} />
          <View style={{ position: 'absolute', bottom: 4, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {JAR_COLS.map((jc, i) => (
              <View key={i} style={{ width: 14, height: 15 + (i % 3) * 2, borderRadius: 3, backgroundColor: jc, overflow: 'hidden' }}>
                <View style={{ height: 3.5, backgroundColor: mix(jc, '#170D04', 0.6) }} />
              </View>
            ))}
          </View>
        </View>

        {/* lower cabinet */}
        <View style={{ position: 'absolute', left: 8, top: 112, width: 150, height: 106, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' }}>
          <FaceWood w={150} h={106} radius={0} />
          <View style={{ position: 'absolute', top: 34, left: 12, right: 12, height: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <View style={{ position: 'absolute', top: 70, left: 12, right: 12, height: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <View style={{ position: 'absolute', top: 14, alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,242,234,0.28)' }} />
          <View style={{ position: 'absolute', top: 50, alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(247,242,234,0.28)' }} />
        </View>

        {/* worktop slab */}
        <View style={{ position: 'absolute', left: 2, top: 102, width: 162, height: 10, borderRadius: 2, backgroundColor: '#3B3630', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 3 } }}>
          <Svg width={162} height={10} style={{ position: 'absolute' }}>
            <Defs><LinearGradient id="wtop" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#45403A" /><Stop offset="1" stopColor="#332F29" /></LinearGradient></Defs>
            <Rect x={0} y={0} width={162} height={10} rx={2} fill="url(#wtop)" />
          </Svg>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(247,242,234,0.14)' }} />
        </View>

        {/* decor: chopping board + potted plant */}
        <View style={{ position: 'absolute', left: 78, top: 70, width: 36, height: 32, borderRadius: 4, transform: [{ rotate: '4deg' }], overflow: 'hidden' }}>
          <FaceWood w={36} h={32} radius={4} />
        </View>
        <View style={{ position: 'absolute', left: 130, top: 72, alignItems: 'center' }}>
          <View style={{ width: 18, height: 16, borderRadius: 9, backgroundColor: '#5FB07D' }} />
          <View style={{ width: 13, height: 12, borderRadius: 3, backgroundColor: '#A85A38', marginTop: -2 }} />
        </View>

        {/* fruit bowl — dark rim reads as the opening */}
        <View style={{ position: 'absolute', left: 18, top: 90, width: 44, height: 15, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: '#A85A38' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.22)' }} />
        </View>

        {/* live items on the worktop */}
        {fruits.map((it, i) => {
          const [x, y, r] = FRUIT_SLOTS[i]!;
          const fresh = freshnessOf(it, now);
          return (
            <View key={it.id} style={{ position: 'absolute', left: x - r, top: y - r }}>
              <Pressable onPress={() => onItemPress(it)} hitSlop={6} style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: tileColor(it.token), opacity: it.level === 'low' ? 0.7 : 1, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }}>
                <View style={{ position: 'absolute', top: r * 0.3, left: r * 0.35, width: r * 0.5, height: r * 0.4, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.28)' }} />
              </Pressable>
              <Animated.View pointerEvents="none" style={{ position: 'absolute', right: -3, top: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: FRESH_COL[fresh], opacity: reveal, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1 } }} />
            </View>
          );
        })}
        {loaf ? (
          <View style={{ position: 'absolute', left: 54, top: 82 }}>
            <Pressable onPress={() => onItemPress(loaf)} hitSlop={6} style={{ width: 18, height: 18, borderRadius: 6, overflow: 'hidden', opacity: loaf.level === 'low' ? 0.7 : 1 }}>
              <GlyphTile kind="loaf" w={18} h={18} color={tileColor(loaf.token)} />
            </Pressable>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', right: -3, top: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: FRESH_COL[freshnessOf(loaf, now)], opacity: reveal, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1 } }} />
          </View>
        ) : null}

        {/* §3.5 use-soon glow — pooled low, on the dark cabinet (not a bar) */}
        {hasSoon ? <UseSoonGlow unitW={u.w} chromeV={chromeV} bottom={16} /> : null}

        {/* tap target (room view) — covers the whole counter incl. the jar shelf */}
        {focused !== 'counter' ? <Pressable onPress={() => onFocus('counter')} onPressIn={() => dip('counter', true)} onPressOut={() => dip('counter', false)} style={{ position: 'absolute', left: 0, top: 0, width: u.w, height: 218 }} /> : null}

        {/* count badge — subtle dark chip */}
        <Animated.View style={{ position: 'absolute', top: 54, right: 4, opacity: chromeV, backgroundColor: 'rgba(14,11,8,0.7)', borderWidth: 1, borderColor: 'rgba(247,242,234,0.14)', borderRadius: 999, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }} pointerEvents="none">
          <Text style={{ color: '#CDBFA9', fontSize: 9.5, fontWeight: '700' }}>{cItems.length}</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  return (
    <View style={{ width: contentW, height: boxH, borderRadius: 20, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: (contentW - DW) / 2, top: (boxH - DH) / 2, width: DW, height: DH, transform: [{ scale: sf }] }}>
        <Animated.View style={{ width: DW, height: DH, transform: [{ translateX: camTx }, { translateY: camTy }, { scale: camS }] }}>
          {/* wall + top light */}
          <Svg width={DW} height={FLOOR_Y} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#262019" /><Stop offset="1" stopColor="#211A13" /></LinearGradient>
              <RadialGradient id="toplight" cx="0.5" cy="0.06" rx="0.9" ry="0.7"><Stop offset="0" stopColor="#FFBE78" stopOpacity={0.06} /><Stop offset="0.6" stopColor="#FFBE78" stopOpacity={0} /></RadialGradient>
            </Defs>
            <Path d={`M0,14 A14,14 0 0 1 14,0 L${DW - 14},0 A14,14 0 0 1 ${DW},14 L${DW},${FLOOR_Y} L0,${FLOOR_Y} Z`} fill="url(#wall)" />
            <Rect x={0} y={0} width={DW} height={FLOOR_Y} fill="url(#toplight)" />
          </Svg>
          {/* floor + shadows + line */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: FLOOR_Y, bottom: 0, backgroundColor: '#191410', opacity: chromeV }} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: FLOOR_Y, height: 2, backgroundColor: 'rgba(247,242,234,0.1)', opacity: chromeV }} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 20, top: 400, width: 150, height: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', opacity: chromeV, transform: [{ scaleY: 0.5 }] }} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 200, top: 400, width: 140, height: 12, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', opacity: chromeV, transform: [{ scaleY: 0.5 }] }} />

          {counterUnit()}
          {doorUnit('cupboard', 'french')}
          {doorUnit('fridge', 'door')}
          {doorUnit('freezer', 'drawer')}
        </Animated.View>
      </View>

      {/* focused mode: tap anywhere outside the crisp unit to zoom back out */}
      {focused ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the room" onPress={() => onFocus(null)} style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: boxH }} />
      ) : null}

      {/* the crisp zoomed unit — full-resolution re-render over the camera's resting spot */}
      {crispZone ? (() => {
        const u = UNITS[crispZone];
        const z = sf * camFor(crispZone).s;
        const w = u.w * z;
        const h = u.h * z;
        return (
          <Animated.View pointerEvents={focused ? 'auto' : 'none'} style={{ position: 'absolute', left: (contentW - w) / 2, top: (boxH - h) / 2, opacity: crispFade }}>
            <FocusedUnit zone={crispZone} items={byZone(crispZone)} now={now} z={z} w={w} h={h} onItemPress={onItemPress} />
          </Animated.View>
        );
      })() : null}
    </View>
  );
}

/** §3.8 streak magnet that counts 0 → final on mount. Value is elapsed-derived so a
 * remount restarts cleanly and always lands on the final (never sticks mid-count). */
function StreakMagnet({ streak, accent, text }: { streak: number; accent: string; text: string }) {
  const t0 = useRef(Date.now()).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Math.min(streak, Math.round((Date.now() - t0) / 55) * 2);
      setShown(n);
      if (n < streak) timer = setTimeout(tick, 50);
    };
    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);
  return (
    <View style={{ transform: [{ rotate: '-1deg' }], backgroundColor: accent, borderRadius: 999, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: text, fontSize: 9, fontWeight: '800' }}>{shown}</Text>
    </View>
  );
}
