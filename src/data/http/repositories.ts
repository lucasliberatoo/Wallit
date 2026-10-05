import type { NotificationPrefs, User } from '../../domain';
import { AppError } from '../errors';
import type { Session } from '../models';
import type { AuthOptions, AuthRepository, PushRepository, Repositories } from '../repositories';
import { ApiClient, type TokenStorage } from './client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor?: string | null;
  pixKey?: string | null;
  image?: string | null;
  notificationPrefs?: NotificationPrefs | string | null;
}

/** JSON fields may come back as text from the auth endpoints. */
function prefsOf(value: AuthUser['notificationPrefs']): NotificationPrefs | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as NotificationPrefs;
  } catch {
    return undefined;
  }
}

const toUser = (user: AuthUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarColor: user.avatarColor ?? '#155EEF',
  pixKey: user.pixKey ?? undefined,
  photo: user.image ?? undefined,
  notificationPrefs: prefsOf(user.notificationPrefs),
});

function createHttpAuthRepository(api: ApiClient): AuthRepository {
  const startSession = async (path: string, body: unknown, onError: (code?: string) => AppError): Promise<Session> => {
    const { status, data } = await api.request<{ token?: string; user?: AuthUser; code?: string }>(path, { method: 'POST', body });
    if (status >= 300 || !data?.token || !data.user) throw onError(data?.code);
    await api.setToken(data.token);
    return { user: toUser(data.user) };
  };

  const repository: AuthRepository = {
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
      startSession(
        '/auth/sign-in/email',
        { email: email.trim().toLowerCase(), password },
        () => new AppError('invalid_credentials', 'Email ou senha incorretos.'),
      ),

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

    async requestPasswordReset(email, redirectTo) {
      const { status } = await api.request('/auth/request-password-reset', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), redirectTo },
      });
      if (status >= 300) throw new AppError('internal', 'Não foi possível enviar o link agora. Tente de novo.');
    },

    async resetPassword(token, newPassword) {
      const { status, data } = await api.request<{ code?: string }>('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      });
      if (status < 300) return;
      if (data?.code === 'INVALID_TOKEN')
        throw new AppError('validation', 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
      throw new AppError('validation', 'Não foi possível trocar a senha. Confira a nova senha e tente de novo.');
    },

    async options() {
      try {
        const { status, data } = await api.request<AuthOptions>('/auth-options');
        if (status < 300 && data) return { google: Boolean(data.google), passwordResetEmail: Boolean(data.passwordResetEmail) };
      } catch {
        // Offline: only email and password.
      }
      return { google: false, passwordResetEmail: false };
    },

    async googleSignInUrl(callbackURL, errorCallbackURL) {
      const { status, data } = await api.request<{ url?: string }>('/auth/sign-in/social', {
        method: 'POST',
        body: { provider: 'google', callbackURL, errorCallbackURL, disableRedirect: true },
        cookies: true,
      });
      if (status >= 300 || !data?.url) throw new AppError('internal', 'O login com Google não está disponível agora.');
      return data.url;
    },

    async completeBrowserSignIn() {
      const { status, data } = await api.request<{ user: AuthUser; session: { token: string } } | null>('/auth/get-session', {
        cookies: true,
      });
      if (status >= 300 || !data?.session?.token) throw new AppError('unauthorized', 'Não foi possível entrar com o Google. Tente de novo.');
      await api.setToken(data.session.token);
      return { session: { user: toUser(data.user) }, token: data.session.token };
    },

    async signInWithToken(token) {
      await api.setToken(token);
      const session = await repository.getSession();
      if (!session) throw new AppError('unauthorized', 'Não foi possível entrar com o Google. Tente de novo.');
      return session;
    },

    updateProfile: (changes) => api.rpc('auth.updateProfile', [changes]),
  };
  return repository;
}

function createHttpPushRepository(api: ApiClient): PushRepository {
  const post = async (path: string, body: unknown) => {
    const { status, data } = await api.request<{ error?: { message?: string } }>(path, { method: 'POST', body });
    if (status >= 300) throw new AppError('internal', data?.error?.message ?? 'Não foi possível ativar as notificações.');
  };
  return {
    async publicKey() {
      const { status, data } = await api.request<{ publicKey?: string }>('/push/key');
      return status < 300 && data?.publicKey ? data.publicKey : null;
    },
    subscribe: (subscription) => post('/push/subscribe', subscription),
    unsubscribe: (endpoint) => post('/push/unsubscribe', { endpoint }),
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
    reviews: remote(api, 'reviews'),
    aliases: remote(api, 'aliases'),
    notifications: remote(api, 'notifications'),
    statistics: remote(api, 'statistics'),
    reports: remote(api, 'reports'),
    attachments: remote(api, 'attachments'),
    push: createHttpPushRepository(api),
    dashboard: remote(api, 'dashboard'),
  };
}
