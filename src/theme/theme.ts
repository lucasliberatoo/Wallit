import { darkColors, lightColors, type ThemeColors } from './colors';
import { darkGradients, lightGradients, type ThemeGradients } from './gradients';
import { createShadows, type ThemeShadows } from './tokens';

export type ColorScheme = 'light' | 'dark';
/** What the user picked in Perfil > Aparência. */
export type ThemePreference = 'system' | ColorScheme;

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
}

/** Shadows on dark surfaces need roughly 3x the opacity to read as elevation. */
const DARK_SHADOW_STRENGTH = 3.2;

export const themes: Record<ColorScheme, Theme> = {
  light: { scheme: 'light', colors: lightColors, gradients: lightGradients, shadows: createShadows(lightColors.shadow) },
  dark: { scheme: 'dark', colors: darkColors, gradients: darkGradients, shadows: createShadows(darkColors.shadow, DARK_SHADOW_STRENGTH) },
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveScheme(preference: ThemePreference, system: ColorScheme | null | undefined): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

/** Color of the browser/OS chrome around the app: matches the top of the brand header. */
export function chromeColor(theme: Theme): string {
  return theme.gradients.header[0];
}
