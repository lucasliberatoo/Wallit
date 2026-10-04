import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';

import { DEMO_ACCOUNT, emptyDatabase, seedDemoDatabase, Store } from '../src/data/core';
import type { Db } from './db/client';
import * as t from './db/schema';
import { persistChanges } from './unit-of-work';

/**
 * Creates the "Família Silva" demo (accounts for Lucas and Maria plus their
 * family data) if the demo account doesn't exist yet. Safe to run on every deploy.
 */
export async function seedDemo(db: Db): Promise<boolean> {
  const [existing] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, DEMO_ACCOUNT.email));
  if (existing) return false;

  const store = new Store({ persistence: { load: async () => null, save: async () => undefined }, seed: seedDemoDatabase });
  await store.init();
  const demo = store.db;

  await db.transaction(async (tx) => {
    for (const user of demo.users) {
      await tx.insert(t.user).values({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        avatarColor: user.avatarColor,
        pixKey: user.pixKey ?? null,
      });
      if (user.password) {
        await tx.insert(t.account).values({
          id: `acc_${user.id}`,
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: await hashPassword(user.password),
        });
      }
    }
    await persistChanges(tx, emptyDatabase(), { ...demo, sessionUserId: null });
  });
  return true;
}
