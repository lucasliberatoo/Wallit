import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, durations, radius } from '@/theme';

export interface ProgressBarProps {
  /** 0-1 */
  progress: number;
  color?: string;
  track?: string;
  height?: number;
}

export function ProgressBar({ progress, color = colors.success, track = colors.surfaceMuted, height = 8 }: ProgressBarProps) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(Math.min(Math.max(progress, 0), 1), { duration: durations.slow });
  }, [progress, value]);
  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { height, backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: radius.pill },
});
