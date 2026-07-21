import { useRef, useState } from 'react';
import { View } from 'react-native';

/**
 * A pure slider (no native dep) that works on RN and RN-web. Uses the View
 * responder props directly — the same mechanism Pressable uses — with
 * onResponderTerminationRequest → false so a wrapping ScrollView can't steal the
 * gesture mid-drag. Maps a touch's absolute pageX against the track's measured
 * page-left → a snapped, clamped value. Config is read through a ref so the
 * handlers always see the latest onChange.
 */
export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  fill,
  track,
  thumb,
  thumbBorder,
  a11yLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** filled-portion color */
  fill: string;
  /** unfilled track color */
  track: string;
  /** thumb fill */
  thumb: string;
  /** thumb ring (usually the surface it sits on) */
  thumbBorder: string;
  a11yLabel?: string;
}) {
  const THUMB = 22;
  const [w, setW] = useState(0);
  const geom = useRef({ left: 0, width: 1 });
  const dragging = useRef(false);
  const viewRef = useRef<View>(null);
  const cfg = useRef({ min, max, step, onChange });
  cfg.current = { min, max, step, onChange };

  const measure = () => {
    viewRef.current?.measureInWindow((x, _y, width) => {
      geom.current = { left: x, width: width || 1 };
      setW(width);
    });
  };

  const apply = (pageX: number) => {
    const { min: lo, max: hi, step: st, onChange: cb } = cfg.current;
    const { left, width } = geom.current;
    const frac = Math.max(0, Math.min(1, (pageX - left) / width));
    const snapped = Math.round((lo + frac * (hi - lo)) / st) * st;
    cb(Math.max(lo, Math.min(hi, Number(snapped.toFixed(4)))));
  };

  const frac = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  const thumbLeft = Math.max(0, Math.min(w - THUMB, frac * w - THUMB / 2));

  return (
    <View
      ref={viewRef}
      onLayout={measure}
      accessibilityRole="adjustable"
      accessibilityLabel={a11yLabel}
      accessibilityValue={{ min, max, now: value }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { dragging.current = true; measure(); apply(e.nativeEvent.pageX); }}
      onResponderMove={(e) => { if (dragging.current) apply(e.nativeEvent.pageX); }}
      onResponderRelease={() => { dragging.current = false; }}
      onResponderTerminate={() => { dragging.current = false; }}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View style={{ height: 4, borderRadius: 999, backgroundColor: track, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, backgroundColor: fill, borderRadius: 999 }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: thumbLeft,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: thumb,
          borderWidth: 3,
          borderColor: thumbBorder,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      />
    </View>
  );
}
