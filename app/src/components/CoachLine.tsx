import { View } from 'react-native';
import { useTheme } from '../theme';
import { Serif } from './kit';

/** §5 coach line — computed, italic serif, centered. Never decorative. */
export function CoachLine({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 12 }}>
      <Serif italic size={16} color={c('textSecondary')} style={{ textAlign: 'center', lineHeight: 23 }}>{text}</Serif>
    </View>
  );
}
