import { createHttpRepositories } from './http';
import { createMockRepositories } from './mock';
import type { Repositories } from './repositories';

export * from './errors';
export * from './models';
export type * from './repositories';
export { DEMO_ACCOUNT } from './mock';

/**
 * Picks the backend. With EXPO_PUBLIC_API_URL set (e.g. "/api" on the web,
 * or the full Vercel URL in the APK) the app uses the real API; without it,
 * the offline mock with demo data, which is handy for development.
 */
export function createRepositories(): Repositories & { reset?: () => Promise<void> } {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  return apiUrl ? createHttpRepositories(apiUrl) : createMockRepositories();
}

export const usingRemoteBackend = Boolean(process.env.EXPO_PUBLIC_API_URL);
