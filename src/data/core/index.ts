import type { Repositories } from '../repositories';
import { createAuthRepository } from './auth-repository';
import { createCardRepository, createWalletRepository } from './card-repository';
import { createFamilyRepository } from './family-repository';
import { createInvoiceRepository } from './invoice-repository';
import { createCategoryRepository, createDashboardRepository, createPaymentRepository } from './misc-repositories';
import { createPurchaseRepository } from './purchase-repository';
import type { Store } from './store';

export { Store, type Persistence, newId, nowISO } from './store';
export { emptyDatabase, DATABASE_VERSION, type Database, type Collection, type StoredUser, type Invite } from './database';
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
    dashboard: createDashboardRepository(store),
  };
}
