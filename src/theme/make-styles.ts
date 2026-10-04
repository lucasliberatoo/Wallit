import { StyleSheet } from 'react-native';

import type { ThemeColors } from './colors';
import type { Theme } from './theme';
import { useTheme } from './ThemeProvider';

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Theme-aware `StyleSheet.create`. Declare it at module level, call the hook in
 * the component:
 *
 *   const useStyles = makeStyles((colors, { shadows }) => ({ card: { backgroundColor: colors.surface, ...shadows.sm } }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * Styles are built once per theme and cached, so switching light/dark is cheap.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeColors, theme: Theme) => T & NamedStyles<any>,
): () => T {
  const cache = new Map<ThemeColors, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme.colors);
    if (!styles) {
      styles = StyleSheet.create(factory(theme.colors, theme));
      cache.set(theme.colors, styles);
    }
    return styles;
  };
}
