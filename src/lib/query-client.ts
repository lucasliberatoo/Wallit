import { QueryClient } from '@tanstack/react-query';

import { AppError } from '@/data';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => !(error instanceof AppError) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}
