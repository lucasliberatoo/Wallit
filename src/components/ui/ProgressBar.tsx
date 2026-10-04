import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { durations, radius, useTheme } from '@/theme';

export interface ProgressBarProps {
  /** 0-1 */
  progress: number;
  color?: string;
  track?: string;
  height?: number;
}

export function ProgressBar({ progress, color, track, height = 8 }: ProgressBarProps) {
  const { colors } = useTheme();
  const value = useSharedValue(0);
  useEffect(() => {
    value.set(withTiming(Math.min(Math.max(progress, 0), 1), { duration: durations.slow }));
  }, [progress, value]);
  const fill = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { height, backgroundColor: track ?? colors.surfaceMuted }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color ?? colors.success }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: radius.pill },
});
