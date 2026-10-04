import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { useRepositories } from '@/providers/RepositoriesProvider';

/** How often the bell checks for news while the app is open. */
const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const { notifications } = useRepositories();
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => notifications.list() });
}

export function useUnreadCount(enabled = true) {
  const { notifications } = useRepositories();
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: () => notifications.unreadCount(),
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationsRead() {
  const { notifications } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => notifications.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
