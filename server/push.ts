import { createECDH, createHmac } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';

import { databaseUrl, type Db } from './db/client';
import * as t from './db/schema';

/** A notification ready to go out to every device of one user. */
export interface PushMessage {
  userId: string;
  id: string;
  title: string;
  body: string;
  link?: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let keys: VapidKeys | null = null;

/**
 * Web Push needs a key pair (VAPID). Like the auth secret, it is derived from
 * a secret the server already has, so push works without extra setup; set
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to use your own.
 */
export function vapidKeys(): VapidKeys {
  if (keys) return keys;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    keys = { publicKey, privateKey };
  } else {
    const seed = process.env.BETTER_AUTH_SECRET ?? databaseUrl();
    const derived = createHmac('sha256', 'wallit-vapid').update(seed).digest();
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(derived);
    keys = { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: derived.toString('base64url') };
  }
  return keys;
}

function subject(): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : 'mailto:contato@wallit.app';
}

export async function saveSubscription(db: Db, userId: string, input: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  await db
    .insert(t.pushSubscriptions)
    .values({ ...input, userId })
    .onConflictDoUpdate({ target: t.pushSubscriptions.endpoint, set: { userId, p256dh: input.p256dh, auth: input.auth } });
}

export async function removeSubscription(db: Db, userId: string, endpoint: string): Promise<void> {
  const rows = await db.select().from(t.pushSubscriptions).where(eq(t.pushSubscriptions.endpoint, endpoint));
  if (rows[0]?.userId === userId) await db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.endpoint, endpoint));
}

/**
 * Sends notifications to the users' installed web apps. Failures never
 * affect the request; subscriptions the browser revoked are dropped.
 */
export async function sendPushes(db: Db, messages: readonly PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const subscriptions = await db.select().from(t.pushSubscriptions).where(inArray(t.pushSubscriptions.userId, userIds));
    if (subscriptions.length === 0) return;
    const { publicKey, privateKey } = vapidKeys();
    const gone: string[] = [];
    await Promise.allSettled(
      messages.flatMap((message) =>
        subscriptions
          .filter((s) => s.userId === message.userId)
          .map((s) =>
            webpush
              .sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: message.title, body: message.body, url: message.link ?? '/', tag: message.id }),
                { TTL: 60 * 60 * 24, timeout: 5000, vapidDetails: { subject: subject(), publicKey, privateKey } },
              )
              .catch((error: { statusCode?: number }) => {
                if (error.statusCode === 404 || error.statusCode === 410) gone.push(s.endpoint);
                else console.warn('[push] delivery failed', error.statusCode ?? error);
              }),
          ),
      ),
    );
    if (gone.length > 0) await db.delete(t.pushSubscriptions).where(inArray(t.pushSubscriptions.endpoint, gone));
  } catch (error) {
    console.warn('[push] could not send notifications', error);
  }
}
