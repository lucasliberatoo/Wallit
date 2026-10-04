import { Text, type TextProps } from 'react-native';

import { colors, type ColorToken, typography, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorToken | (string & {});
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const resolved = color in colors ? colors[color as ColorToken] : color;
  return (
    <Text maxFontSizeMultiplier={1.4} style={[typography[variant], { color: resolved }, align && { textAlign: align }, style]} {...rest} />
  );
}
