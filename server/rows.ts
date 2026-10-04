import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Collection, Database, Invite, StoredUser } from '../src/data/core';
import type {
  AuditLog,
  Card,
  Category,
  Family,
  FamilyMember,
  Invoice,
  Payment,
  Purchase,
  PurchaseInstallment,
  PurchaseShare,
  Wallet,
} from '../src/domain';
import * as t from './db/schema';

/**
 * Translates between the rows in Postgres and the objects the shared
 * repositories work with. Optional fields are left out (not null) so an
 * unchanged object compares equal after a round trip.
 */
export interface Mapper<D, R extends Record<string, unknown>> {
  table: PgTable;
  key: AnyPgColumn;
  keyOf(item: D): string;
  fromRow(row: R): D;
  toRow(item: D, db: Database): R;
}

const iso = (value: Date) => value.toISOString();
const optional = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);
const date = (value: string | undefined) => (value === undefined ? null : new Date(value));

function familyOfPurchase(db: Database, purchaseId: string): string {
  const purchase = db.purchases.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error(`Purchase ${purchaseId} not loaded`);
  return purchase.familyId;
}

function familyOfInvoice(db: Database, invoiceId: string): string {
  const invoice = db.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not loaded`);
  return invoice.familyId;
}

const families: Mapper<Family, typeof t.families.$inferInsert> = {
  table: t.families,
  key: t.families.id,
  keyOf: (f) => f.id,
  fromRow: (r) => ({ id: r.id, name: r.name, color: r.color, createdBy: r.createdBy, createdAt: iso(r.createdAt as Date) }),
  toRow: (f) => ({ id: f.id, name: f.name, color: f.color, createdBy: f.createdBy, createdAt: new Date(f.createdAt) }),
};

const members: Mapper<FamilyMember, typeof t.familyMembers.$inferInsert> = {
  table: t.familyMembers,
  key: t.familyMembers.id,
  keyOf: (m) => m.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    userId: r.userId ?? null,
    displayName: r.displayName,
    nickname: optional(r.nickname),
    role: r.role as FamilyMember['role'],
    avatarColor: r.avatarColor,
    photo: optional(r.photo),
    status: r.status as FamilyMember['status'],
    joinedAt: iso(r.joinedAt as Date),
  }),
  toRow: (m) => ({
    id: m.id,
    familyId: m.familyId,
    userId: m.userId,
    displayName: m.displayName,
    nickname: m.nickname ?? null,
    role: m.role,
    avatarColor: m.avatarColor,
    photo: m.photo ?? null,
    status: m.status,
    joinedAt: new Date(m.joinedAt),
  }),
};

const invites: Mapper<Invite, typeof t.familyInvites.$inferInsert> = {
  table: t.familyInvites,
  key: t.familyInvites.code,
  keyOf: (i) => i.code,
  fromRow: (r) => ({ code: r.code, familyId: r.familyId, createdAt: iso(r.createdAt as Date) }),
  toRow: (i) => ({ code: i.code, familyId: i.familyId, createdAt: new Date(i.createdAt) }),
};

const wallets: Mapper<Wallet, typeof t.wallets.$inferInsert> = {
  table: t.wallets,
  key: t.wallets.id,
  keyOf: (w) => w.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    name: r.name,
    createdAt: iso(r.createdAt as Date),
    deletedAt: r.deletedAt ? iso(r.deletedAt) : undefined,
  }),
  toRow: (w) => ({ id: w.id, familyId: w.familyId, name: w.name, createdAt: new Date(w.createdAt), deletedAt: date(w.deletedAt) }),
};

const cards: Mapper<Card, typeof t.cards.$inferInsert> = {
  table: t.cards,
  key: t.cards.id,
  keyOf: (c) => c.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    walletId: r.walletId,
    name: r.name,
    holderMemberId: r.holderMemberId,
    theme: r.theme as Card['theme'],
    brand: optional(r.brand) as Card['brand'],
    limitCents: optional(r.limitCents),
    closingDay: r.closingDay,
    dueDay: r.dueDay,
    status: r.status as Card['status'],
    createdAt: iso(r.createdAt as Date),
  }),
  toRow: (c) => ({
    id: c.id,
    familyId: c.familyId,
    walletId: c.walletId,
    name: c.name,
    holderMemberId: c.holderMemberId,
    theme: c.theme,
    brand: c.brand ?? null,
    limitCents: c.limitCents ?? null,
    closingDay: c.closingDay,
    dueDay: c.dueDay,
    status: c.status,
    createdAt: new Date(c.createdAt),
  }),
};

const invoices: Mapper<Invoice, typeof t.invoices.$inferInsert> = {
  table: t.invoices,
  key: t.invoices.id,
  keyOf: (i) => i.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    cardId: r.cardId,
    ref: { year: r.refYear, month: r.refMonth },
    closingDate: r.closingDate,
    dueDate: r.dueDate,
    status: r.status as Invoice['status'],
  }),
  toRow: (i) => ({
    id: i.id,
    familyId: i.familyId,
    cardId: i.cardId,
    refYear: i.ref.year,
    refMonth: i.ref.month,
    closingDate: i.closingDate,
    dueDate: i.dueDate,
    status: i.status,
  }),
};

const categories: Mapper<Category, typeof t.categories.$inferInsert> = {
  table: t.categories,
  key: t.categories.id,
  keyOf: (c) => c.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    name: r.name,
    icon: r.icon,
    color: r.color,
    order: r.sortOrder,
    deletedAt: r.deletedAt ? iso(r.deletedAt) : undefined,
  }),
  toRow: (c) => ({
    id: c.id,
    familyId: c.familyId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    sortOrder: c.order,
    deletedAt: date(c.deletedAt),
  }),
};

const purchases: Mapper<Purchase, typeof t.purchases.$inferInsert> = {
  table: t.purchases,
  key: t.purchases.id,
  keyOf: (p) => p.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    cardId: r.cardId,
    merchant: r.merchant,
    statementName: optional(r.statementName),
    totalCents: r.totalCents,
    date: r.date,
    categoryId: r.categoryId,
    buyerMemberId: r.buyerMemberId,
    installmentCount: r.installmentCount,
    note: optional(r.note),
    status: r.status as Purchase['status'],
    createdBy: r.createdBy,
    createdAt: iso(r.createdAt as Date),
    updatedAt: iso(r.updatedAt as Date),
  }),
  toRow: (p) => ({
    id: p.id,
    familyId: p.familyId,
    cardId: p.cardId,
    merchant: p.merchant,
    statementName: p.statementName ?? null,
    totalCents: p.totalCents,
    date: p.date,
    categoryId: p.categoryId,
    buyerMemberId: p.buyerMemberId,
    installmentCount: p.installmentCount,
    note: p.note ?? null,
    status: p.status,
    createdBy: p.createdBy,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  }),
};

const shares: Mapper<PurchaseShare, typeof t.purchaseShares.$inferInsert> = {
  table: t.purchaseShares,
  key: t.purchaseShares.id,
  keyOf: (s) => s.id,
  fromRow: (r) => ({ id: r.id, purchaseId: r.purchaseId, memberId: r.memberId, amountCents: r.amountCents }),
  toRow: (s, db) => ({
    id: s.id,
    familyId: familyOfPurchase(db, s.purchaseId),
    purchaseId: s.purchaseId,
    memberId: s.memberId,
    amountCents: s.amountCents,
  }),
};

const installments: Mapper<PurchaseInstallment, typeof t.purchaseInstallments.$inferInsert> = {
  table: t.purchaseInstallments,
  key: t.purchaseInstallments.id,
  keyOf: (i) => i.id,
  fromRow: (r) => ({
    id: r.id,
    purchaseId: r.purchaseId,
    invoiceId: r.invoiceId,
    number: r.number,
    count: r.count,
    amountCents: r.amountCents,
  }),
  toRow: (i, db) => ({
    id: i.id,
    familyId: familyOfPurchase(db, i.purchaseId),
    purchaseId: i.purchaseId,
    invoiceId: i.invoiceId,
    number: i.number,
    count: i.count,
    amountCents: i.amountCents,
  }),
};

const payments: Mapper<Payment, typeof t.payments.$inferInsert> = {
  table: t.payments,
  key: t.payments.id,
  keyOf: (p) => p.id,
  fromRow: (r) => ({
    id: r.id,
    invoiceId: r.invoiceId,
    memberId: r.memberId,
    amountCents: r.amountCents,
    paidAt: iso(r.paidAt as Date),
    registeredBy: r.registeredBy,
    note: optional(r.note),
  }),
  toRow: (p, db) => ({
    id: p.id,
    familyId: familyOfInvoice(db, p.invoiceId),
    invoiceId: p.invoiceId,
    memberId: p.memberId,
    amountCents: p.amountCents,
    paidAt: new Date(p.paidAt),
    registeredBy: p.registeredBy,
    note: p.note ?? null,
  }),
};

const auditLogs: Mapper<AuditLog, typeof t.auditLogs.$inferInsert> = {
  table: t.auditLogs,
  key: t.auditLogs.id,
  keyOf: (a) => a.id,
  fromRow: (r) => ({
    id: r.id,
    familyId: r.familyId,
    entity: r.entity as AuditLog['entity'],
    entityId: r.entityId,
    action: r.action as AuditLog['action'],
    summary: r.summary,
    changes: r.changes,
    actorUserId: r.actorUserId,
    at: iso(r.at as Date),
  }),
  toRow: (a) => ({
    id: a.id,
    familyId: a.familyId,
    entity: a.entity,
    entityId: a.entityId,
    action: a.action,
    summary: a.summary,
    changes: a.changes,
    actorUserId: a.actorUserId,
    at: new Date(a.at),
  }),
};

export function userFromRow(r: typeof t.user.$inferSelect): StoredUser {
  return { id: r.id, name: r.name, email: r.email, avatarColor: r.avatarColor, pixKey: optional(r.pixKey), photo: optional(r.image) };
}

type FamilyCollection = Exclude<Collection, 'users'>;

/**
 * Family-scoped collections in foreign-key order: inserts go top to bottom,
 * deletes bottom to top.
 */
export const MAPPERS: { collection: FamilyCollection; mapper: Mapper<never, Record<string, unknown>> }[] = (
  [
    ['families', families],
    ['members', members],
    ['invites', invites],
    ['wallets', wallets],
    ['cards', cards],
    ['invoices', invoices],
    ['categories', categories],
    ['purchases', purchases],
    ['shares', shares],
    ['installments', installments],
    ['payments', payments],
    ['auditLogs', auditLogs],
  ] as const
).map(([collection, mapper]) => ({ collection, mapper: mapper as unknown as Mapper<never, Record<string, unknown>> }));
