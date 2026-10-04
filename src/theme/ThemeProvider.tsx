import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { isThemePreference, resolveScheme, type Theme, type ThemePreference, themes } from './theme';
import { useWebChrome } from './web-chrome';

/** AsyncStorage key; also read by the inline script in public/index.html to avoid a flash. */
export const THEME_STORAGE_KEY = 'wallit:theme';

export interface ThemeContextValue extends Theme {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readPreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

async function writePreference(preference: ThemePreference) {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted (private mode, storage full): the choice still applies for this session.
  }
}

/**
 * Light/dark theme for the whole app. Renders nothing until the saved
 * preference is read (a few ms, behind the splash screen) so the first frame
 * already has the right colors.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let active = true;
    readPreference().then((value) => {
      if (active) setPreferenceState((current) => current ?? value);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writePreference(next);
  }, []);

  const theme = themes[resolveScheme(preference ?? 'system', system === 'dark' ? 'dark' : 'light')];
  const value = useMemo<ThemeContextValue>(
    () => ({ ...theme, preference: preference ?? 'system', setPreference }),
    [theme, preference, setPreference],
  );
  useWebChrome(theme);

  if (preference === null) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
