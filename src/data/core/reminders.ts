import { type AppNotification, type Card, DUE_REMINDER_DAYS, formatBRL, type InvoiceStatus, parseISODate } from '../../domain';
import { invoiceLabel, invoiceLink } from './labels';
import { notify } from './notify';
import type { Store } from './store';
import { balancesFor, invoiceLines } from './views';

/** Under review too: it closes by itself on the due date anyway. */
const REMINDED_STATUSES: readonly InvoiceStatus[] = ['reviewing', 'closed', 'collecting'];

function addDays(date: string, days: number): string {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * "A fatura vence em 2 dias": for invoices due soon, reminds each member who
 * still owes something. Runs once a day without a signed-in user; the dedupe
 * key keeps a reminder from going out twice.
 */
export function createDueReminders(store: Store, today: string): AppNotification[] {
  const dueDate = addDays(today, DUE_REMINDER_DAYS);
  const created: AppNotification[] = [];
  for (const invoice of store.db.invoices) {
    if (invoice.dueDate !== dueDate || !REMINDED_STATUSES.includes(invoice.status)) continue;
    const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
    const { balances } = balancesFor(store, invoice, card, invoiceLines(store, invoice));
    for (const balance of balances) {
      const missing = balance.pendingCents - balance.awaitingCents;
      if (balance.status === 'holder' || missing <= 0) continue;
      created.push(
        ...notify(store, {
          familyId: invoice.familyId,
          memberIds: [balance.memberId],
          type: 'due_reminder',
          title: `Fatura vence em ${DUE_REMINDER_DAYS} dias`,
          body: `Faltam ${formatBRL(missing)} da sua parte da fatura de ${invoiceLabel(store, invoice)}.`,
          link: invoiceLink(invoice),
          dedupeKey: `due:${invoice.id}`,
        }),
      );
    }
  }
  return created;
}
