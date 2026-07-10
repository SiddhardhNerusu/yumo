import { View, Text } from 'react-native';
import { useTheme } from '../theme';

export function CoachLine({ text }: { text: string }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ backgroundColor: c('accentSubtle'), borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text style={{ color: c('accentSubtleText'), fontSize: 14 }}>{text}</Text>
    </View>
  );
}
