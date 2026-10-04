import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useFamilyCards(familyId: string | undefined) {
  const { cards } = useRepositories();
  return useQuery({ queryKey: queryKeys.familyCards(familyId ?? ''), queryFn: () => cards.listByFamily(familyId!), enabled: Boolean(familyId) });
}

export function useCard(cardId: string | undefined) {
  const { cards } = useRepositories();
  return useQuery({ queryKey: queryKeys.card(cardId ?? ''), queryFn: () => cards.get(cardId!), enabled: Boolean(cardId) });
}

export function useCreateCard() {
  const { cards } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: cards.create, onSuccess: invalidate });
}
