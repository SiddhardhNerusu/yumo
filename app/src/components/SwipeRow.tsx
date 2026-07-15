import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { haptics } from '../haptics';

const REVEAL = 84; // rest-open width showing the Delete action (iOS-Mail style)
const OPEN_AT = 44; // drag past this on release → snap open
const COMMIT_FRACTION = 0.42; // drag past this fraction of row width → delete outright

function TrashGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/**
 * Swipe-left-to-delete row (industry-standard, race-safe):
 *  - captures only horizontal-dominant gestures, so vertical scroll still works;
 *  - a full swipe (past COMMIT_FRACTION of the width) deletes outright;
 *  - a short swipe rests open at REVEAL, and tapping the revealed action deletes;
 *  - `committedRef` guarantees onDelete fires at most once, no matter how the
 *    gesture, the tap, and the snap-back race.
 */
export function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void; }) {
  const { c } = useTheme();
  const tx = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const openRef = useRef(false);
  const committedRef = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; };

  const settle = (to: number) => {
    openRef.current = to !== 0;
    Animated.spring(tx, { toValue: to, useNativeDriver: true, speed: 20, bounciness: to === 0 ? 6 : 0 }).start();
  };

  const commit = () => {
    if (committedRef.current) return; // fire exactly once
    committedRef.current = true;
    haptics.tap();
    const w = widthRef.current || 400;
    Animated.timing(tx, { toValue: -w, duration: 180, useNativeDriver: true }).start(() => onDelete());
  };

  const pan = useRef(
    PanResponder.create({
      // Only take over from the scroll view for a clearly-horizontal drag.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -REVEAL : 0;
        let next = base + g.dx;
        if (next > 0) next = next * 0.25; // rubber-band past closed
        tx.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = openRef.current ? -REVEAL : 0;
        const pos = base + g.dx;
        const w = widthRef.current || 400;
        if (pos < -w * COMMIT_FRACTION || g.vx < -0.9) commit();
        else if (pos < -OPEN_AT) settle(-REVEAL);
        else settle(0);
      },
      onPanResponderTerminationRequest: () => false, // don't yield mid-swipe (no race)
    }),
  ).current;

  return (
    <View onLayout={onLayout} style={{ position: 'relative' }}>
      {/* delete action sits behind the row, revealed as it slides left */}
      <Pressable
        onPress={commit}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL, backgroundColor: c('danger'), alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <TrashGlyph color={c('bg')} />
        <Text style={{ color: c('bg'), fontSize: 11, fontWeight: '700' }}>Delete</Text>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX: tx }], backgroundColor: c('surface') }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
