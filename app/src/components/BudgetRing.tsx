import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** §5 hero budget ring: 196px, gradient accent progress from 12 o'clock. The arc
 * AND the centre number animate together over 600ms (count-up), a soft bloom sits
 * behind the arc, and going over budget flips to a warning state + overflow read. */
export function BudgetRing({ eaten, budget }: { eaten: number; budget: number }) {
  const { c } = useTheme();
  const size = 196;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const ratio = budget > 0 ? eaten / budget : 0;
  const over = eaten > budget;
  const near = !over && ratio >= 0.92;
  const ringColor = over ? c('danger') : near ? c('warning') : c('accent');

  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(() => Math.round(budget - eaten));
  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(Math.round(budget - value * budget)));
    // counts up from wherever it was — a fresh mount glides 0→value, a log re-glides
    Animated.timing(anim, { toValue: ratio, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [ratio, budget, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0], extrapolateRight: 'clamp' });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c('accent')} />
            <Stop offset="1" stopColor={c('accentSoft')} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c('ringTrack')} strokeWidth={stroke} fill="none" />
        {/* soft bloom behind the arc — reads as lit, not printed */}
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={ringColor} strokeOpacity={0.18} strokeWidth={stroke + 10} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over || near ? ringColor : 'url(#ringGrad)'}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 42, fontWeight: '800', color: over ? c('danger') : c('textPrimary'), letterSpacing: -1.2, fontVariant: ['tabular-nums'] }}>
          {over && shown < 0 ? '−' : ''}{Math.abs(shown).toLocaleString()}
        </Text>
        <Text style={{ fontSize: 13, color: over ? c('danger') : c('textMuted'), marginTop: 2 }}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}
