import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  overline: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  money: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] },
  moneyLarge: {
    fontFamily: fontFamily.extrabold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
