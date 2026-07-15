import type { ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../theme';

export function Screen({
  title,
  subtitle,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c('bg') }}>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 24, gap: 8 }}>
        {title ? (
          <Text style={{ color: c('textPrimary'), fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
        ) : null}
        {subtitle ? (
          <Text style={{ color: c('textSecondary'), fontSize: 15, lineHeight: 21, marginBottom: 12 }}>{subtitle}</Text>
        ) : null}
        <View style={{ gap: 12, marginTop: 4 }}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={{ padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: c('border'), backgroundColor: c('bg') }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        backgroundColor: disabled ? c('surfaceSunken') : c('accent'),
        paddingVertical: 16,
        borderRadius: radius.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: disabled ? c('textMuted') : c('accentText'), fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? c('accentSubtle') : c('surface'),
        borderColor: selected ? c('accent') : c('border'),
        borderWidth: selected ? 2 : 1,
        borderRadius: radius.md,
        padding: 16,
      }}
    >
      <Text style={{ color: selected ? c('accentSubtleText') : c('textPrimary'), fontSize: 16, fontWeight: '600' }}>{label}</Text>
      {sublabel ? <Text style={{ color: c('textMuted'), fontSize: 13, marginTop: 2 }}>{sublabel}</Text> : null}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? c('accent') : c('surface'),
        borderColor: selected ? c('accent') : c('border'),
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 15,
      }}
    >
      <Text style={{ color: selected ? c('accentText') : c('textSecondary'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c('textMuted'), fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: radius.md, paddingHorizontal: 14 }}>
        <TextInput
          keyboardType="numeric"
          value={String(value)}
          onChangeText={(t) => onChange(Number(t.replace(/[^0-9.]/g, '')) || 0)}
          style={{ flex: 1, color: c('textPrimary'), fontSize: 18, fontWeight: '600', paddingVertical: 14 }}
        />
        {suffix ? <Text style={{ color: c('textMuted'), fontSize: 14 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function ProgressDots({ count, index }: { count: number; index: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 999, backgroundColor: i <= index ? c('accent') : c('ringTrack') }}
        />
      ))}
    </View>
  );
}
