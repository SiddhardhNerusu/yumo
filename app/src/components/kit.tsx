import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing, type ViewStyle, type TextStyle, type StyleProp } from 'react-native';
import { useTheme, fonts } from '../theme';

/** Precomputed alpha borders (RN has no color-mix). Dark-first. */
export const ACCENT_BORDER = 'rgba(255,106,61,0.55)';
export const LOGGED_BORDER = 'rgba(95,196,140,0.25)';
const GRABBER = 'rgba(247,242,234,0.15)';

const num = { fontVariant: ['tabular-nums' as const] };

// ── Serif text ──────────────────────────────────────────────────────────────
export function Serif({ children, size, weight = 'regular', italic, color, style }: { children: ReactNode; size: number; weight?: 'regular' | 'medium'; italic?: boolean; color?: string; style?: StyleProp<TextStyle> }) {
  const family = italic ? fonts.serifItalic : weight === 'medium' ? fonts.serifMedium : fonts.serif;
  return <Text style={[{ fontFamily: family, fontSize: size, color, includeFontPadding: false }, style]}>{children}</Text>;
}

// ── Buttons (the §2.4 vocabulary) ────────────────────────────────────────────
export function PrimaryButton({ label, onPress, flex, disabled }: { label: string; onPress?: () => void; flex?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ flex: flex ? 1 : undefined, backgroundColor: c('accent'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center', opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ color: c('accentText'), fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function MixButton({ label = 'Mix it up', onPress }: { label?: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: c('mixSurface'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ color: c('accentSoft'), fontSize: 13, fontWeight: '700' }}>⇄</Text>
      <Text style={{ color: c('accentSoft'), fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, flex, full }: { label: string; onPress?: () => void; flex?: boolean; full?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: flex ? 1 : undefined, alignSelf: full ? 'stretch' : undefined, borderWidth: 1, borderColor: c('borderStrong'), borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ color: c('textSecondary'), fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress, tone = 'positive' }: { label: string; onPress?: () => void; tone?: 'positive' | 'neutral' }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={{ color: tone === 'positive' ? c('accentSoft') : c('textMuted'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Selectable pill chip (§2.4 item 5). */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: selected ? c('accent') : c('surfaceSunken'), borderWidth: 1, borderColor: selected ? c('accent') : 'rgba(247,242,234,0.09)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ color: selected ? c('accentText') : c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

// ── Card (§2 shape) ──────────────────────────────────────────────────────────
export function Card({ children, current, logged, style }: { children: ReactNode; current?: boolean; logged?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const borderColor = current ? ACCENT_BORDER : logged ? LOGGED_BORDER : c('border');
  return <View style={[{ backgroundColor: c('surface'), borderRadius: 20, borderWidth: current ? 1.5 : 1, borderColor, padding: 18 }, style]}>{children}</View>;
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
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdrop }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{ transform: [{ translateY }] }}>
          <View style={{ backgroundColor: c('sheet'), borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, maxHeight, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: -12 } }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: GRABBER, marginBottom: 16 }} />
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export { num as tabularNums };
