import type { Repositories } from '../repositories';
import { createCoreRepositories, seedDemoDatabase, Store } from '../core';
import { asyncStoragePersistence } from './persistence';

export { DEMO_ACCOUNT } from '../core';

/** Offline backend: the shared repositories over a database kept on the device. */
export function createMockRepositories(options: { latencyMs?: number } = {}): Repositories & { reset: () => Promise<void> } {
  const store = new Store({ persistence: asyncStoragePersistence, seed: seedDemoDatabase, latencyMs: options.latencyMs ?? 120 });
  return { ...createCoreRepositories(store), reset: () => store.reset() };
}
