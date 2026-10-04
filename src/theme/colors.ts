/** Brand palette. Change here to refine the identity everywhere. */
export const palette = {
  navy950: '#060E26',
  navy925: '#0A1330',
  navy900: '#071538',
  navy850: '#111C3F',
  navy825: '#18264F',
  navy800: '#0B1F4D',
  navy750: '#243461',
  navy720: '#2D4178',
  navy700: '#132C66',
  navy650: '#33467A',
  royal800: '#1A3FB0',
  royal700: '#002ED1',
  royal600: '#0A3FE0',
  blue600: '#155EEF',
  blue500: '#2970FF',
  blue400: '#5B8DFF',
  blue300: '#8DB0FF',
  blue200: '#C7D7FE',
  blue100: '#E5EDFF',
  blue50: '#F2F6FF',
  sky600: '#0277C9',
  sky300: '#7CD4FD',
  sky100: '#E0F2FE',
  yellow400: '#FFD600',
  orange500: '#FF8A00',
  white: '#FFFFFF',
  gray25: '#FBFCFD',
  gray50: '#F5F7FB',
  gray100: '#EDF0F6',
  gray200: '#E1E5EE',
  gray300: '#C9CFDB',
  gray400: '#9AA3B2',
  gray450: '#6B7487',
  gray500: '#5F6880',
  gray700: '#3B4354',
  gray900: '#121826',
  mist100: '#EEF2FB',
  mist300: '#B4BFD6',
  mist400: '#8C99B8',
  green600: '#079455',
  green400: '#47CD89',
  green100: '#DCFAE6',
  red600: '#D92D20',
  red400: '#FF8A80',
  red100: '#FEE4E2',
  amber600: '#B54708',
  amber400: '#FDB022',
  amber100: '#FEF0C7',
  violet600: '#7A5AF8',
  violet100: '#EBE9FE',
} as const;

/** Semantic color tokens. Both schemes define every key; components never use `palette` directly. */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  /** Raised element on top of `surfaceMuted` (selected segment, toggles). */
  surfaceRaised: string;
  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text on saturated/dark fills (buttons, avatars, gradient header). */
  textOnDark: string;
  textOnDarkSecondary: string;
  textOnAccent: string;

  /** Interactive blue for text, icons and outlines. */
  primary: string;
  primarySoft: string;
  /** Solid fill behind `onPrimary` (buttons, FAB, badges). */
  primaryFill: string;
  onPrimary: string;
  /** Headings and key numbers. */
  brand: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  highlight: string;
  highlightSoft: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  /** Strong neutral pill (e.g. "Paga"). */
  neutralStrong: string;
  onNeutralStrong: string;

  /** Content on the blue gradient header. */
  headerText: string;
  headerTextSecondary: string;
  /** Translucent pills and buttons on the header. */
  headerGlass: string;

  tabBar: string;
  overlay: string;
  /** Base color of drop shadows. */
  shadow: string;
}

export type ColorToken = keyof ThemeColors;

export const lightColors: ThemeColors = {
  background: palette.gray50,
  surface: palette.white,
  surfaceMuted: palette.gray100,
  surfaceRaised: palette.white,
  border: palette.gray200,
  borderStrong: palette.gray300,

  text: palette.gray900,
  textSecondary: palette.gray500,
  textMuted: palette.gray450,
  textOnDark: palette.white,
  textOnDarkSecondary: 'rgba(255,255,255,0.78)',
  textOnAccent: palette.white,

  primary: palette.blue600,
  primarySoft: palette.blue100,
  primaryFill: palette.blue600,
  onPrimary: palette.white,
  brand: palette.navy800,
  brandSoft: palette.blue50,
  accent: palette.sky600,
  accentSoft: palette.sky100,
  highlight: palette.royal700,
  highlightSoft: palette.blue50,

  success: palette.green600,
  successSoft: palette.green100,
  danger: palette.red600,
  dangerSoft: palette.red100,
  warning: palette.amber600,
  warningSoft: palette.amber100,
  info: palette.blue600,
  infoSoft: palette.blue100,
  neutralStrong: palette.gray700,
  onNeutralStrong: palette.white,

  headerText: palette.white,
  headerTextSecondary: 'rgba(255,255,255,0.82)',
  headerGlass: 'rgba(255,255,255,0.18)',

  tabBar: palette.white,
  overlay: 'rgba(7,21,56,0.45)',
  shadow: palette.navy800,
};

export const darkColors: ThemeColors = {
  background: palette.navy925,
  surface: palette.navy850,
  surfaceMuted: palette.navy825,
  surfaceRaised: palette.navy720,
  border: palette.navy750,
  borderStrong: palette.navy650,

  text: palette.mist100,
  textSecondary: palette.mist300,
  textMuted: palette.mist400,
  textOnDark: palette.white,
  textOnDarkSecondary: 'rgba(255,255,255,0.78)',
  textOnAccent: palette.white,

  primary: palette.blue300,
  primarySoft: 'rgba(91,141,255,0.18)',
  primaryFill: palette.royal600,
  onPrimary: palette.white,
  brand: palette.blue100,
  brandSoft: 'rgba(141,176,255,0.12)',
  accent: palette.sky300,
  accentSoft: 'rgba(124,212,253,0.14)',
  highlight: palette.blue300,
  highlightSoft: 'rgba(91,141,255,0.12)',

  success: palette.green400,
  successSoft: 'rgba(71,205,137,0.16)',
  danger: palette.red400,
  dangerSoft: 'rgba(255,138,128,0.16)',
  warning: palette.amber400,
  warningSoft: 'rgba(253,176,34,0.16)',
  info: palette.blue300,
  infoSoft: 'rgba(91,141,255,0.18)',
  neutralStrong: palette.mist300,
  onNeutralStrong: palette.navy925,

  headerText: palette.white,
  headerTextSecondary: 'rgba(255,255,255,0.82)',
  headerGlass: 'rgba(255,255,255,0.14)',

  tabBar: palette.navy825,
  overlay: 'rgba(2,6,18,0.6)',
  shadow: '#000000',
};

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
