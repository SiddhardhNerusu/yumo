import { View, Dimensions } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useTheme } from '../theme';

/** 7-day smoothed weight line (accent) over ghosted raw dots (§6.3). */
export function WeightChart({ data }: { data: number[] }) {
  const { c } = useTheme();
  const W = Math.max(220, Dimensions.get('window').width - 40 - 32);
  const H = 140;
  const n = data.length;
  if (n === 0) return null;

  const smoothed = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const all = [...data, ...smoothed];
  const min = Math.min(...all) - 0.3;
  const max = Math.max(...all) + 0.3;
  const span = max - min || 1;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - ((v - min) / span) * H;
  const line = smoothed.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <View>
      <Svg width={W} height={H}>
        {data.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={c('ringTrack')} />
        ))}
        <Polyline points={line} fill="none" stroke={c('accent')} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
