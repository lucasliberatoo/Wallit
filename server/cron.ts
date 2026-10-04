import { and, inArray } from 'drizzle-orm';

import { createDueReminders, Store } from '../src/data/core';
import { DUE_REMINDER_DAYS } from '../src/domain';
import type { Db } from './db/client';
import * as t from './db/schema';
import { newPushMessages } from './operations';
import { type PushMessage, sendPushes } from './push';
import { lockFamilies, loadSnapshot, persistChanges } from './unit-of-work';

/** Today in São Paulo, YYYY-MM-DD. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Daily job: "A fatura vence em 2 dias" for everyone who still owes. Each
 * family is handled in its own transaction; reminders are deduplicated, so
 * running it twice sends nothing new.
 */
export async function runDailyReminders(db: Db, today = todayInBrazil()): Promise<{ families: number; sent: number }> {
  const dueDate = addDays(today, DUE_REMINDER_DAYS);
  const rows = await db
    .selectDistinct({ familyId: t.invoices.familyId })
    .from(t.invoices)
    .where(and(inArray(t.invoices.dueDate, [dueDate]), inArray(t.invoices.status, ['closed', 'collecting'])));

  const pushes: PushMessage[] = [];
  for (const { familyId } of rows) {
    const messages = await db.transaction(async (tx) => {
      await lockFamilies(tx, [familyId]);
      const snapshot = await loadSnapshot(tx, null, [familyId]);
      const before = structuredClone(snapshot);
      const store = new Store({ persistence: { load: async () => snapshot, save: async () => undefined } });
      await store.init();
      createDueReminders(store, today);
      await persistChanges(tx, before, store.db);
      return newPushMessages(before, store.db);
    });
    pushes.push(...messages);
  }
  await sendPushes(db, pushes);
  return { families: rows.length, sent: pushes.length };
}
