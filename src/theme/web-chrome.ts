import { useEffect } from 'react';
import { Platform } from 'react-native';

import { chromeColor, type Theme } from './theme';

/**
 * Web only: keeps the page background (overscroll, behind the root view), the
 * native form controls and the browser's `theme-color` in sync with the theme.
 */
export function useWebChrome(theme: Theme) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.colorScheme = theme.scheme;
    root.style.backgroundColor = theme.colors.background;
    document.body.style.backgroundColor = theme.colors.background;

    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = chromeColor(theme);
      document.head.appendChild(meta);
    }
    metas.forEach((meta) => {
      // index.html ships one tag per scheme (media queries); once the app runs, the user's choice wins.
      meta.removeAttribute('media');
      meta.content = chromeColor(theme);
    });
  }, [theme]);
}
