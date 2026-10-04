import type { Cents } from './money';
import type { InvoiceRef } from './invoice-period';

export type ID = string;
/** ISO date, YYYY-MM-DD. */
export type ISODate = string;
/** ISO timestamp. */
export type ISODateTime = string;

export type Role = 'owner' | 'titular' | 'member' | 'guest';

export interface User {
  id: ID;
  name: string;
  email: string;
  avatarColor: string;
  pixKey?: string;
  /** Profile photo as a small JPEG data URL (see PROFILE_PHOTO_MAX_LENGTH). */
  photo?: string;
  /** Kinds of notification the user turned off; everything else is on. */
  notificationPrefs?: NotificationPrefs;
}

/** A 256×256 JPEG fits comfortably; anything bigger is rejected. */
export const PROFILE_PHOTO_MAX_LENGTH = 200_000;

export interface Family {
  id: ID;
  name: string;
  color: string;
  createdBy: ID;
  createdAt: ISODateTime;
}

export type MemberStatus = 'active' | 'removed';

/**
 * A person inside a family. `userId` is null for people who don't use the
 * app (e.g. a grandmother whose purchases someone else registers); they can be
 * linked to an account later.
 */
export interface FamilyMember {
  id: ID;
  familyId: ID;
  userId: ID | null;
  displayName: string;
  nickname?: string;
  role: Role;
  avatarColor: string;
  /** Copied from the linked user's profile. */
  photo?: string;
  status: MemberStatus;
  joinedAt: ISODateTime;
}

export interface Wallet {
  id: ID;
  familyId: ID;
  name: string;
  createdAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export type CardTheme = 'midnight' | 'ocean' | 'sunset' | 'gold' | 'graphite' | 'violet';
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other';
export type CardStatus = 'active' | 'blocked' | 'archived';

/** Never stores card number, CVV, password or bank data. */
export interface Card {
  id: ID;
  familyId: ID;
  walletId: ID;
  name: string;
  holderMemberId: ID;
  theme: CardTheme;
  brand?: CardBrand;
  limitCents?: Cents;
  closingDay: number;
  dueDay: number;
  status: CardStatus;
  createdAt: ISODateTime;
}

export type InvoiceStatus = 'open' | 'reviewing' | 'closed' | 'collecting' | 'paid' | 'archived';

export interface Invoice {
  id: ID;
  familyId: ID;
  cardId: ID;
  ref: InvoiceRef;
  closingDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
}

export interface Category {
  id: ID;
  familyId: ID;
  name: string;
  icon: string;
  color: string;
  order: number;
  deletedAt?: ISODateTime;
}

export type PurchaseStatus = 'active' | 'cancelled';

export interface Purchase {
  id: ID;
  familyId: ID;
  cardId: ID;
  /** Name the user knows the place by, e.g. "Mercado Três Amigos". */
  merchant: string;
  /** Name printed on the bank statement, e.g. "JANUARIO DA SILVEIRA". */
  statementName?: string;
  totalCents: Cents;
  date: ISODate;
  categoryId: ID;
  buyerMemberId: ID;
  installmentCount: number;
  note?: string;
  status: PurchaseStatus;
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PurchaseShare {
  id: ID;
  purchaseId: ID;
  memberId: ID;
  amountCents: Cents;
}

export interface PurchaseInstallment {
  id: ID;
  purchaseId: ID;
  invoiceId: ID;
  number: number;
  count: number;
  amountCents: Cents;
}

/**
 * A member marks a transfer as `pending`; it only counts as received once the
 * card holder confirms it. Payments the holder registers are confirmed at once.
 */
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface Payment {
  id: ID;
  invoiceId: ID;
  memberId: ID;
  amountCents: Cents;
  paidAt: ISODateTime;
  registeredBy: ID;
  note?: string;
  status: PaymentStatus;
  /** User who confirmed or rejected it. */
  reviewedBy?: ID;
  reviewedAt?: ISODateTime;
}

/** A member's answer during an invoice review ("conferência") for one purchase. */
export type ReviewStatus = 'confirmed' | 'disputed' | 'resolved';

export type DisputeReason = 'not_recognized' | 'not_mine' | 'wrong_amount' | 'wrong_split' | 'other';

export interface PurchaseReview {
  id: ID;
  familyId: ID;
  invoiceId: ID;
  purchaseId: ID;
  memberId: ID;
  status: ReviewStatus;
  reason?: DisputeReason;
  note?: string;
  /** The holder's answer when closing a dispute. */
  resolutionNote?: string;
  resolvedBy?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** "JANUARIO DA SILVEIRA" on the statement is "Mercado Três Amigos" for the family. */
export interface MerchantAlias {
  id: ID;
  familyId: ID;
  /** Normalized statement name (see normalizeStatementName). */
  statementName: string;
  merchant: string;
  createdBy: ID;
  createdAt: ISODateTime;
}

/** A file attached to a purchase (receipt, screenshot) or to a dispute. */
export interface Attachment {
  id: ID;
  familyId: ID;
  purchaseId: ID;
  reviewId?: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdBy: ID;
  createdAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export type NotificationType =
  | 'review_started'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'amount_defined'
  | 'payment_registered'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'purchase_added'
  | 'due_reminder';

/** Groups the user can turn on or off in the settings. */
export type NotificationCategory = 'review' | 'amounts' | 'payments' | 'purchases' | 'reminders';

export type NotificationPrefs = Partial<Record<NotificationCategory, boolean>>;

export interface AppNotification {
  id: ID;
  familyId: ID;
  recipientMemberId: ID;
  type: NotificationType;
  title: string;
  body: string;
  /** App route opened when the notification is tapped. */
  link?: string;
  /** Prevents the same reminder from being sent twice. */
  dedupeKey?: string;
  createdAt: ISODateTime;
  readAt?: ISODateTime;
}

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'cancelled'
  | 'removed'
  | 'status_changed'
  | 'payment_registered'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'review_confirmed'
  | 'review_disputed'
  | 'dispute_resolved';

export interface AuditLog {
  id: ID;
  familyId: ID;
  entity: 'purchase' | 'invoice' | 'payment' | 'card' | 'wallet' | 'member' | 'family' | 'category' | 'alias' | 'attachment';
  entityId: ID;
  action: AuditAction;
  summary: string;
  changes: FieldChange[];
  actorUserId: ID;
  at: ISODateTime;
}
