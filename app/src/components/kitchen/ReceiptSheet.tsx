import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { parseReceipt, type ReceiptParse } from '@yumo/shared';
import { useTheme } from '../../theme';
import { Sheet, Serif, TextLink, PrimaryButton, withAlpha } from '../kit';
import { buildFoodVocab } from '../../data/foodVocab';
import { defaultZone } from '../../data/shelf-life';
import { ZONE_LABEL, type KitchenItem, type Zone } from '../../data/kitchen-model';

const num = { fontVariant: ['tabular-nums' as const] };

export interface ReceiptEntry {
  token: string;
  label: string;
  zone: Zone;
  price?: number;
}

/**
 * §5 receipt add — paste (or, on a device build, OCR) a receipt; the shared
 * parser picks out the FOODS (non-food lines like "TOTAL"/"VISA"/bin bags are
 * dropped), auto-routes each to a zone (yoghurt→fridge, rice→cupboard…), and
 * flags any best-guess "variant" matches for opt-in. You confirm, we restock.
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
  onConfirm: (entries: ReceiptEntry[]) => void;
  onManual: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ReceiptParse | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const reset = () => { setText(''); setParsed(null); setExcluded(new Set()); };
  const close = () => { reset(); onClose(); };

  const read = () => {
    const lines = text.split(/\r?\n/).map((t) => ({ text: t }));
    const res = parseReceipt(lines, buildFoodVocab(items));
    setParsed(res);
    // best-guess "variant" matches (a qualifier the line never said) start unticked
    setExcluded(new Set(res.matches.filter((m) => m.variant).map((m) => m.token)));
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
    if (entries.length) onConfirm(entries);
    close();
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Scan a receipt</Serif>
        <TextLink label="Cancel" onPress={close} tone="neutral" />
      </View>

      {parsed === null ? (
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
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <TextLink label="Add one item manually" onPress={() => { reset(); onManual(); }} tone="neutral" />
          </View>
        </>
      ) : rows.length === 0 ? (
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
      )}
    </Sheet>
  );
}
