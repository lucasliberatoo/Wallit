import type { DisputeReason, ID, NotificationCategory, NotificationType, PurchaseReview, ReviewStatus } from './types';

/** How one purchase stands in an invoice review. */
export type LineReviewStatus = 'pending' | 'confirmed' | 'disputed';

export interface LineReviewState {
  status: LineReviewStatus;
  /** Members who still have to answer. */
  pendingMemberIds: ID[];
  /** Open disputes (not yet resolved by the holder). */
  disputes: PurchaseReview[];
}

/**
 * A purchase is confirmed when everyone involved who uses the app answered
 * and no dispute is open. People without an account (e.g. the grandmother)
 * don't block the review.
 */
export function lineReviewState(reviewerIds: readonly ID[], reviews: readonly PurchaseReview[]): LineReviewState {
  const latest = new Map<ID, PurchaseReview>();
  for (const review of reviews) latest.set(review.memberId, review);
  const disputes = [...latest.values()].filter((review) => review.status === 'disputed');
  const pendingMemberIds = reviewerIds.filter((id) => !latest.has(id));
  const status: LineReviewStatus = disputes.length > 0 ? 'disputed' : pendingMemberIds.length > 0 ? 'pending' : 'confirmed';
  return { status, pendingMemberIds, disputes };
}

export interface ReviewProgress {
  total: number;
  confirmed: number;
  pending: number;
  disputed: number;
  /** 0-1 */
  progress: number;
}

export function reviewProgress(states: readonly Pick<LineReviewState, 'status'>[]): ReviewProgress {
  const count = (status: LineReviewStatus) => states.filter((state) => state.status === status).length;
  const total = states.length;
  const confirmed = count('confirmed');
  return { total, confirmed, pending: count('pending'), disputed: count('disputed'), progress: total === 0 ? 1 : confirmed / total };
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus | 'pending', string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  disputed: 'Contestada',
  resolved: 'Revisada',
};

export const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = {
  not_recognized: 'Não reconheço esta compra',
  not_mine: 'Não é minha',
  wrong_amount: 'Valor errado',
  wrong_split: 'Divisão errada',
  other: 'Outro motivo',
};

export const NOTIFICATION_CATEGORY: Record<NotificationType, NotificationCategory> = {
  review_started: 'review',
  dispute_opened: 'review',
  dispute_resolved: 'review',
  amount_defined: 'amounts',
  payment_registered: 'payments',
  payment_confirmed: 'payments',
  payment_rejected: 'payments',
  purchase_added: 'purchases',
  due_reminder: 'reminders',
};

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, { title: string; description: string }> = {
  review: { title: 'Conferência', description: 'Fatura pronta para conferir e compras contestadas' },
  amounts: { title: 'Sua parte', description: 'Quando o valor que você deve é definido' },
  payments: { title: 'Pagamentos', description: 'Pagamentos marcados, confirmados ou recusados' },
  purchases: { title: 'Novas compras', description: 'Compras em que você paga uma parte' },
  reminders: { title: 'Lembretes', description: 'Vencimento da fatura chegando' },
};

/** Days before the due date when members still owing get a reminder. */
export const DUE_REMINDER_DAYS = 2;
