import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { AppError } from '../src/data/errors';
import { getAuth } from './auth';
import { getDb } from './db/client';
import { isOperation, runOperation } from './operations';

const STATUS_BY_CODE: Record<string, 400 | 401 | 403 | 404 | 409> = {
  forbidden: 403,
  unauthorized: 401,
  not_found: 404,
  email_taken: 409,
};

export const app = new Hono().basePath('/api');

app.use(
  '*',
  cors({
    origin: (origin) => origin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['set-auth-token'],
    maxAge: 86400,
  }),
);

/** Checks the function, the database and the auth setup without exposing data. */
app.get('/health', async (c) => {
  const checks: Record<string, string> = { api: 'ok' };
  try {
    await getDb().execute(sql`select 1`);
    checks.database = 'ok';
  } catch (error) {
    checks.database = describe(error);
  }
  try {
    getAuth();
    checks.auth = 'ok';
  } catch (error) {
    checks.auth = describe(error);
  }
  const ok = Object.values(checks).every((value) => value === 'ok');
  return c.json({ ok, checks }, ok ? 200 : 503);
});

function describe(error: unknown): string {
  const cause = (error as { cause?: unknown }).cause;
  const message = cause instanceof Error ? cause.message : error instanceof Error ? error.message : String(error);
  // Never echo connection strings.
  return message.replace(/postgres(ql)?:\/\/\S+/g, 'postgres://***');
}

app.on(['GET', 'POST'], '/auth/*', (c) => getAuth().handler(c.req.raw));

/** Every app operation: `{ method: "purchases.create", args: [...] }`. */
app.post('/rpc', async (c) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new AppError('unauthorized', 'Sua sessão expirou. Entre de novo.');

  const body = (await c.req.json().catch(() => null)) as { method?: unknown; args?: unknown } | null;
  if (!body || !isOperation(body.method)) throw new AppError('not_found', 'Operação desconhecida.');
  const args = Array.isArray(body.args) ? body.args : [];
  if (args.length > 3) throw new AppError('validation', 'Parâmetros inválidos.');

  const result = await runOperation(getDb(), session.user.id, body.method, args);
  return c.json({ result });
});

app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message } }, STATUS_BY_CODE[error.code] ?? 400);
  }
  if (error instanceof HTTPException) return error.getResponse();
  // Database constraints are the last line of defense for the money rules.
  const pgCode = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (pgCode === '23514' || pgCode === '23505' || pgCode === '23503') {
    console.warn('[api] constraint rejected a write', error);
    return c.json({ error: { code: 'validation', message: 'Os dados não fecham. Confira os valores e tente de novo.' } }, 400);
  }
  console.error('[api] unexpected error', error);
  return c.json({ error: { code: 'internal', message: 'Algo deu errado no servidor. Tente de novo.' } }, 500);
});
