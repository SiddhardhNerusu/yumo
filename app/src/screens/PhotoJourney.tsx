import { useRef, useState } from 'react';
import { View, Text, Image, Modal, ScrollView, Pressable, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { kgToDisplay, weightDelta, type WeightUnit } from '@yumo/shared';
import { haptics } from '../haptics';

const num = { fontVariant: ['tabular-nums' as const] };
// Photo-chrome lives on a full-bleed #000 photo view, so it uses fixed light
// colours (the sanctioned exception to tokens-only — mirrors the old viewer).
const LIGHT = '#F7F2EA';
const DIM = 'rgba(255,255,255,0.55)';

export interface JourneyPhoto { day: number; kg: number; photoUri: string }

/**
 * Full-screen progress-photo journey (§R4, ported from Goyo). Newest-first
 * swipe pager: swiping forward walks back in time (a free time-lapse). Each
 * frame shows date + weight + "vs first photo" delta; a dot pager tracks
 * position; Compare puts two chosen dates side by side.
 */
export function PhotoJourney({
  photos,
  startIndex,
  unit,
  fmtDate,
  onRemove,
  onClose,
}: {
  photos: JourneyPhoto[]; // newest first
  startIndex: number;
  unit: WeightUnit;
  fmtDate: (day: number) => string;
  onRemove: (day: number) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const scRef = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const [idx, setIdx] = useState(Math.max(0, Math.min(photos.length - 1, startIndex)));
  const [pagerH, setPagerH] = useState(0);
  const [compare, setCompare] = useState(false);
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(Math.max(0, photos.length - 1));

  const oldest = photos[photos.length - 1];
  const cur = photos[idx];
  if (!cur || !oldest) return null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (i !== idx) { setIdx(i); haptics.select(); }
  };

  const vsFirst = cur.kg - oldest.kg;
  const wd = weightDelta(vsFirst, unit);
  const isOldest = idx === photos.length - 1;

  return (
    <Modal visible animationType="fade" onRequestClose={() => (compare ? setCompare(false) : onClose())}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close photos" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: LIGHT, fontSize: 22, marginTop: -2 }}>‹</Text>
            <Text style={{ color: LIGHT, fontSize: 15, fontWeight: '600' }}>Photos</Text>
          </Pressable>
          {photos.length >= 2 ? (
            <Pressable onPress={() => { setAIdx(0); setBIdx(photos.length - 1); setCompare(true); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Compare two photos">
              <Text style={{ color: LIGHT, fontSize: 15, fontWeight: '600' }}>Compare</Text>
            </Pressable>
          ) : null}
        </View>

        {/* pager */}
        <ScrollView
          ref={scRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          contentOffset={{ x: startIndex * width, y: 0 }}
          onLayout={(e) => {
            setPagerH(e.nativeEvent.layout.height); // RN-web ScrollView children need an explicit height
            if (!didInit.current) { didInit.current = true; scRef.current?.scrollTo({ x: startIndex * width, animated: false }); }
          }}
          style={{ flex: 1 }}
        >
          {photos.map((p) => (
            <View key={p.day} style={{ width, height: pagerH, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: p.photoUri }} resizeMode="contain" style={{ width, height: pagerH }} />
            </View>
          ))}
        </ScrollView>

        {/* caption + dot pager + remove */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, gap: 12, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={{ color: LIGHT, fontSize: 14, fontWeight: '600' }}>{fmtDate(cur.day)}</Text>
            <Text style={[{ color: LIGHT, fontSize: 15, fontWeight: '700' }, num]}>{kgToDisplay(cur.kg, unit)}</Text>
            {photos.length >= 2 && !isOldest ? (
              <Text style={[{ color: DIM, fontSize: 13 }, num]}>{vsFirst <= 0 ? '▾' : '▴'} {wd.value} {wd.suffix} vs first</Text>
            ) : null}
          </View>

          {photos.length <= 9 ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {photos.map((_, i) => (
                <View key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 999, backgroundColor: i === idx ? LIGHT : 'rgba(255,255,255,0.3)' }} />
              ))}
            </View>
          ) : (
            <Text style={[{ color: DIM, fontSize: 12 }, num]}>{idx + 1} of {photos.length}</Text>
          )}

          <Pressable onPress={() => onRemove(cur.day)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove this photo">
            <Text style={{ color: DIM, fontSize: 13 }}>Remove photo</Text>
          </Pressable>
        </View>
      </View>

      {compare ? (
        <CompareView
          photos={photos}
          aIdx={Math.min(aIdx, photos.length - 1)}
          bIdx={Math.min(bIdx, photos.length - 1)}
          unit={unit}
          fmtDate={fmtDate}
          onA={setAIdx}
          onB={setBIdx}
          onClose={() => setCompare(false)}
        />
      ) : null}
    </Modal>
  );
}

/** Side-by-side two-date compare (newer left, per Goyo). No wipe divider / share
 * this wave — those are the flashy stretch bits. */
function CompareView({
  photos,
  aIdx,
  bIdx,
  unit,
  fmtDate,
  onA,
  onB,
  onClose,
}: {
  photos: JourneyPhoto[];
  aIdx: number;
  bIdx: number;
  unit: WeightUnit;
  fmtDate: (day: number) => string;
  onA: (i: number) => void;
  onB: (i: number) => void;
  onClose: () => void;
}) {
  const a = photos[aIdx];
  const b = photos[bIdx];
  if (!a || !b) return null;
  const dayGap = Math.abs(a.day - b.day);
  const wd = weightDelta(a.kg - b.kg, unit);
  const wrap = (i: number) => ((i % photos.length) + photos.length) % photos.length;

  const pane = (p: JourneyPhoto, i: number, onChange: (i: number) => void) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Image source={{ uri: p.photoUri }} resizeMode="cover" style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: '#111' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => onChange(wrap(i - 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous date"><Text style={{ color: LIGHT, fontSize: 18 }}>‹</Text></Pressable>
        <Text style={{ color: LIGHT, fontSize: 12.5, fontWeight: '600' }}>{fmtDate(p.day)}</Text>
        <Pressable onPress={() => onChange(wrap(i + 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next date"><Text style={{ color: LIGHT, fontSize: 18 }}>›</Text></Pressable>
      </View>
      <Text style={[{ color: DIM, fontSize: 12 }, num]}>{kgToDisplay(p.kg, unit)}</Text>
    </View>
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to photos" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: LIGHT, fontSize: 22, marginTop: -2 }}>‹</Text>
          <Text style={{ color: LIGHT, fontSize: 15, fontWeight: '600' }}>Photos</Text>
        </Pressable>
        <Text style={{ color: LIGHT, fontSize: 15, fontWeight: '600' }}>Compare</Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16, flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={[{ color: LIGHT, fontSize: 20, fontWeight: '800' }, num]}>{dayGap} days · {a.kg - b.kg <= 0 ? '▾' : '▴'} {wd.value} {wd.suffix}</Text>
          <Text style={{ color: DIM, fontSize: 12 }}>newer on the left</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {pane(a, aIdx, onA)}
          {pane(b, bIdx, onB)}
        </View>
      </View>
    </View>
  );
}
