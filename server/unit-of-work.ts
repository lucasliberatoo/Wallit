import { and, eq, inArray } from 'drizzle-orm';

import { type Database, emptyDatabase, type StoredUser } from '../src/data/core';
import type { Db } from './db/client';
import * as t from './db/schema';
import { MAPPERS, userFromRow } from './rows';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Families the user is an active member of. */
export async function memberFamilyIds(tx: Tx, userId: string): Promise<string[]> {
  const rows = await tx
    .select({ familyId: t.familyMembers.familyId })
    .from(t.familyMembers)
    .where(and(eq(t.familyMembers.userId, userId), eq(t.familyMembers.status, 'active')));
  return rows.map((r) => r.familyId);
}

/**
 * Serializes writes per family: concurrent requests touching the same family
 * wait for each other, so every write sees the latest data.
 */
export async function lockFamilies(tx: Tx, familyIds: string[]): Promise<void> {
  if (familyIds.length === 0) return;
  await tx.select({ id: t.families.id }).from(t.families).where(inArray(t.families.id, familyIds)).orderBy(t.families.id).for('update');
}

/** Loads everything the shared repositories may need for these families. */
export async function loadSnapshot(tx: Tx, userId: string, familyIds: string[]): Promise<Database> {
  const db = emptyDatabase();
  db.sessionUserId = userId;

  if (familyIds.length > 0) {
    // One query at a time: a transaction runs on a single connection.
    for (const { collection, mapper } of MAPPERS) {
      const familyColumn = mapper.table === t.families ? t.families.id : (mapper.table as typeof t.wallets).familyId;
      const rows = await tx.select().from(mapper.table).where(inArray(familyColumn, familyIds));
      (db[collection] as unknown[]) = (rows as Record<string, unknown>[]).map((row) => mapper.fromRow(row as never));
    }
  }

  const userIds = new Set<string>([userId]);
  db.members.forEach((m) => m.userId && userIds.add(m.userId));
  db.families.forEach((f) => userIds.add(f.createdBy));
  db.purchases.forEach((p) => userIds.add(p.createdBy));
  db.payments.forEach((p) => userIds.add(p.registeredBy));
  db.auditLogs.forEach((a) => userIds.add(a.actorUserId));
  const users = await tx
    .select()
    .from(t.user)
    .where(inArray(t.user.id, [...userIds]));
  db.users = users.map(userFromRow);
  return db;
}

/** Writes the difference between two snapshots: deletes, then inserts, then updates. */
export async function persistChanges(tx: Tx, before: Database, after: Database): Promise<void> {
  const plans = MAPPERS.map(({ collection, mapper }) => {
    const previous = new Map((before[collection] as never[]).map((item) => [mapper.keyOf(item), item]));
    const current = new Map((after[collection] as never[]).map((item) => [mapper.keyOf(item), item]));
    const inserts: Record<string, unknown>[] = [];
    const updates: { key: string; row: Record<string, unknown> }[] = [];
    for (const [key, item] of current) {
      const old = previous.get(key);
      if (!old) inserts.push(mapper.toRow(item, after));
      else if (stableStringify(old) !== stableStringify(item)) updates.push({ key, row: mapper.toRow(item, after) });
    }
    const deletes = [...previous.keys()].filter((key) => !current.has(key));
    return { mapper, inserts, updates, deletes };
  });

  for (const { mapper, deletes } of [...plans].reverse()) {
    if (deletes.length > 0) await tx.delete(mapper.table).where(inArray(mapper.key, deletes));
  }
  for (const { mapper, inserts } of plans) {
    if (inserts.length > 0) await tx.insert(mapper.table).values(inserts);
  }
  for (const { mapper, updates } of plans) {
    for (const { key, row } of updates) await tx.update(mapper.table).set(row).where(eq(mapper.key, key));
  }

  await persistProfile(tx, before, after);
}

/** Only the signed-in user's own profile can change through the repositories. */
async function persistProfile(tx: Tx, before: Database, after: Database): Promise<void> {
  const userId = after.sessionUserId;
  if (!userId) return;
  const find = (db: Database) => db.users.find((u) => u.id === userId) as StoredUser | undefined;
  const old = find(before);
  const next = find(after);
  if (!old || !next || stableStringify(old) === stableStringify(next)) return;
  await tx
    .update(t.user)
    .set({ name: next.name, avatarColor: next.avatarColor, pixKey: next.pixKey ?? null, image: next.photo ?? null, updatedAt: new Date() })
    .where(eq(t.user.id, userId));
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([, inner]) => inner !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}
