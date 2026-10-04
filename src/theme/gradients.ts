import type { CardTheme } from '@/domain';
import { palette } from './colors';

type Gradient = readonly [string, string, ...string[]];

export const gradients = {
  sunrise: [palette.orange500, palette.yellow400] as Gradient,
  ocean: [palette.blue600, palette.navy800] as Gradient,
  night: [palette.navy700, palette.navy900] as Gradient,
} as const;

export const cardThemes: Record<CardTheme, { label: string; colors: Gradient; text: string }> = {
  midnight: { label: 'Meia-noite', colors: ['#1B2A4E', '#050B1C'], text: palette.white },
  ocean: { label: 'Oceano', colors: [palette.blue500, palette.navy800], text: palette.white },
  sunset: { label: 'Pôr do sol', colors: [palette.orange500, '#E8590C'], text: palette.white },
  gold: { label: 'Dourado', colors: [palette.yellow400, palette.orange500], text: palette.navy800 },
  graphite: { label: 'Grafite', colors: ['#4A5163', '#1D2230'], text: palette.white },
  violet: { label: 'Violeta', colors: ['#9B8AFB', '#5925DC'], text: palette.white },
};
