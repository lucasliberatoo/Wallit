import type {
  AuditLog,
  Card,
  Category,
  Family,
  FamilyMember,
  ID,
  ISODateTime,
  Invoice,
  Payment,
  Purchase,
  PurchaseInstallment,
  PurchaseShare,
  User,
  Wallet,
} from '../../domain';

/**
 * A user as the repositories see it. `password` only exists in the offline
 * mock; on the server, credentials live in Better Auth's tables.
 */
export interface StoredUser extends User {
  password?: string;
}

export interface Invite {
  code: string;
  familyId: ID;
  createdAt: ISODateTime;
}

export interface Database {
  version: number;
  /** The signed-in user. On the server it is set per request from the session. */
  sessionUserId: ID | null;
  users: StoredUser[];
  families: Family[];
  members: FamilyMember[];
  invites: Invite[];
  wallets: Wallet[];
  cards: Card[];
  invoices: Invoice[];
  categories: Category[];
  purchases: Purchase[];
  shares: PurchaseShare[];
  installments: PurchaseInstallment[];
  payments: Payment[];
  auditLogs: AuditLog[];
}

export const DATABASE_VERSION = 1;

/** Collections that hold rows (everything except metadata). */
export type Collection = Exclude<keyof Database, 'version' | 'sessionUserId'>;

export function emptyDatabase(): Database {
  return {
    version: DATABASE_VERSION,
    sessionUserId: null,
    users: [],
    families: [],
    members: [],
    invites: [],
    wallets: [],
    cards: [],
    invoices: [],
    categories: [],
    purchases: [],
    shares: [],
    installments: [],
    payments: [],
    auditLogs: [],
  };
}
