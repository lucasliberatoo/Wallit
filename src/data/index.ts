import { createMockRepositories } from './mock';
import type { Repositories } from './repositories';

export * from './errors';
export * from './models';
export type * from './repositories';
export { DEMO_ACCOUNT } from './mock';

/**
 * Picks the backend implementation. Today: offline mock with seed data.
 * When the HTTP API is deployed, an `http` implementation of the same
 * interfaces is selected here via EXPO_PUBLIC_API_URL.
 */
export function createRepositories(): Repositories & { reset?: () => Promise<void> } {
  return createMockRepositories();
}
