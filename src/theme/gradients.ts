import type { CardTheme } from '@/domain';
import { palette } from './colors';

export type Gradient = readonly [string, string, ...string[]];

export interface ThemeGradients {
  /** Brand header behind greetings and page titles. */
  header: Gradient;
  /** Call-to-action fill (accent buttons, the "+" tab). */
  accent: Gradient;
  ocean: Gradient;
  night: Gradient;
}

export type GradientName = keyof ThemeGradients;

export const lightGradients: ThemeGradients = {
  header: [palette.blue600, palette.royal700],
  accent: [palette.sky600, palette.royal700],
  ocean: [palette.blue600, palette.navy800],
  night: [palette.navy700, palette.navy900],
};

export const darkGradients: ThemeGradients = {
  header: [palette.royal800, palette.navy800],
  accent: [palette.sky600, palette.royal700],
  ocean: [palette.blue600, palette.navy800],
  night: [palette.navy700, palette.navy950],
};

/** User-selectable card looks: the same in both color schemes (they depict physical cards). */
export const cardThemes: Record<CardTheme, { label: string; colors: Gradient; text: string }> = {
  midnight: { label: 'Meia-noite', colors: ['#1B2A4E', '#050B1C'], text: palette.white },
  ocean: { label: 'Oceano', colors: [palette.blue500, palette.navy800], text: palette.white },
  sunset: { label: 'Pôr do sol', colors: [palette.orange500, '#E8590C'], text: palette.white },
  gold: { label: 'Dourado', colors: [palette.yellow400, palette.orange500], text: palette.navy800 },
  graphite: { label: 'Grafite', colors: ['#4A5163', '#1D2230'], text: palette.white },
  violet: { label: 'Violeta', colors: ['#9B8AFB', '#5925DC'], text: palette.white },
};
