import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

export function BudgetRing({ eaten, budget }: { eaten: number; budget: number }) {
  const { c } = useTheme();
  const size = 224;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, budget > 0 ? eaten / budget : 0));
  const remaining = Math.max(0, budget - eaten);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c('ringTrack')} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c('accent')}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 46, fontWeight: '800', color: c('textPrimary') }}>
          {remaining.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 13, color: c('textSecondary'), marginTop: 2 }}>kcal left</Text>
        <Text style={{ fontSize: 12, color: c('textMuted'), marginTop: 8 }}>
          {Math.round(eaten).toLocaleString()} of {budget.toLocaleString()} eaten
        </Text>
      </View>
    </View>
  );
}
