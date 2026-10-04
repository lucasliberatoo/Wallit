import type {
  AppNotification,
  Attachment,
  AuditLog,
  Card,
  Category,
  Family,
  FamilyMember,
  ID,
  ISODateTime,
  Invoice,
  MerchantAlias,
  Payment,
  Purchase,
  PurchaseInstallment,
  PurchaseReview,
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
  reviews: PurchaseReview[];
  aliases: MerchantAlias[];
  attachments: Attachment[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  /**
   * Attachment contents (data URLs) by attachment id. Kept apart from the
   * rows: the server only loads the one being opened.
   */
  blobs: Record<ID, string>;
}

export const DATABASE_VERSION = 2;

/** Collections that hold rows (everything except metadata and blobs). */
export type Collection = Exclude<keyof Database, 'version' | 'sessionUserId' | 'blobs'>;

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
    reviews: [],
    aliases: [],
    attachments: [],
    notifications: [],
    auditLogs: [],
    blobs: {},
  };
}

/** Upgrades a database saved by an older app version (offline mock). */
export function migrateDatabase(saved: Partial<Database> & { version: number }): Database | null {
  if (saved.version > DATABASE_VERSION) return null;
  const db = { ...emptyDatabase(), ...saved, version: DATABASE_VERSION } as Database;
  db.payments = db.payments.map((payment) => ({ ...payment, status: payment.status ?? 'confirmed' }));
  return db;
}
