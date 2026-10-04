import { Image, type ImageSourcePropType } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Official Wallit logo: rounded square with "Wallit" and the card stripe cut
 * out (the background shows through). Sources and vectors live in
 * `assets/brand/`.
 */
const LOGO_SOURCES: Record<'blue' | 'white', ImageSourcePropType> = {
  blue: require('../../../assets/brand/logo-blue.png'),
  white: require('../../../assets/brand/logo-white.png'),
};

export interface LogoProps {
  size?: number;
  /**
   * `blue` on light backgrounds, `white` on the blue header or dark backgrounds.
   * `auto` (default) picks by the current color scheme, for page backgrounds.
   */
  variant?: 'auto' | 'blue' | 'white';
}

export function Logo({ size = 72, variant = 'auto' }: LogoProps) {
  const { scheme } = useTheme();
  const resolved = variant === 'auto' ? (scheme === 'dark' ? 'white' : 'blue') : variant;
  return (
    <Image
      source={LOGO_SOURCES[resolved]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Wallit"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
