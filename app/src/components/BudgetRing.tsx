import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** §5 hero budget ring: 196px, stroke 13, accent progress with round caps from
 * 12 o'clock; the fill animates over 600ms. Center shows kcal-left. */
export function BudgetRing({ eaten, budget }: { eaten: number; budget: number }) {
  const { c } = useTheme();
  const size = 196;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, budget > 0 ? eaten / budget : 0));
  const remaining = Math.max(0, budget - eaten);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c('ringTrack')} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c('accent')}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 42, fontWeight: '800', color: c('textPrimary'), letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
          {remaining.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 13, color: c('textMuted'), marginTop: 2 }}>kcal left</Text>
      </View>
    </View>
  );
}
