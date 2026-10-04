import { AppError, type AppErrorCode } from '../errors';

/** Where the session token is kept between launches. */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}

/** Talks to the Wallit API on Vercel. The session token is sent as a bearer token. */
export class ApiClient {
  private token: string | null | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly storage: TokenStorage,
  ) {}

  async getToken(): Promise<string | null> {
    if (this.token === undefined) {
      try {
        this.token = await this.storage.get();
      } catch {
        this.token = null;
      }
    }
    return this.token;
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token;
    try {
      await this.storage.set(token);
    } catch {
      // Keeps working for this launch even if storage is unavailable.
    }
  }

  async request<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<{ status: number; data: T }> {
    const token = await this.getToken();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new AppError('network', 'Sem conexão com o servidor. Confira sua internet.');
    }
    const text = await response.text();
    try {
      return { status: response.status, data: (text ? JSON.parse(text) : null) as T };
    } catch {
      // Not JSON: the platform answered instead of the API (crash, timeout, wrong route).
      console.warn(`[api] ${init.method ?? 'GET'} ${path} -> ${response.status}: ${text.slice(0, 200)}`);
      throw new AppError('internal', `O servidor não respondeu direito (erro ${response.status}). Tente de novo em instantes.`);
    }
  }

  /** Calls one repository method on the server. */
  async rpc<T>(method: string, args: unknown[]): Promise<T> {
    const { status, data } = await this.request<{ result?: T; error?: { code: AppErrorCode; message: string } }>('/rpc', {
      method: 'POST',
      body: { method, args },
    });
    if (status >= 200 && status < 300 && data && 'result' in data) return data.result as T;
    if (status === 401) await this.setToken(null);
    throw new AppError(data?.error?.code ?? 'internal', data?.error?.message ?? 'Algo deu errado no servidor. Tente de novo.');
  }
}
