import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, type ThemeColors, touchTarget, useTheme } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

function variantStyle(variant: Variant, colors: ThemeColors): { background: string; text: string; border?: string } {
  switch (variant) {
    case 'primary':
      return { background: colors.primaryFill, text: colors.onPrimary };
    case 'accent':
      return { background: colors.primaryFill, text: colors.textOnAccent };
    case 'secondary':
      return { background: colors.surface, text: colors.brand, border: colors.border };
    case 'ghost':
      return { background: 'transparent', text: colors.primary };
    case 'danger':
      return { background: colors.dangerSoft, text: colors.danger };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors, gradients } = useTheme();
  const palette = variantStyle(variant, colors);
  const height = size === 'lg' ? 56 : touchTarget + 4;
  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {Icon && <Icon size={18} color={palette.text} strokeWidth={2.4} />}
          <AppText variant="bodyStrong" color={palette.text}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        { height, backgroundColor: palette.background, alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        palette.border && { borderWidth: 1, borderColor: palette.border },
        style,
      ]}>
      {variant === 'accent' ? (
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradient: { borderRadius: radius.lg },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
