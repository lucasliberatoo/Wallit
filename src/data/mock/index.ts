import type { Repositories } from '../repositories';
import { createMockAuthRepository } from './auth-repository';
import { createMockCardRepository, createMockWalletRepository } from './card-repository';
import { createMockFamilyRepository } from './family-repository';
import { createMockInvoiceRepository } from './invoice-repository';
import { createMockCategoryRepository, createMockDashboardRepository, createMockPaymentRepository } from './misc-repositories';
import { createMockPurchaseRepository } from './purchase-repository';
import { seedMockDatabase } from './seed';
import { MockStore } from './store';

export { DEMO_ACCOUNT } from './seed';

export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories & { reset: () => Promise<void> } {
  const store = new MockStore(seedMockDatabase, options.latencyMs);
  return {
    auth: createMockAuthRepository(store),
    families: createMockFamilyRepository(store),
    wallets: createMockWalletRepository(store),
    cards: createMockCardRepository(store),
    invoices: createMockInvoiceRepository(store),
    purchases: createMockPurchaseRepository(store),
    categories: createMockCategoryRepository(store),
    payments: createMockPaymentRepository(store),
    dashboard: createMockDashboardRepository(store),
    reset: () => store.reset(),
  };
}
