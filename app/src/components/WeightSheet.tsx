import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import { Sheet, Serif, PrimaryButton, TextLink, OutlineButton } from './kit';
import { haptics } from '../haptics';

const num = { fontVariant: ['tabular-nums' as const] };

/** Round 52px stepper button (same primitive as the portion editor). */
function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label === '−' ? 'Down 0.1 kg' : 'Up 0.1 kg'} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', backgroundColor: c('surfaceSunken'), opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c('textPrimary'), fontSize: 24, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Log a weigh-in, fast (the MacroFactor lesson): the number is prefilled from
 * your last entry, editable directly, nudgeable ±0.1, and an optional progress
 * photo rides along. Today only — the scale moment is a now moment.
 */
export function WeightSheet({ visible, initialKg, onSave, onClose }: {
  visible: boolean;
  initialKg: number;
  onSave: (kg: number, photoUri?: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState(initialKg.toFixed(1));
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setText(initialKg.toFixed(1)); setPhoto(null); }
  }, [visible, initialKg]);

  const kg = parseFloat(text.replace(',', '.'));
  const valid = Number.isFinite(kg) && kg >= 20 && kg <= 400;
  const nudge = (d: number) => {
    const base = Number.isFinite(kg) ? kg : initialKg;
    setText(Math.min(400, Math.max(20, Math.round((base + d) * 10) / 10)).toFixed(1));
    haptics.tap();
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Log weight</Serif>
        <TextLink label="Cancel" onPress={onClose} tone="neutral" />
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 22 }}>Today's weigh-in — same time each day reads truest.</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 20 }}>
        <StepButton label="−" onPress={() => nudge(-0.1)} />
        <View style={{ alignItems: 'center', width: 152 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel="Weight in kilograms"
              // fixed width — a web TextInput's intrinsic size otherwise blows the
              // row out and shoves the ± steppers off-screen.
              style={[{ color: c('textPrimary'), fontSize: 44, fontWeight: '800', letterSpacing: -1, width: 124, textAlign: 'center', padding: 0 }, num]}
            />
            <Text style={{ color: c('textMuted'), fontSize: 16, marginLeft: 2 }}>kg</Text>
          </View>
          {!valid ? <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 4, textAlign: 'center' }}>Enter a weight between 20 and 400 kg</Text> : null}
        </View>
        <StepButton label="＋" onPress={() => nudge(0.1)} />
      </View>

      {photo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, backgroundColor: c('surfaceSunken'), borderRadius: 16, padding: 10 }}>
          <Image source={{ uri: photo }} style={{ width: 56, height: 56, borderRadius: 12 }} />
          <Text style={{ color: c('textSecondary'), fontSize: 13.5, flex: 1 }}>Progress photo attached</Text>
          <TextLink label="Remove" onPress={() => setPhoto(null)} tone="neutral" />
        </View>
      ) : (
        <View style={{ marginBottom: 20 }}>
          <OutlineButton label="＋ Add a progress photo" full onPress={pickPhoto} />
        </View>
      )}

      <PrimaryButton label={valid ? `Save ${kg.toFixed(1)} kg` : 'Save'} full disabled={!valid} onPress={() => { if (valid) onSave(Math.round(kg * 10) / 10, photo ?? undefined); }} />
    </Sheet>
  );
}
