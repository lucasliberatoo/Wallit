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

export interface Payment {
  id: ID;
  invoiceId: ID;
  memberId: ID;
  amountCents: Cents;
  paidAt: ISODateTime;
  registeredBy: ID;
  note?: string;
}

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export type AuditAction = 'created' | 'updated' | 'cancelled' | 'status_changed' | 'payment_registered';

export interface AuditLog {
  id: ID;
  familyId: ID;
  entity: 'purchase' | 'invoice' | 'payment' | 'card' | 'wallet' | 'member' | 'family' | 'category';
  entityId: ID;
  action: AuditAction;
  summary: string;
  changes: FieldChange[];
  actorUserId: ID;
  at: ISODateTime;
}
