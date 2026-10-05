import { createHash } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { identityColors } from '../src/theme/colors';
import { databaseUrl, getDb } from './db/client';
import * as schema from './db/schema';
import { passwordResetEmail, sendMail } from './mail';

/**
 * BETTER_AUTH_SECRET signs sessions. When it isn't configured we derive one
 * from the database URL, which is itself a secret only the server knows, so a
 * fresh Vercel + Neon setup works without extra variables.
 */
function authSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? createHash('sha256').update(`wallit-auth:${databaseUrl()}`).digest('hex');
}

/** Links in emails (password reset) point at the production URL. */
function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : undefined;
}

function trustedOrigins(): string[] {
  const hosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
  const extra = (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean);
  return [...hosts.map((host) => `https://${host}`), ...extra, 'http://localhost:8081', 'wallit://'];
}

/** "Entrar com Google" is enabled once GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function googleProvider() {
  if (!googleConfigured()) return undefined;
  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: 'select_account' as const,
    },
  };
}

function createAuth() {
  return betterAuth({
    basePath: '/api/auth',
    baseURL: baseURL(),
    secret: authSecret(),
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({ to: user.email, ...passwordResetEmail(user.name, url) });
      },
    },
    socialProviders: googleProvider(),
    user: {
      additionalFields: {
        avatarColor: { type: 'string', required: false, input: false },
        pixKey: { type: 'string', required: false, input: false },
        notificationPrefs: { type: 'json', required: false, input: false },
      },
    },
    // Google confirms the email, so signing in with it reaches the existing account.
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, avatarColor: identityColors[Math.floor(Math.random() * identityColors.length)] },
          }),
        },
      },
    },
    plugins: [bearer()],
  });
}

let auth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
