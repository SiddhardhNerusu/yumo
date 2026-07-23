import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseReceipt, type ReceiptParse, type ReceiptLine } from '@yumo/shared';
import { useTheme } from '../../theme';
import { Sheet, Serif, TextLink, PrimaryButton, withAlpha } from '../kit';
import { buildFoodVocab } from '../../data/foodVocab';
import { defaultZone } from '../../data/shelf-life';
import { ocrReceipt, ocrAvailable } from '../../data/receiptOcr';
import { ZONE_LABEL, type KitchenItem, type Zone } from '../../data/kitchen-model';
import { ReceiptCamera } from './ReceiptCamera';

const num = { fontVariant: ['tabular-nums' as const] };

export interface ReceiptEntry {
  token: string;
  label: string;
  zone: Zone;
  price?: number;
}
export type ReceiptSource = 'camera' | 'library' | 'paste';

/**
 * §5 receipt add — photograph or pick a receipt (on device) or paste its text;
 * the shared parser picks out the FOODS (non-food lines like "TOTAL"/"VISA"/bin
 * bags are dropped), auto-routes each to a zone (yoghurt→fridge, rice→cupboard…),
 * and flags best-guess "variant" matches for opt-in. You confirm, we restock.
 * On web / Expo Go (no OCR) it opens straight to the paste path.
 */
