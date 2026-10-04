import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import type { FieldChange } from '../../src/domain';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// Better Auth tables (accounts and sessions). The `user` row is also the app's
// user profile: avatar color and PIX key are extra fields.
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  avatarColor: text('avatar_color').notNull().default('#155EEF'),
  pixKey: text('pix_key'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamptz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamptz('access_token_expires_at'),
    refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Wallit domain. Every row carries family_id so a request can load and lock
// exactly the families the signed-in user belongs to. Money is integer cents.
// ---------------------------------------------------------------------------

export const families = pgTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamptz('created_at').notNull(),
});

export const familyMembers = pgTable(
  'family_members',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    userId: text('user_id').references(() => user.id),
    displayName: text('display_name').notNull(),
    nickname: text('nickname'),
    role: text('role').notNull(),
    avatarColor: text('avatar_color').notNull(),
    status: text('status').notNull(),
    joinedAt: timestamptz('joined_at').notNull(),
  },
  (t) => [
    index('family_members_family_idx').on(t.familyId),
    index('family_members_user_idx').on(t.userId),
    uniqueIndex('family_members_family_user_uq').on(t.familyId, t.userId).where(sql`${t.userId} is not null`),
    check('family_members_role_ck', sql`${t.role} in ('owner', 'titular', 'member', 'guest')`),
    check('family_members_status_ck', sql`${t.status} in ('active', 'removed')`),
  ],
);

export const familyInvites = pgTable(
  'family_invites',
  {
    code: text('code').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    createdAt: timestamptz('created_at').notNull(),
  },
  (t) => [index('family_invites_family_idx').on(t.familyId)],
);

export const wallets = pgTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    name: text('name').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [index('wallets_family_idx').on(t.familyId)],
);

export const cards = pgTable(
  'cards',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id),
    name: text('name').notNull(),
    holderMemberId: text('holder_member_id')
      .notNull()
      .references(() => familyMembers.id),
    theme: text('theme').notNull(),
    brand: text('brand'),
    limitCents: integer('limit_cents'),
    closingDay: integer('closing_day').notNull(),
    dueDay: integer('due_day').notNull(),
    status: text('status').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (t) => [
    index('cards_family_idx').on(t.familyId),
    check('cards_closing_day_ck', sql`${t.closingDay} between 1 and 31`),
    check('cards_due_day_ck', sql`${t.dueDay} between 1 and 31`),
    check('cards_limit_ck', sql`${t.limitCents} is null or ${t.limitCents} > 0`),
    check('cards_status_ck', sql`${t.status} in ('active', 'blocked', 'archived')`),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id),
    refYear: integer('ref_year').notNull(),
    refMonth: integer('ref_month').notNull(),
    closingDate: date('closing_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text('status').notNull(),
  },
  (t) => [
    index('invoices_family_idx').on(t.familyId),
    uniqueIndex('invoices_card_ref_uq').on(t.cardId, t.refYear, t.refMonth),
    check('invoices_month_ck', sql`${t.refMonth} between 1 and 12`),
    check('invoices_status_ck', sql`${t.status} in ('open', 'reviewing', 'closed', 'collecting', 'paid', 'archived')`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [index('categories_family_idx').on(t.familyId)],
);

export const purchases = pgTable(
  'purchases',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id),
    merchant: text('merchant').notNull(),
    statementName: text('statement_name'),
    totalCents: integer('total_cents').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    buyerMemberId: text('buyer_member_id')
      .notNull()
      .references(() => familyMembers.id),
    installmentCount: integer('installment_count').notNull(),
    note: text('note'),
    status: text('status').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (t) => [
    index('purchases_family_idx').on(t.familyId),
    check('purchases_total_ck', sql`${t.totalCents} > 0`),
    check('purchases_installments_ck', sql`${t.installmentCount} between 1 and 48`),
    check('purchases_status_ck', sql`${t.status} in ('active', 'cancelled')`),
  ],
);

export const purchaseShares = pgTable(
  'purchase_shares',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    purchaseId: text('purchase_id')
      .notNull()
      .references(() => purchases.id),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [
    index('purchase_shares_family_idx').on(t.familyId),
    uniqueIndex('purchase_shares_member_uq').on(t.purchaseId, t.memberId),
    check('purchase_shares_amount_ck', sql`${t.amountCents} > 0`),
  ],
);

export const purchaseInstallments = pgTable(
  'purchase_installments',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    purchaseId: text('purchase_id')
      .notNull()
      .references(() => purchases.id),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    number: integer('number').notNull(),
    count: integer('count').notNull(),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [
    index('purchase_installments_family_idx').on(t.familyId),
    uniqueIndex('purchase_installments_number_uq').on(t.purchaseId, t.number),
    check('purchase_installments_number_ck', sql`${t.number} between 1 and ${t.count}`),
    check('purchase_installments_amount_ck', sql`${t.amountCents} > 0`),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id),
    amountCents: integer('amount_cents').notNull(),
    paidAt: timestamptz('paid_at').notNull(),
    registeredBy: text('registered_by')
      .notNull()
      .references(() => user.id),
    note: text('note'),
  },
  (t) => [index('payments_family_idx').on(t.familyId), check('payments_amount_ck', sql`${t.amountCents} > 0`)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    summary: text('summary').notNull(),
    changes: jsonb('changes').$type<FieldChange[]>().notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id),
    at: timestamptz('at').notNull(),
  },
  (t) => [index('audit_logs_family_idx').on(t.familyId, t.at)],
);
