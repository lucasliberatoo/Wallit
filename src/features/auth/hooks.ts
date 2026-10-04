import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SignUpInput } from '@/data';
import { queryKeys } from '@/lib/query-keys';
import { useRepositories } from '@/providers/RepositoriesProvider';
import { useSelectionStore } from '@/stores/selection-store';

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
  });
}

export function useRequestPasswordReset() {
  const { auth } = useRepositories();
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) });
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
