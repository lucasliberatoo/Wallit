import type { HistoryFilters, StatisticsFilters } from '@/data';

/** Centralized query keys so invalidation stays consistent. */
export const queryKeys = {
  session: ['session'] as const,
  families: ['families'] as const,
  family: (familyId: string) => ['families', familyId] as const,
  members: (familyId: string) => ['families', familyId, 'members'] as const,
  home: (familyId: string) => ['families', familyId, 'home'] as const,
  activity: (familyId: string) => ['families', familyId, 'activity'] as const,
  wallets: (familyId: string) => ['families', familyId, 'wallets'] as const,
  wallet: (walletId: string) => ['wallets', walletId] as const,
  familyCards: (familyId: string) => ['families', familyId, 'cards'] as const,
  card: (cardId: string) => ['cards', cardId] as const,
  cardInvoices: (cardId: string) => ['cards', cardId, 'invoices'] as const,
  familyInvoices: (familyId: string) => ['families', familyId, 'invoices'] as const,
  invoice: (invoiceId: string) => ['invoices', invoiceId] as const,
  categories: (familyId: string) => ['families', familyId, 'categories'] as const,
  purchase: (purchaseId: string) => ['purchases', purchaseId] as const,
  purchases: (familyId: string, filters: HistoryFilters) => ['families', familyId, 'purchases', filters] as const,
  aliases: (familyId: string) => ['families', familyId, 'aliases'] as const,
  statistics: (familyId: string, filters: StatisticsFilters) => ['families', familyId, 'statistics', filters] as const,
  notifications: ['notifications'] as const,
  unreadNotifications: ['notifications', 'unread'] as const,
  attachment: (attachmentId: string) => ['attachments', attachmentId] as const,
  pushKey: ['push', 'key'] as const,
};
