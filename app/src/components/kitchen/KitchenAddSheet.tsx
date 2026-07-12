import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet, Serif, TextLink } from '../kit';
import { Glyph } from './Glyph';
import { SINGLE_FOODS } from '../../data/foods-seed';
import { PANTRY_STAPLES } from '../../data/onboarding-seed';
import { ZONE_LABEL, type Zone } from '../../data/kitchen-model';

// Suggestion pool: single foods + staples, deduped by name.
const SUGGESTIONS = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of SINGLE_FOODS) { const k = f.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(f.name); } }
  for (const p of PANTRY_STAPLES) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
})();

/** §5 manual add — quick chip grid + free text, into the tapped zone. */
export function KitchenAddSheet({ zone, onClose, onAdd }: { zone: Zone | null; onClose: () => void; onAdd: (name: string, zone: Zone) => void }) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return SUGGESTIONS.filter((s) => !ql || s.toLowerCase().includes(ql)).slice(0, 24);
  }, [q]);
  const exact = matches.some((m) => m.toLowerCase() === q.trim().toLowerCase());

  const add = (name: string) => { if (zone) onAdd(name, zone); setQ(''); };

  return (
    <Sheet visible={zone !== null} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Add to {zone ? ZONE_LABEL[zone] : ''}</Serif>
        <TextLink label="Done" onPress={onClose} tone="neutral" />
      </View>

      <TextInput
        placeholder="What did you add?"
        placeholderTextColor={c('textMuted')}
        value={q}
        onChangeText={setQ}
        style={{ backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 15, marginBottom: 12 }}
      />

      <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {q.trim().length > 0 && !exact ? (
            <Pressable onPress={() => add(q.trim())} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c('accent'), borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}>
              <Text style={{ color: c('accentText'), fontSize: 13, fontWeight: '700' }}>＋ Add "{q.trim()}"</Text>
            </Pressable>
          ) : null}
          {matches.map((name) => (
            <Pressable key={name} onPress={() => add(name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: c('chipSurface'), borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: c('border') }}>
              <Glyph token={name} size={18} body={c('textSecondary')} accent={c('accent')} mono={c('textMuted')} />
              <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
