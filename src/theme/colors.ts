/** Brand palette. Change here to refine the identity everywhere. */
export const palette = {
  navy900: '#071538',
  navy800: '#0B1F4D',
  navy700: '#132C66',
  blue600: '#155EEF',
  blue500: '#2970FF',
  blue100: '#E5EDFF',
  blue50: '#F2F6FF',
  yellow400: '#FFD600',
  yellow100: '#FFF7CC',
  orange500: '#FF8A00',
  orange100: '#FFEBD1',
  white: '#FFFFFF',
  gray25: '#FBFCFD',
  gray50: '#F7F8FA',
  gray100: '#EEF0F4',
  gray200: '#E1E4EA',
  gray300: '#C9CED8',
  gray400: '#9AA3B2',
  gray500: '#6B7487',
  gray700: '#3B4354',
  gray900: '#121826',
  green600: '#079455',
  green100: '#DCFAE6',
  red600: '#D92D20',
  red100: '#FEE4E2',
  amber600: '#B54708',
  amber100: '#FEF0C7',
  violet600: '#7A5AF8',
  violet100: '#EBE9FE',
} as const;

export const colors = {
  background: palette.gray50,
  surface: palette.white,
  surfaceMuted: palette.gray100,
  border: palette.gray200,
  borderStrong: palette.gray300,

  text: palette.gray900,
  textSecondary: palette.gray500,
  textMuted: palette.gray400,
  textOnDark: palette.white,
  textOnDarkSecondary: 'rgba(255,255,255,0.72)',
  textOnAccent: palette.navy800,

  primary: palette.blue600,
  primarySoft: palette.blue100,
  brand: palette.navy800,
  accent: palette.orange500,
  accentSoft: palette.orange100,
  highlight: palette.yellow400,

  success: palette.green600,
  successSoft: palette.green100,
  danger: palette.red600,
  dangerSoft: palette.red100,
  warning: palette.amber600,
  warningSoft: palette.amber100,
  info: palette.blue600,
  infoSoft: palette.blue100,

  overlay: 'rgba(7,21,56,0.45)',
} as const;

export type ColorToken = keyof typeof colors;

/** Avatar / family colors used when the user doesn't pick one. */
export const identityColors = [
  palette.blue600,
  palette.orange500,
  palette.violet600,
  palette.green600,
  '#E31B54',
  '#0E9384',
  palette.navy700,
  '#DC6803',
] as const;
