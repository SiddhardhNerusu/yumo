import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Sheet, Serif, Kicker, PrimaryButton, OutlineButton, TextLink } from '../kit';
import { parseAddUtterance, resolveFood, type FoodVocabEntry, type AddLevel } from '@yumo/shared';

export interface VoiceAddItem { token: string; label: string; level: AddLevel }
interface Draft extends VoiceAddItem { id: string; canonical: boolean }

const LEVELS: AddLevel[] = ['plenty', 'some', 'low'];
const nextLevel = (l: AddLevel): AddLevel => LEVELS[(LEVELS.indexOf(l) + 1) % LEVELS.length]!;
const LEVEL_LABEL: Record<AddLevel, string> = { plenty: 'Plenty', some: 'Some', low: 'Low' };

// Web Speech API (Expo web); undefined on native → the text field is the path there.
const SpeechRec: any = typeof globalThis !== 'undefined' ? (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition : undefined;

function MicGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={9} y={2} width={6} height={12} rx={3} fill={color} />
      <Path d="M6 11a6 6 0 0 0 12 0" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M12 17v4M9 21h6" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** §5.5 voice/text "add" — speak or type "chicken, rice and a bag of spinach",
 * confirm the chips (never a silent write), then they fly into the kitchen. */
export function KitchenVoiceSheet({ visible, vocab, onClose, onAdd }: {
  visible: boolean;
  vocab: FoodVocabEntry[];
  onClose: () => void;
  onAdd: (items: VoiceAddItem[]) => void;
}) {
  const { c } = useTheme();
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const [draft, setDraft] = useState<Draft[]>([]);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const heardRef = useRef('');

  useEffect(() => {
    if (!visible) { setHeard(''); setTyped(''); setDraft([]); setListening(false); recRef.current?.abort?.(); }
  }, [visible]);

  const ingest = (text: string) => {
    if (!text.trim()) return;
    const items = parseAddUtterance(text).map((it, i) => {
      const r = resolveFood(it.phrase, vocab);
      return { id: `d${i}-${r.token}`, token: r.token, label: r.label, level: it.level, canonical: r.canonical };
    });
    setDraft(items);
  };

  const listen = () => {
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    heardRef.current = '';
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      heardRef.current = t;
      setHeard(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); ingest(heardRef.current); };
    recRef.current = rec;
    setDraft([]);
    setHeard('');
    setListening(true);
    rec.start();
  };
  const stop = () => { recRef.current?.stop?.(); setListening(false); };

  const removeDraft = (id: string) => setDraft((d) => d.filter((x) => x.id !== id));
  const cycleLevel = (id: string) => setDraft((d) => d.map((x) => (x.id === id ? { ...x, level: nextLevel(x.level) } : x)));
  const confirm = () => { if (draft.length) { onAdd(draft.map(({ token, label, level }) => ({ token, label, level }))); onClose(); } };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Serif size={24} weight="medium" color={c('textPrimary')}>Add by voice</Serif>
        <TextLink label="Close" onPress={onClose} tone="neutral" />
      </View>
      <Text style={{ color: c('textMuted'), fontSize: 13, marginBottom: 16 }}>Say or type what you got — “chicken, rice and a bag of spinach”. You confirm before anything's added.</Text>

      {SpeechRec ? (
        <Pressable
          onPress={listening ? stop : listen}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Start voice add'}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, alignSelf: 'center', backgroundColor: listening ? c('accent') : c('accentFaint'), borderWidth: 1, borderColor: listening ? 'transparent' : c('border'), borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22, marginBottom: 14 }}
        >
          <MicGlyph color={listening ? c('accentText') : c('accentSoft')} />
          <Text style={{ color: listening ? c('accentText') : c('accentSoft'), fontSize: 15, fontWeight: '700' }}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
        </Pressable>
      ) : null}

      {heard ? <Text style={{ color: c('textSecondary'), fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginBottom: 12 }}>“{heard}”</Text> : null}

      {/* text fallback — the only path on native, always available as a backup */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => ingest(typed)}
          placeholder={SpeechRec ? 'or type it…' : 'e.g. chicken, rice and spinach'}
          placeholderTextColor={c('textMuted')}
          accessibilityLabel="Type items to add"
          style={{ flex: 1, backgroundColor: c('surfaceSunken'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: c('textPrimary'), fontSize: 15 }}
        />
        <OutlineButton label="Read" onPress={() => ingest(typed)} />
      </View>

      {draft.length > 0 ? (
        <>
          <Kicker>Adding these — tap a level to change, ✕ to drop</Kicker>
          <View style={{ gap: 8, marginTop: 10, marginBottom: 16 }}>
            {draft.map((d) => (
              <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c('surfaceSunken'), borderRadius: 12, borderWidth: 1, borderColor: c('border'), paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text style={{ color: c('textPrimary'), fontSize: 15, flex: 1 }} numberOfLines={1}>
                  {d.label}{!d.canonical ? <Text style={{ color: c('textMuted'), fontSize: 12 }}>  · new</Text> : null}
                </Text>
                <Pressable onPress={() => cycleLevel(d.id)} accessibilityRole="button" accessibilityLabel={`${d.label} level ${LEVEL_LABEL[d.level]}, tap to change`} style={{ backgroundColor: c('chipSurface'), borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
                  <Text style={{ color: c('textSecondary'), fontSize: 13, fontWeight: '600' }}>{LEVEL_LABEL[d.level]}</Text>
                </Pressable>
                <Pressable onPress={() => removeDraft(d.id)} accessibilityRole="button" accessibilityLabel={`Remove ${d.label}`} hitSlop={8}>
                  <Text style={{ color: c('textMuted'), fontSize: 16, fontWeight: '700' }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <PrimaryButton label={`Add ${draft.length} to kitchen`} full onPress={confirm} />
        </>
      ) : null}
    </Sheet>
  );
}
