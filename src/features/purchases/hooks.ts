import { useMutation, useQuery } from '@tanstack/react-query';

import type { CreatePurchaseInput, HistoryFilters, ScenarioInput, UpdatePurchaseInput } from '@/data';
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

export function useAnticipateInstallments() {
  const { purchases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ purchaseId, count }: { purchaseId: string; count: number }) => purchases.anticipate(purchaseId, count),
    onSuccess: invalidate,
  });
}

/** Simulated scenario: recalculated as the inputs change, nothing is saved. */
export function useScenarioSimulation(input: ScenarioInput | null) {
  const { purchases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.simulation(input),
    queryFn: () => purchases.simulateScenario(input!),
    enabled: input !== null,
    placeholderData: (previous) => previous,
  });
}

export function useAnticipationSimulation(purchaseId: string, count: number) {
  const { purchases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.anticipationSimulation(purchaseId, count),
    queryFn: () => purchases.simulateAnticipation(purchaseId, count),
    enabled: count > 0,
    placeholderData: (previous) => previous,
  });
}
