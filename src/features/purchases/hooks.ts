import { useMutation, useQuery } from '@tanstack/react-query';

import type { CreatePurchaseInput, HistoryFilters, UpdatePurchaseInput } from '@/data';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function usePurchase(purchaseId: string | undefined) {
  const { purchases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.purchase(purchaseId ?? ''),
    queryFn: () => purchases.get(purchaseId!),
    enabled: Boolean(purchaseId),
  });
}

export function usePurchaseSearch(familyId: string | undefined, filters: HistoryFilters) {
  const { purchases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.purchases(familyId ?? '', filters),
    queryFn: () => purchases.search(familyId!, filters),
    enabled: Boolean(familyId),
    placeholderData: (previous) => previous,
  });
}

export function useCreatePurchase() {
  const { purchases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (input: CreatePurchaseInput) => purchases.create(input), onSuccess: invalidate });
}

export function useUpdatePurchase() {
  const { purchases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ purchaseId, changes }: { purchaseId: string; changes: UpdatePurchaseInput }) => purchases.update(purchaseId, changes),
    onSuccess: invalidate,
  });
}

export function useCancelPurchase() {
  const { purchases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (purchaseId: string) => purchases.cancel(purchaseId), onSuccess: invalidate });
}
