import { useQuery } from '@tanstack/react-query';

import type { InvoiceRef } from '@/domain';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useMonthlyReport(familyId: string | undefined, ref: InvoiceRef) {
  const { reports } = useRepositories();
  return useQuery({
    queryKey: ['families', familyId ?? '', 'report', ref.year, ref.month],
    queryFn: () => reports.monthly(familyId!, ref),
    enabled: Boolean(familyId),
  });
}
