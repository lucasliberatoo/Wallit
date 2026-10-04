import AsyncStorage from '@react-native-async-storage/async-storage';

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
} from '@/domain';

/** Local-only account. Passwords exist here only because this is an offline mock. */
export interface MockUser extends User {
  password: string;
}

export interface MockInvite {
  code: string;
  familyId: ID;
  createdAt: ISODateTime;
}

export interface MockDatabase {
  version: number;
  sessionUserId: ID | null;
  users: MockUser[];
  families: Family[];
  members: FamilyMember[];
  invites: MockInvite[];
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
const STORAGE_KEY = 'wallit:mock-db';

export function emptyDatabase(): MockDatabase {
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

export async function loadDatabase(): Promise<MockDatabase | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockDatabase;
    return parsed.version === DATABASE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDatabase(db: MockDatabase): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Persistence is a convenience for the offline mock; the app keeps working in memory.
  }
}

export async function clearDatabase(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
