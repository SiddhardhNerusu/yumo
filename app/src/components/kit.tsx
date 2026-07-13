import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing, type ViewStyle, type TextStyle, type StyleProp } from 'react-native';
import { useTheme, fonts } from '../theme';
import { haptics } from '../haptics';

/** Precomputed alpha borders (RN has no color-mix). Dark-first. */
export const ACCENT_BORDER = 'rgba(255,106,61,0.55)';
export const LOGGED_BORDER = 'rgba(95,196,140,0.25)';
const GRABBER = 'rgba(247,242,234,0.28)';
export const HAIRLINE_TOP = 'rgba(247,242,234,0.14)'; // directional top highlight — light reads from above

const num = { fontVariant: ['tabular-nums' as const] };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Springy press feedback — snaps down fast, releases with a little bounce.
 * The difference between an instant style-swap and this is most of "premium touch". */
function usePress(to = 0.96) {
  const s = useRef(new Animated.Value(1)).current;
  const onPressIn = () => { haptics.tap(); Animated.spring(s, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start(); };
  const onPressOut = () => Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 38, bounciness: 7 }).start();
  return { scale: s, onPressIn, onPressOut };
}

// ── Serif text ──────────────────────────────────────────────────────────────
export function Serif({ children, size, weight = 'regular', italic, color, style }: { children: ReactNode; size: number; weight?: 'regular' | 'medium'; italic?: boolean; color?: string; style?: StyleProp<TextStyle> }) {
  const family = italic ? fonts.serifItalic : weight === 'medium' ? fonts.serifMedium : fonts.serif;
  // sensible display leading by default; callers can still override via `style`.
  return <Text style={[{ fontFamily: family, fontSize: size, lineHeight: Math.round(size * 1.15), color, includeFontPadding: false }, style]}>{children}</Text>;
}

// ── Buttons (the §2.4 vocabulary) ────────────────────────────────────────────
export function PrimaryButton({ label, onPress, flex, disabled }: { label: string; onPress?: () => void; flex?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  const p = usePress();
  return (
    <AnimatedPressable onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} disabled={disabled} style={{ flex: flex ? 1 : undefined, backgroundColor: c('accent'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center', opacity: disabled ? 0.5 : 1, transform: [{ scale: p.scale }] }}>
      <Text style={{ color: c('accentText'), fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </AnimatedPressable>
  );
}

export function MixButton({ label = 'Mix it up', onPress }: { label?: string; onPress?: () => void }) {
  const { c } = useTheme();
  const p = usePress();
  return (
    <AnimatedPressable onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} style={{ backgroundColor: c('mixSurface'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ scale: p.scale }] }}>
      <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '700' }}>⇄</Text>
      <Text style={{ color: c('accentSoft'), fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </AnimatedPressable>
  );
}

export function OutlineButton({ label, onPress, flex, full }: { label: string; onPress?: () => void; flex?: boolean; full?: boolean }) {
  const { c } = useTheme();
  const p = usePress();
  return (
    <AnimatedPressable onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} style={{ flex: flex ? 1 : undefined, alignSelf: full ? 'stretch' : undefined, borderWidth: 1, borderColor: c('borderStrong'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', transform: [{ scale: p.scale }] }}>
      <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </AnimatedPressable>
  );
}

export function TextLink({ label, onPress, tone = 'positive' }: { label: string; onPress?: () => void; tone?: 'positive' | 'neutral' }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ color: tone === 'positive' ? c('accentSoft') : c('textMuted'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Selectable pill chip (§2.4 item 5). */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const p = usePress(0.94);
  return (
    <AnimatedPressable onPress={onPress} onPressIn={p.onPressIn} onPressOut={p.onPressOut} style={{ backgroundColor: selected ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: selected ? c('accent') : 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, transform: [{ scale: p.scale }] }}>
      <Text style={{ color: selected ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </AnimatedPressable>
  );
}

// ── Card (§2 shape) ──────────────────────────────────────────────────────────
export function Card({ children, current, logged, style }: { children: ReactNode; current?: boolean; logged?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const borderColor = current ? ACCENT_BORDER : logged ? LOGGED_BORDER : c('border');
  const plain = !current && !logged;
  return (
    <View style={[{ backgroundColor: c('surface'), borderRadius: 20, borderWidth: current ? 1.5 : 1, borderColor, ...(plain ? { borderTopColor: HAIRLINE_TOP } : {}), padding: 18, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 }, style]}>
      {children}
    </View>
  );
}

// ── Loading skeleton (shimmer) — premium apps never show a bare spinner ───────
export function Skeleton({ width, height, radius = 12, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const op = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: c('surfaceSunken'), opacity: op }, style]} />;
}

// ── Section kicker (UPPERCASE label) ─────────────────────────────────────────
export function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  const { c } = useTheme();
  return <Text style={{ color: color ?? c('textMuted'), fontSize: 12, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' }}>{children}</Text>;
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────
export function Sheet({ visible, onClose, children, maxHeight = '88%' }: { visible: boolean; onClose: () => void; children: ReactNode; maxHeight?: number | `${number}%` }) {
  const { c } = useTheme();
  const t = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  useEffect(() => {
    if (visible) {
      t.setValue(0);
      Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }).start();
    }
  }, [visible, t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  const backdrop = t.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', opacity: backdrop }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY }] }}>
          <View style={{ backgroundColor: c('sheet'), borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderTopColor: HAIRLINE_TOP, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, maxHeight, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: -12 } }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: GRABBER, marginBottom: 16 }} />
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export { num as tabularNums };
