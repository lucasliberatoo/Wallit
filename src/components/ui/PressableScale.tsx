import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How much the element shrinks while pressed. */
  scaleTo?: number;
  haptic?: boolean;
}

/** Base for every tappable surface: a subtle spring scale + optional haptic tick. */
export function PressableScale({ style, scaleTo = 0.97, haptic = false, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, { damping: 20, stiffness: 400 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
        onPress?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
      {...rest}
    />
  );
}
