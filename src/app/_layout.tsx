import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/hooks';
import { createQueryClient } from '@/lib/query-client';
import { RepositoriesProvider } from '@/providers/RepositoriesProvider';
import { usePendingInviteStore } from '@/stores/pending-invite-store';
import { navigationTheme, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RepositoriesProvider>
            <QueryClientProvider client={queryClient}>
              <ThemedStatusBar />
              {fontsLoaded || fontError ? <RootNavigator /> : null}
            </QueryClientProvider>
          </RepositoriesProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Default status bar for screens without a brand header (headers set their own). */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const theme = useTheme();
  const session = useSession();
  const isSignedIn = Boolean(session.data);

  useEffect(() => {
    if (!session.isLoading) SplashScreen.hideAsync().catch(() => undefined);
  }, [session.isLoading]);

  // An invite link opened before signing in continues right after login/sign-up.
  const pendingInvite = usePendingInviteStore((state) => state.code);
  const clearInvite = usePendingInviteStore((state) => state.setCode);
  useEffect(() => {
    if (!isSignedIn || !pendingInvite) return;
    clearInvite(null);
    const timer = setTimeout(() => router.push(`/family/join?code=${encodeURIComponent(pendingInvite)}`), 0);
    return () => clearTimeout(timer);
  }, [isSignedIn, pendingInvite, clearInvite]);

  if (session.isLoading) return null;

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="purchase/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="invoice/payment" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="review/dispute" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="review/resolve" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}
