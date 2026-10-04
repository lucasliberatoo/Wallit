import { View, type ViewProps } from 'react-native';

import { makeStyles, radius, type ShadowLevel, spacing, useTheme } from '@/theme';
import { PressableScale } from './PressableScale';

export interface SurfaceProps extends ViewProps {
  padded?: boolean;
  elevation?: ShadowLevel;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Rounded surface card with a soft shadow. Becomes tappable when `onPress` is set. */
export function Surface({ padded = true, elevation = 'sm', onPress, style, children, accessibilityLabel, ...rest }: SurfaceProps) {
  const { shadows } = useTheme();
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  padded: { padding: spacing.lg },
}));
