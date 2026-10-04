import { Platform, type ViewStyle } from 'react-native';
import { palette } from './colors';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

/** Minimum touch target (accessibility). */
export const touchTarget = 44;

export const layout = {
  screenPadding: spacing.xl,
  maxContentWidth: 560,
  tabBarHeight: 64,
  headerCurve: radius.xxl,
} as const;

function shadow(elevation: number, opacity: number, blur: number, y: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${y}px ${blur}px rgba(11,31,77,${opacity})` } as ViewStyle,
    default: {
      shadowColor: palette.navy800,
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: y },
      elevation,
    },
  })!;
}

export const shadows = {
  none: {} as ViewStyle,
  sm: shadow(2, 0.06, 8, 2),
  md: shadow(6, 0.08, 20, 6),
  lg: shadow(12, 0.14, 32, 12),
} as const;

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
