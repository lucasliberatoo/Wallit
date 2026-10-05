import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { SignUpInput } from '@/data';
import { webBaseUrl } from '@/lib/invite-link';
import { queryKeys } from '@/lib/query-keys';
import { useRepositories } from '@/providers/RepositoriesProvider';
import { useSelectionStore } from '@/stores/selection-store';
import { updateWidget } from '@/widget/sync';

export function useSession() {
  const { auth } = useRepositories();
  return useQuery({ queryKey: queryKeys.session, queryFn: () => auth.getSession(), staleTime: Infinity });
}

export function useCurrentUser() {
  const session = useSession();
  return session.data?.user ?? null;
}

function useSessionMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const { auth } = useRepositories();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      queryClient.setQueryData(queryKeys.session, await auth.getSession());
    },
  });
}

export function useSignIn() {
  const { auth } = useRepositories();
  return useSessionMutation(({ email, password }: { email: string; password: string }) => auth.signIn(email, password));
}

export function useSignUp() {
  const { auth } = useRepositories();
  return useSessionMutation((input: SignUpInput) => auth.signUp(input));
}

export function useSignOut() {
  const { auth } = useRepositories();
  const setFamilyId = useSelectionStore((state) => state.setFamilyId);
  return useSessionMutation(async () => {
    await auth.signOut();
    setFamilyId(null);
    await updateWidget(null, null, false).catch(() => undefined);
  });
}

/** Sign-in options of this backend (Google, password reset by email). */
export function useAuthOptions() {
  const { auth } = useRepositories();
  return useQuery({ queryKey: ['auth-options'], queryFn: () => auth.options(), staleTime: Infinity });
}

export function useRequestPasswordReset() {
  const { auth } = useRepositories();
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email, `${webBaseUrl()}/redefinir-senha`) });
}

export function useResetPassword() {
  const { auth } = useRepositories();
  return useMutation({ mutationFn: ({ token, password }: { token: string; password: string }) => auth.resetPassword(token, password) });
}

/**
 * "Entrar com Google". On the web the page goes to Google and comes back to
 * /entrar/google. In the installed app the same page runs in the browser and
 * hands the session back through `wallit://entrar?token=…`.
 */
export function useGoogleSignIn() {
  const { auth } = useRepositories();
  return useSessionMutation(async () => {
    if (Platform.OS === 'web') {
      const origin = window.location.origin;
      const url = await auth.googleSignInUrl(`${origin}/entrar/google?done=1`, `${origin}/entrar/google?falha=1`);
      window.location.assign(url);
      // The page is leaving for Google.
      return new Promise<never>(() => undefined);
    }
    const result = await WebBrowser.openAuthSessionAsync(`${webBaseUrl()}/entrar/google?app=1`, Linking.createURL('entrar'));
    if (result.type !== 'success') return null;
    const token = Linking.parse(result.url).queryParams?.token;
    if (typeof token !== 'string' || !token) return null;
    return auth.signInWithToken(token);
  });
}

/** Finishes a browser sign-in: the session cookie left by Google becomes the app session. */
export function useCompleteBrowserSignIn() {
  const { auth } = useRepositories();
  return useSessionMutation(() => auth.completeBrowserSignIn());
}

/** Installed app: the browser handed a session token back through a link. */
export function useSignInWithToken() {
  const { auth } = useRepositories();
  return useSessionMutation((token: string) => auth.signInWithToken(token));
}

export function useUpdateProfile() {
  const { auth } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: auth.updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.session, { user });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    },
  });
}
