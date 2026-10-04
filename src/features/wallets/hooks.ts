import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useWallets(familyId: string | undefined) {
  const { wallets } = useRepositories();
  return useQuery({ queryKey: queryKeys.wallets(familyId ?? ''), queryFn: () => wallets.list(familyId!), enabled: Boolean(familyId) });
}

export function useWallet(walletId: string | undefined) {
  const { wallets } = useRepositories();
  return useQuery({ queryKey: queryKeys.wallet(walletId ?? ''), queryFn: () => wallets.get(walletId!), enabled: Boolean(walletId) });
}

export function useCreateWallet() {
  const { wallets } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: wallets.create, onSuccess: invalidate });
}
