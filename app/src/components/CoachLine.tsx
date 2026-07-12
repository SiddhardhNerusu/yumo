import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '../theme';
import { Serif } from './kit';

/** §5 coach line — computed, italic serif, centered. Crossfades on change so it
 * dissolves into the new voice line during the log beat instead of hard-cutting. */
export function CoachLine({ text }: { text: string }) {
  const { c } = useTheme();
  const op = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (text === shown) return;
    Animated.timing(op, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setShown(text);
      Animated.timing(op, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    });
  }, [text, shown, op]);
  return (
    <Animated.View style={{ paddingHorizontal: 12, opacity: op }}>
      <Serif italic size={16} color={c('textSecondary')} style={{ textAlign: 'center', lineHeight: 23 }}>{shown}</Serif>
    </Animated.View>
  );
}
