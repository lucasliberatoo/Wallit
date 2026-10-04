import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useHomeSummary(familyId: string | undefined) {
  const { dashboard } = useRepositories();
  return useQuery({ queryKey: queryKeys.home(familyId ?? ''), queryFn: () => dashboard.home(familyId!), enabled: Boolean(familyId) });
}

export function useActivity(familyId: string | undefined) {
  const { dashboard } = useRepositories();
  return useQuery({
    queryKey: queryKeys.activity(familyId ?? ''),
    queryFn: () => dashboard.activity(familyId!),
    enabled: Boolean(familyId),
  });
}
