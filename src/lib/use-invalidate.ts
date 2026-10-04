import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Financial data is highly connected (a purchase changes invoices, cards,
 * balances and home totals), so writes refresh every data query except the session.
 */
export function useInvalidateData() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'session' }),
    [queryClient],
  );
}
