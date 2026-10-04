import { DarkTheme, DefaultTheme } from 'expo-router';

import type { Theme } from './theme';

type NavigationTheme = typeof DefaultTheme;

const cache = new Map<Theme, NavigationTheme>();

/** React Navigation theme derived from ours, so scene backgrounds never flash white. */
export function navigationTheme(theme: Theme): NavigationTheme {
  let value = cache.get(theme);
  if (!value) {
    const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
    value = {
      ...base,
      dark: theme.scheme === 'dark',
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
    cache.set(theme, value);
  }
  return value;
}
