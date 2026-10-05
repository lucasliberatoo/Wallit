import type { Repositories } from '../repositories';
import { createAuthRepository } from './auth-repository';
import { createCardRepository, createWalletRepository } from './card-repository';
import { createFamilyRepository } from './family-repository';
import { createInvoiceRepository } from './invoice-repository';
import { createAliasRepository } from './alias-repository';
import { createAttachmentRepository } from './attachment-repository';
import { createCategoryRepository, createDashboardRepository } from './misc-repositories';
import { createNotificationRepository } from './notification-repository';
import { createPaymentRepository } from './payment-repository';
import { createPurchaseRepository } from './purchase-repository';
import { createReportRepository } from './report-repository';
import { createReviewRepository } from './review-repository';
import { createStatisticsRepository } from './statistics-repository';
import type { Store } from './store';

export { Store, type Persistence, newId, nowISO } from './store';
export { createDueReminders } from './reminders';
export { emptyDatabase, migrateDatabase, DATABASE_VERSION, type Database, type Collection, type StoredUser, type Invite } from './database';
export { seedDemoDatabase, DEMO_ACCOUNT } from './seed';

/** Business rules shared by the offline mock and the server API. */
export function createCoreRepositories(store: Store): Repositories {
  return {
    auth: createAuthRepository(store),
    families: createFamilyRepository(store),
    wallets: createWalletRepository(store),
    cards: createCardRepository(store),
    invoices: createInvoiceRepository(store),
    purchases: createPurchaseRepository(store),
    categories: createCategoryRepository(store),
    payments: createPaymentRepository(store),
    reviews: createReviewRepository(store),
    aliases: createAliasRepository(store),
    notifications: createNotificationRepository(store),
    statistics: createStatisticsRepository(store),
    reports: createReportRepository(store),
    attachments: createAttachmentRepository(store),
    // Push needs a server; the offline demo only has in-app notifications.
    push: { publicKey: async () => null, subscribe: async () => undefined, unsubscribe: async () => undefined },
    dashboard: createDashboardRepository(store),
  };
}
