import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

export interface SurfaceProps extends ViewProps {
  padded?: boolean;
  elevation?: keyof typeof shadows;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Rounded white card with a soft shadow. Becomes tappable when `onPress` is set. */
export function Surface({ padded = true, elevation = 'sm', onPress, style, children, accessibilityLabel, ...rest }: SurfaceProps) {
  const surfaceStyle = [styles.base, shadows[elevation], padded && styles.padded, style];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={surfaceStyle} accessibilityLabel={accessibilityLabel}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={surfaceStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  padded: { padding: spacing.lg },
});
