import { Platform, type ViewStyle } from 'react-native';

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

function shadow(color: string, elevation: number, opacity: number, blur: number, y: number): ViewStyle {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${y}px ${blur}px rgba(${r},${g},${b},${opacity})` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: y },
      elevation,
    },
  })!;
}

export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg';
export type ThemeShadows = Record<ShadowLevel, ViewStyle>;

/**
 * Elevation styles for a shadow base color (`#RRGGBB`). Dark surfaces need a
 * stronger shadow to still read as elevated.
 */
export function createShadows(color: string, strength = 1): ThemeShadows {
  return {
    none: {},
    sm: shadow(color, 2, 0.06 * strength, 8, 2),
    md: shadow(color, 6, 0.08 * strength, 20, 6),
    lg: shadow(color, 12, 0.14 * strength, 32, 12),
  };
}

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
