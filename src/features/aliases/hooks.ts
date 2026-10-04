import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useAliases(familyId: string | undefined) {
  const { aliases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.aliases(familyId ?? ''),
    queryFn: () => aliases.list(familyId!),
    enabled: Boolean(familyId),
  });
}

export function useSaveAlias() {
  const { aliases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ familyId, statementName, merchant }: { familyId: string; statementName: string; merchant: string }) =>
      aliases.save(familyId, statementName, merchant),
    onSuccess: invalidate,
  });
}

export function useRemoveAlias() {
  const { aliases } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (aliasId: string) => aliases.remove(aliasId), onSuccess: invalidate });
}
