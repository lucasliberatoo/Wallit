import type { Family } from '../../domain';
import type { NotificationRepository } from '../repositories';
import { nowISO, type Store } from './store';

const LIST_LIMIT = 60;

export function createNotificationRepository(store: Store): NotificationRepository {
  /** The signed-in user's member ids across all their families. */
  const myMemberIds = () => {
    const userId = store.currentUserId();
    return new Set(store.db.members.filter((m) => m.userId === userId && m.status === 'active').map((m) => m.id));
  };
  const mine = () => {
    const ids = myMemberIds();
    return store.db.notifications.filter((n) => ids.has(n.recipientMemberId));
  };

  return {
    list: () =>
      store.run(() =>
        mine()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, LIST_LIMIT)
          .map((notification) => ({
            ...notification,
            familyName: (store.find('families', notification.familyId) as Family | undefined)?.name ?? '',
          })),
      ),

    unreadCount: () => store.run(() => mine().filter((n) => !n.readAt).length),

    markRead: (ids) =>
      store.run(
        () => {
          const now = nowISO();
          const only = ids ? new Set(ids) : null;
          for (const notification of mine()) {
            if (!notification.readAt && (!only || only.has(notification.id))) notification.readAt = now;
          }
        },
        { write: true },
      ),
  };
}
