import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

/**
 * §2 hero budget ring: 210px, a gradient accent arc from 12 o'clock over a faint
 * track, with a single tight glow behind it and a slow-breathing radial halo. The
 * arc is drawn statically to the ratio (nothing animates but the halo, per brief);
 * over-budget is a NEUTRAL read (abs value + "kcal over"), never a red/amber state
 * (ED guardrail — overage is not a failure, owner hard rule).
 *
 * Native RN has no SVG blur/drop-shadow, so the glow is a wider low-opacity stroke
 * and the halo is a RadialGradient fill whose falloff *is* the blur; the breathing
 * is an Animated.View opacity+scale loop (native driver).
 */
export function BudgetRing({ eaten, budget }: { eaten: number; budget: number }) {
  const { c } = useTheme();
  const size = 210;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const ratio = budget > 0 ? Math.min(1, Math.max(0, eaten / budget)) : 0;
  const over = eaten > budget;
  const offset = circ * (1 - ratio); // static — no count-up
  const shown = Math.round(budget - eaten);

  // §2 breathing radial halo — 6s round trip, opacity 0.30↔0.55, scale 0.98↔1.01.
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.55] });
  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.01] });
  const halo = size - 44; // inset 22pt each side

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: halo, height: halo, opacity: haloOpacity, transform: [{ scale: haloScale }] }}>
        <Svg width={halo} height={halo}>
          <Defs>
            <RadialGradient id="ringHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c('accent')} stopOpacity={0.1} />
              <Stop offset="0.6" stopColor={c('accent')} stopOpacity={0.04} />
              <Stop offset="1" stopColor={c('accent')} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#ringHalo)" />
        </Svg>
      </Animated.View>

      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c('accent')} />
            <Stop offset="1" stopColor={c('accentSoft')} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c('ringTrack')} strokeWidth={stroke} fill="none" />
        {/* single tight glow behind the arc (drop-shadow approximation) */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c('accent')} strokeOpacity={0.3} strokeWidth={stroke + 6} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>

      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 42, fontWeight: '800', color: c('textPrimary'), letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{Math.abs(shown).toLocaleString()}</Text>
        <Text style={{ fontSize: 14, color: c('textMuted'), marginTop: 2 }}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}
