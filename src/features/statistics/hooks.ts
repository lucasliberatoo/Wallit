import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { StatisticsFilters } from '@/data';
import { queryKeys } from '@/lib/query-keys';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useStatistics(familyId: string | undefined, filters: StatisticsFilters) {
  const { statistics } = useRepositories();
  return useQuery({
    queryKey: queryKeys.statistics(familyId ?? '', filters),
    queryFn: () => statistics.get(familyId!, filters),
    enabled: Boolean(familyId),
    // Changing a filter keeps the previous charts on screen while loading.
    placeholderData: keepPreviousData,
  });
}
