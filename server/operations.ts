import { eq } from 'drizzle-orm';

import { createCoreRepositories, type Database, Store } from '../src/data/core';
import { AppError } from '../src/data/errors';
import type { Repositories } from '../src/data/repositories';
import type { Db } from './db/client';
import * as t from './db/schema';
import type { PushMessage } from './push';
import { loadBlob, lockFamilies, loadSnapshot, memberFamilyIds, persistChanges, type Tx } from './unit-of-work';

/**
 * Every repository method the app may call through the API, and whether it
 * writes. Anything not listed here is rejected (sign-in and sign-up go
 * through Better Auth instead).
 */
export const OPERATIONS = {
  'auth.updateProfile': 'write',
  'families.listMine': 'read',
  'families.get': 'read',
  'families.create': 'write',
  'families.listMembers': 'read',
  'families.addMember': 'write',
  'families.updateMemberRole': 'write',
  'families.removeMember': 'write',
  'families.leave': 'write',
  'families.createInvite': 'write',
  'families.joinByCode': 'write',
  'families.updateSettings': 'write',
  'wallets.list': 'read',
  'wallets.get': 'read',
  'wallets.create': 'write',
  'cards.listByFamily': 'read',
  'cards.get': 'read',
  'cards.create': 'write',
  'invoices.listByCard': 'read',
  'invoices.listByFamily': 'read',
  'invoices.getDetails': 'read',
  'invoices.create': 'write',
  'invoices.changeStatus': 'write',
  'purchases.create': 'write',
  'purchases.update': 'write',
  'purchases.cancel': 'write',
  'purchases.get': 'read',
  'purchases.search': 'read',
  'categories.list': 'read',
  'categories.create': 'write',
  'categories.update': 'write',
  'categories.remove': 'write',
  'categories.reorder': 'write',
  'payments.register': 'write',
  'payments.confirm': 'write',
  'payments.reject': 'write',
  'reviews.confirm': 'write',
  'reviews.dispute': 'write',
  'reviews.resolve': 'write',
  'aliases.list': 'read',
  'aliases.save': 'write',
  'aliases.remove': 'write',
  'notifications.list': 'read',
  'notifications.unreadCount': 'read',
  'notifications.markRead': 'write',
  'statistics.get': 'read',
  'attachments.add': 'write',
  'attachments.remove': 'write',
  'attachments.getData': 'read',
  'dashboard.home': 'read',
  'dashboard.activity': 'read',
} as const satisfies Record<string, 'read' | 'write'>;

export type OperationName = keyof typeof OPERATIONS;

export function isOperation(name: unknown): name is OperationName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(OPERATIONS, name);
}

/** Joining by code is the one operation that reaches a family the user is not in yet. */
async function extraFamilies(tx: Tx, name: OperationName, args: unknown[]): Promise<string[]> {
  if (name !== 'families.joinByCode' || typeof args[0] !== 'string') return [];
  const [invite] = await tx
    .select({ familyId: t.familyInvites.familyId })
    .from(t.familyInvites)
    .where(eq(t.familyInvites.code, args[0].trim().toUpperCase()));
  return invite ? [invite.familyId] : [];
}

/** Notifications created by a write, addressed to the users' devices. */
export function newPushMessages(before: Database, after: Database): PushMessage[] {
  const known = new Set(before.notifications.map((n) => n.id));
  return after.notifications.flatMap((notification) => {
    if (known.has(notification.id)) return [];
    const userId = after.members.find((m) => m.id === notification.recipientMemberId)?.userId;
    return userId ? [{ userId, id: notification.id, title: notification.title, body: notification.body, link: notification.link }] : [];
  });
}

/**
 * Runs one repository method for the signed-in user inside a transaction:
 * load the user's families, run the shared business rules, write back what
 * changed. Families the user doesn't belong to are never loaded, so they
 * can't be read or changed.
 */
export async function runOperation(
  db: Db,
  userId: string,
  name: OperationName,
  args: unknown[],
): Promise<{ result: unknown; pushes: PushMessage[] }> {
  const writes = OPERATIONS[name] === 'write';
  return db.transaction(async (tx) => {
    const familyIds = [...new Set([...(await memberFamilyIds(tx, userId)), ...(await extraFamilies(tx, name, args))])];
    if (writes) await lockFamilies(tx, familyIds);
    const snapshot = await loadSnapshot(tx, userId, familyIds);
    if (name === 'attachments.getData' && typeof args[0] === 'string') await loadBlob(tx, snapshot, args[0]);
    const before = structuredClone(snapshot);
    const store = new Store({ persistence: { load: async () => snapshot, save: async () => undefined } });
    const repos = createCoreRepositories(store);

    const [repoName, methodName] = name.split('.') as [keyof Repositories, string];
    const method = (repos[repoName] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[methodName];
    if (typeof method !== 'function') throw new AppError('not_found', 'Operação desconhecida.');
    const result = await method(...args);

    if (!writes) return { result: result ?? null, pushes: [] };
    await persistChanges(tx, before, store.db);
    return { result: result ?? null, pushes: newPushMessages(before, store.db) };
  });
}
