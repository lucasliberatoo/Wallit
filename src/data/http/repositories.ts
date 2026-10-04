import type { User } from '../../domain';
import { AppError } from '../errors';
import type { Session } from '../models';
import type { AuthRepository, Repositories } from '../repositories';
import { ApiClient, type TokenStorage } from './client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor?: string | null;
  pixKey?: string | null;
}

const toUser = (user: AuthUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarColor: user.avatarColor ?? '#155EEF',
  pixKey: user.pixKey ?? undefined,
});

function createHttpAuthRepository(api: ApiClient): AuthRepository {
  const startSession = async (path: string, body: unknown, onError: (code?: string) => AppError): Promise<Session> => {
    const { status, data } = await api.request<{ token?: string; user?: AuthUser; code?: string }>(path, { method: 'POST', body });
    if (status >= 300 || !data?.token || !data.user) throw onError(data?.code);
    await api.setToken(data.token);
    return { user: toUser(data.user) };
  };

  return {
    async getSession() {
      if (!(await api.getToken())) return null;
      const { status, data } = await api.request<{ user: AuthUser } | null>('/auth/get-session');
      if (status === 401 || (status < 300 && !data)) {
        await api.setToken(null);
        return null;
      }
      if (status >= 300 || !data) throw new AppError('network', 'Não foi possível verificar sua sessão.');
      return { user: toUser(data.user) };
    },

    signIn: (email, password) =>
      startSession('/auth/sign-in/email', { email: email.trim().toLowerCase(), password }, () => new AppError('invalid_credentials', 'Email ou senha incorretos.')),

    signUp: ({ name, email, password }) =>
      startSession('/auth/sign-up/email', { name: name.trim(), email: email.trim().toLowerCase(), password }, (code) =>
        code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
          ? new AppError('email_taken', 'Já existe uma conta com este email.')
          : new AppError('validation', 'Não foi possível criar a conta. Confira os dados.'),
      ),

    async signOut() {
      await api.request('/auth/sign-out', { method: 'POST', body: {} }).catch(() => undefined);
      await api.setToken(null);
    },

    async requestPasswordReset(email) {
      await api.request('/auth/request-password-reset', { method: 'POST', body: { email: email.trim().toLowerCase() } });
    },

    updateProfile: (changes) => api.rpc('auth.updateProfile', [changes]),
  };
}

/** Builds a repository whose every method is forwarded to the API as `repo.method`. */
function remote<T extends object>(api: ApiClient, name: string): T {
  return new Proxy({} as T, {
    get: (_target, method) => (typeof method === 'string' ? (...args: unknown[]) => api.rpc(`${name}.${method}`, args) : undefined),
  });
}

/** Backend implementation over the Wallit API (Vercel Functions + Neon). */
export function createHttpRepositories(apiUrl: string, tokens: TokenStorage): Repositories {
  const api = new ApiClient(apiUrl.replace(/\/$/, ''), tokens);
  return {
    auth: createHttpAuthRepository(api),
    families: remote(api, 'families'),
    wallets: remote(api, 'wallets'),
    cards: remote(api, 'cards'),
    invoices: remote(api, 'invoices'),
    purchases: remote(api, 'purchases'),
    categories: remote(api, 'categories'),
    payments: remote(api, 'payments'),
    dashboard: remote(api, 'dashboard'),
  };
}