export function ReceiptSheet({
  visible,
  items,
  onClose,
  onConfirm,
  onManual,
}: {
  visible: boolean;
  items: KitchenItem[];
  onClose: () => void;
  onConfirm: (entries: ReceiptEntry[], source: ReceiptSource) => void;
  onManual: () => void;
}) {
  const { c } = useTheme();
  const initialMode = ocrAvailable ? 'capture' : 'paste';
  const [mode, setMode] = useState<'capture' | 'reading' | 'paste'>(initialMode);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ReceiptParse | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<ReceiptSource>('paste');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const reset = () => { setText(''); setParsed(null); setExcluded(new Set()); setReadError(null); setMode(initialMode); };
  const close = () => { reset(); onClose(); };

  // the shared core both paste and OCR feed into
  const applyLines = (lines: ReceiptLine[], src: ReceiptSource) => {
    const res = parseReceipt(lines, buildFoodVocab(items));
    setSource(src);
    setParsed(res);
    setExcluded(new Set(res.matches.filter((m) => m.variant).map((m) => m.token))); // variant guesses start unticked
    setMode('paste'); // any non-capture surface is fine once parsed drives the view
  };

  const read = () => applyLines(text.split(/\r?\n/).map((t) => ({ text: t })), 'paste');

  const runOcr = async (uri: string, src: ReceiptSource) => {
    setMode('reading');
    setReadError(null);
    try {
      const lines = await ocrReceipt(uri);
      if (lines.length === 0) { setReadError('Couldn’t read that one — try a brighter, flatter shot.'); setMode('capture'); return; }
      applyLines(lines, src);
    } catch {
      setReadError('Couldn’t read that one — try again, or type it in.');
      setMode('capture');
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: false });
    if (!res.canceled && res.assets[0]?.uri) runOcr(res.assets[0].uri, 'library');
  };

  const rows = useMemo(
    () => (parsed?.matches ?? []).map((m) => ({ ...m, zone: defaultZone(m.token) })),
    [parsed],
  );
  const includedCount = rows.filter((r) => !excluded.has(r.token)).length;
  const toggle = (token: string) => setExcluded((prev) => { const n = new Set(prev); n.has(token) ? n.delete(token) : n.add(token); return n; });

  const confirm = () => {
    const entries: ReceiptEntry[] = rows
      .filter((r) => !excluded.has(r.token))
      .map((r) => ({ token: r.token, label: r.label, zone: r.zone, ...(r.price != null ? { price: r.price } : {}) }));
    if (entries.length) onConfirm(entries, source);
    close();
  };

  return (
    <>
      <Sheet visible={visible} onClose={close}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Serif size={24} weight="medium" color={c('textPrimary')}>Scan a receipt</Serif>
          <TextLink label="Cancel" onPress={close} tone="neutral" />
        </View>

        {parsed !== null ? (
          rows.length === 0 ? (
            <>
              <Text style={{ color: c('textSecondary'), fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                We couldn’t pick out any foods from that. Check it’s one item per line, or add items manually.
              </Text>
              <PrimaryButton label="Try again" onPress={reset} full />
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <TextLink label="Add manually" onPress={() => { reset(); onManual(); }} tone="neutral" />
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: c('textMuted'), fontSize: 12.5, marginBottom: 10 }}>
                {includedCount} food{includedCount === 1 ? '' : 's'} found{parsed.unmatched.length ? ` · ${parsed.unmatched.length} line${parsed.unmatched.length === 1 ? '' : 's'} skipped` : ''}. Tap to include or drop.
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {rows.map((r, i) => {
                  const on = !excluded.has(r.token);
                  return (
                    <Pressable
                      key={r.token + i}
                      onPress={() => toggle(r.token)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c('divider') }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: on ? c('accent') : c('border'), backgroundColor: on ? c('accent') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Text style={{ color: c('accentText'), fontSize: 12, fontWeight: '800' }}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ color: on ? c('textPrimary') : c('textMuted'), fontSize: 14.5, fontWeight: '600' }}>
                          {r.label}{r.variant ? <Text style={{ color: c('textMuted'), fontWeight: '400' }}>  ≈ guess</Text> : null}
                        </Text>
                      </View>
                      {r.price != null ? <Text style={[{ color: c('textMuted'), fontSize: 12.5, marginRight: 8 }, num]}>£{r.price.toFixed(2)}</Text> : null}
                      <View style={{ backgroundColor: withAlpha(c('accent'), 0.13), borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
                        <Text style={{ color: c('accentSoft'), fontSize: 11, fontWeight: '700' }}>{ZONE_LABEL[r.zone]}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ marginTop: 14 }}>
                <PrimaryButton label={includedCount ? `Add ${includedCount} to kitchen` : 'Nothing selected'} onPress={confirm} full disabled={includedCount === 0} />
              </View>
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <TextLink label="Start over" onPress={reset} tone="neutral" />
              </View>
            </>
          )
        ) : mode === 'reading' ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 14 }}>
            <ActivityIndicator color={c('accent')} />
            <Text style={{ color: c('textMuted'), fontSize: 13.5 }}>Reading your receipt…</Text>
          </View>
        ) : mode === 'capture' ? (
          <>
            <Text style={{ color: c('textMuted'), fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
              Snap or pick a photo of your receipt — we’ll pull out the foods, skip the rest, and sort each into the right place.
            </Text>
            {readError ? <Text style={{ color: c('warning'), fontSize: 13, marginBottom: 12 }}>{readError}</Text> : null}
            <PrimaryButton label="📷  Photograph receipt" onPress={() => setCameraOpen(true)} full />
            <View style={{ height: 10 }} />
            <Pressable onPress={pickPhoto} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: c('border'), borderRadius: 999, paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c('textSecondary'), fontSize: 14, fontWeight: '600' }}>🖼  Choose a photo</Text>
            </Pressable>
            <View style={{ alignItems: 'center', marginTop: 16, gap: 10 }}>
              <TextLink label="Type it in instead" onPress={() => setMode('paste')} tone="neutral" />
              <TextLink label="Add one item manually" onPress={() => { reset(); onManual(); }} tone="neutral" />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: c('textMuted'), fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              Paste your receipt (one item per line). We’ll pick out the foods, skip the rest, and sort each into the right place.
            </Text>
            <TextInput
              placeholder={'2 Bananas 0.84\nGreek yogurt 1.35\nChicken breast 3.20\nKitchen roll 2.00'}
              placeholderTextColor={c('textMuted')}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              style={{ backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 15, minHeight: 150, marginBottom: 14 }}
            />
            <PrimaryButton label="Read receipt" onPress={read} full disabled={text.trim().length === 0} />
            <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
              {ocrAvailable ? <TextLink label="‹ Use the camera" onPress={() => { setText(''); setMode('capture'); }} tone="neutral" /> : null}
              <TextLink label="Add one item manually" onPress={() => { reset(); onManual(); }} tone="neutral" />
            </View>
          </>
        )}
      </Sheet>

      <ReceiptCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(uri) => { setCameraOpen(false); runOcr(uri, 'camera'); }}
      />
    </>
  );
}
