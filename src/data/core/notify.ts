import { type AppNotification, type ID, NOTIFICATION_CATEGORY, type NotificationType } from '../../domain';
import { newId, nowISO, type Store } from './store';

export interface NotifyInput {
  familyId: ID;
  /** Family members to notify; people without an account are skipped. */
  memberIds: readonly ID[];
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Same key + same person = sent only once (reminders). */
  dedupeKey?: string;
}

/**
 * Creates in-app notifications (the server also sends them as push). The
 * person who caused the event is never notified about it, and each person's
 * settings decide which kinds they get.
 */
export function notify(store: Store, input: NotifyInput): AppNotification[] {
  const actorUserId = store.db.sessionUserId;
  const category = NOTIFICATION_CATEGORY[input.type];
  const created: AppNotification[] = [];
  for (const memberId of new Set(input.memberIds)) {
    const member = store.db.members.find((m) => m.id === memberId && m.status === 'active');
    if (!member?.userId || member.userId === actorUserId) continue;
    const user = store.db.users.find((u) => u.id === member.userId);
    if (user?.notificationPrefs?.[category] === false) continue;
    if (input.dedupeKey && store.db.notifications.some((n) => n.dedupeKey === input.dedupeKey && n.recipientMemberId === memberId)) {
      continue;
    }
    const notification: AppNotification = {
      id: newId('ntf'),
      familyId: input.familyId,
      recipientMemberId: memberId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      dedupeKey: input.dedupeKey,
      createdAt: nowISO(),
    };
    store.db.notifications.push(notification);
    created.push(notification);
  }
  return created;
}
