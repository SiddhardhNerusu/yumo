import { useEffect, useRef } from 'react';
import { Animated, Text, Pressable, Easing } from 'react-native';
import { useTheme } from '../../theme';
import { Glyph } from './Glyph';
import { freshnessOf, type KitchenItem, type Level } from '../../data/kitchen-model';

const LEVEL_DOTS: Record<Level, number> = { plenty: 3, some: 2, low: 1, out: 0 };

/** A single ingredient tile on a shelf (§2.2): glyph + name + level + freshness. */
export function ItemTile({ item, now, justAdded, frost, onPress }: { item: KitchenItem; now: number; justAdded: boolean; frost?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const fresh = freshnessOf(item, now);
  const gone = fresh === 'gone';
  const warn = fresh === 'soon' || fresh === 'today';

  const enter = useRef(new Animated.Value(justAdded ? 0 : 1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (justAdded) {
      enter.setValue(0); // reset so a topped-up existing tile flies in too
      Animated.spring(enter, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8, delay: 40 }).start();
    }
  }, [justAdded, enter]);
  useEffect(() => {
    if (fresh !== 'today') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      { iterations: 3 }, // a few soft pulses, then rests — never nagging (§2.2)
    );
    loop.start();
    return () => loop.stop();
  }, [fresh, pulse]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const glowOpacity = warn ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }) : 0;

  return (
    <Animated.View style={{ opacity: gone ? 0.45 : enter, transform: [{ translateY }, { rotate: gone ? '-3deg' : '0deg' }] }}>
      <Pressable
        onPress={onPress}
        style={{ width: 78, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, backgroundColor: warn ? c('accentFaint') : c('chipSurface'), borderWidth: 1, borderColor: c('border') }}
      >
        {warn ? (
          <Animated.View style={{ position: 'absolute', top: -4, right: -2, opacity: glowOpacity, width: 8, height: 8, borderRadius: 4, backgroundColor: c('warning') }} />
        ) : null}
        <Glyph token={item.token} size={30} body={frost ? c('textMuted') : c('textSecondary')} accent={gone ? c('textMuted') : c('accent')} mono={c('textMuted')} />
        <Text numberOfLines={1} style={{ color: gone ? c('textMuted') : c('textLogged'), fontSize: 11, fontWeight: '600', marginTop: 4, maxWidth: 70, textAlign: 'center' }}>{item.label}</Text>
        <Text style={{ color: warn ? c('accentSoft') : c('textMuted'), fontSize: 9, marginTop: 2 }}>
          {gone ? 'past it' : fresh === 'today' ? 'use today' : fresh === 'soon' ? 'use soon' : '•'.repeat(LEVEL_DOTS[item.level]) || 'low'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
