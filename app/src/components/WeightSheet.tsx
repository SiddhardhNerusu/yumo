import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import { Sheet, Serif, PrimaryButton, TextLink, OutlineButton } from './kit';
import { haptics } from '../haptics';
import { useWeightUnit } from '../data/weightUnit';
import { editUnitFor, kgToEditValue, displayToKg, kgToDisplay, weightParts, roundStorageKg } from '@yumo/shared';

const num = { fontVariant: ['tabular-nums' as const] };

/** Round 52px stepper button (same primitive as the portion editor). a11yLabel
 * is passed in — it must track the unit + step, not be derived from the glyph. */
function StepButton({ label, onPress, a11yLabel }: { label: string; onPress: () => void; a11yLabel: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={a11yLabel} style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c('borderStrong'), alignItems: 'center', justifyContent: 'center', backgroundColor: c('surfaceSunken'), opacity: pressed ? 0.6 : 1 })}>
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
  const { unit } = useWeightUnit();
  // Weights are edited in the display unit (st edits at lb granularity); storage
  // stays kg. `text` holds the number in the edit unit (kg or lb).
  const edit = editUnitFor(unit);
  const unitLabel = edit === 'kg' ? 'kg' : 'lb';
  const step = edit === 'kg' ? 0.1 : 0.2;
  const editMin = kgToEditValue(20, unit);
  const editMax = kgToEditValue(400, unit);
  const [text, setText] = useState(kgToEditValue(initialKg, unit).toFixed(1));
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    // reseed when opened, when the seed changes, or when the unit flips while open
    if (visible) { setText(kgToEditValue(initialKg, unit).toFixed(1)); setPhoto(null); }
  }, [visible, initialKg, unit]);

  const editVal = parseFloat(text.replace(',', '.'));
  const kg = Number.isFinite(editVal) ? displayToKg(editVal, unit) : NaN;
  const valid = Number.isFinite(kg) && kg >= 20 && kg <= 400;
  const nudge = (dir: 1 | -1) => {
    const base = Number.isFinite(editVal) ? editVal : kgToEditValue(initialKg, unit);
    setText(Math.min(editMax, Math.max(editMin, Math.round((base + dir * step) * 10) / 10)).toFixed(1));
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
        <StepButton label="−" a11yLabel={`Down ${step} ${unitLabel}`} onPress={() => nudge(-1)} />
        <View style={{ alignItems: 'center', width: 152 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={`Weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`}
              // fixed width — a web TextInput's intrinsic size otherwise blows the
              // row out and shoves the ± steppers off-screen.
              style={[{ color: c('textPrimary'), fontSize: 44, fontWeight: '800', letterSpacing: -1, width: 124, textAlign: 'center', padding: 0 }, num]}
            />
            <Text style={{ color: c('textMuted'), fontSize: 16, marginLeft: 2 }}>{unitLabel}</Text>
          </View>
          {unit === 'st' && valid ? (
            <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginTop: 4, textAlign: 'center' }, num]}>= {weightParts(kg, 'st').value} lb</Text>
          ) : null}
          {!valid ? <Text style={{ color: c('textMuted'), fontSize: 12, marginTop: 4, textAlign: 'center' }}>Enter a weight between {kgToDisplay(20, unit)} and {kgToDisplay(400, unit)}</Text> : null}
        </View>
        <StepButton label="＋" a11yLabel={`Up ${step} ${unitLabel}`} onPress={() => nudge(1)} />
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

      <PrimaryButton label={valid ? `Save ${kgToDisplay(kg, unit)}` : 'Save'} full disabled={!valid} onPress={() => { if (valid) onSave(roundStorageKg(kg), photo ?? undefined); }} />
    </Sheet>
  );
}
