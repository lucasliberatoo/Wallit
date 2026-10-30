import {
  can,
  canTransition,
  type Card,
  compareRefs,
  formatBRL,
  type Invoice,
  INVOICE_STATUS_LABEL,
  invoiceRefForDate,
  managesCard,
  type ID,
  type ISODate,
  parseISODate,
  reviewProgress,
} from '../../domain';
import { AppError } from '../errors';
import type { InvoiceRepository } from '../repositories';
import { invoiceLabel, invoiceLink } from './labels';
import { notify } from './notify';
import type { Store } from './store';
import { balancesFor, invoiceDetails, invoiceLines, invoiceListItem, sortInvoicesDesc, todayISO, visibleInvoiceDetails } from './views';

/** Tells the family what changed: review started, or each person's final amount. */
function announceStatus(store: Store, invoice: Invoice): void {
  // Without the signed-in user's view: the daily job calls this too.
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const lines = invoiceLines(store, invoice);
  const { balances } = balancesFor(store, invoice, card, lines);
  const involved = [...new Set(lines.flatMap((line) => [line.buyer.id, ...line.shares.map((s) => s.member.id)]))];
  if (invoice.status === 'reviewing') {
    notify(store, {
      familyId: invoice.familyId,
      memberIds: involved,
      type: 'review_started',
      title: 'Hora de conferir',
      body: `A fatura de ${invoiceLabel(store, invoice)} está pronta para conferência.`,
      link: invoiceLink(invoice),
    });
  }
  if (invoice.status === 'closed') {
    for (const balance of balances) {
      if (balance.status === 'holder' || balance.pendingCents <= 0) continue;
      notify(store, {
        familyId: invoice.familyId,
        memberIds: [balance.memberId],
        type: 'amount_defined',
        title: 'Sua parte foi definida',
        body: `Sua parte da fatura de ${invoiceLabel(store, invoice)} é ${formatBRL(balance.pendingCents)}.`,
        link: invoiceLink(invoice),
      });
    }
  }
}

/** Only invoices that closed this recently notify the family when review starts by itself. */
const AUTO_REVIEW_NOTIFY_DAYS = 7;

/**
 * Daily job: the day after an invoice's closing date, its review starts by
 * itself if the holder hasn't started it. Runs without a signed-in user.
 * Invoices forgotten as "open" for a long time move too, but quietly.
 */
export function startReviewsAfterClosing(store: Store, today: ISODate): Invoice[] {
  const notifyFrom = addDays(today, -AUTO_REVIEW_NOTIFY_DAYS);
  const started: Invoice[] = [];
  for (const invoice of store.db.invoices) {
    if (invoice.status !== 'open' || invoice.closingDate >= today) continue;
    const actor = jobActor(store, invoice);
    if (!actor) continue;
    invoice.status = 'reviewing';
    store.audit({
      familyId: invoice.familyId,
      entity: 'invoice',
      entityId: invoice.id,
      action: 'status_changed',
      summary: 'Conferência iniciada automaticamente após o fechamento',
      changes: [{ field: 'Status', from: INVOICE_STATUS_LABEL.open, to: INVOICE_STATUS_LABEL.reviewing }],
      actorUserId: actor,
    });
    if (invoice.closingDate >= notifyFrom) announceStatus(store, invoice);
    started.push(invoice);
    // Nothing to check (no purchases): straight to closed.
    closeIfReviewed(store, invoice, actor);
  }
  return started;
}

/** Who the daily job's changes are logged as: the holder, or the family's owner when the holder has no account. */
function jobActor(store: Store, invoice: Invoice): ID | undefined {
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const members = store.db.members.filter((m) => m.familyId === invoice.familyId && m.status === 'active');
  return members.find((m) => m.id === card.holderMemberId)?.userId ?? members.find((m) => m.role === 'owner' && m.userId)?.userId ?? undefined;
}

/**
 * Daily job: on the due date, an invoice still under review closes by itself.
 * Purchases nobody checked count as accepted; an open dispute keeps it in
 * review until the holder answers.
 */
export function closeReviewsOnDueDate(store: Store, today: ISODate): Invoice[] {
  const closed: Invoice[] = [];
  for (const invoice of store.db.invoices) {
    if (invoice.status !== 'reviewing' || invoice.dueDate > today) continue;
    const actor = jobActor(store, invoice);
    if (actor && closeIfReviewed(store, invoice, actor, { acceptPending: true })) closed.push(invoice);
  }
  return closed;
}

/**
 * Closes an invoice under review once every purchase was confirmed or had its
 * dispute answered (or, with `acceptPending`, once no dispute is open), and
 * tells each person their final amount.
 */
export function closeIfReviewed(store: Store, invoice: Invoice, actorUserId?: ID, options: { acceptPending?: boolean } = {}): boolean {
  if (invoice.status !== 'reviewing') return false;
  const { pending, disputed } = reviewProgress(invoiceLines(store, invoice).map((line) => line.review));
  if (disputed > 0 || (pending > 0 && !options.acceptPending)) return false;
  invoice.status = 'closed';
  store.audit({
    familyId: invoice.familyId,
    entity: 'invoice',
    entityId: invoice.id,
    action: 'status_changed',
    summary: pending > 0 ? 'Fatura fechada automaticamente no vencimento' : 'Fatura fechada automaticamente: conferência concluída',
    changes: [{ field: 'Status', from: INVOICE_STATUS_LABEL.reviewing, to: INVOICE_STATUS_LABEL.closed }],
    actorUserId,
  });
  announceStatus(store, invoice);
  return true;
}

function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function createInvoiceRepository(store: Store): InvoiceRepository {
  const requireHolderPower = (card: Card) => {
    const me = store.requireMembership(card.familyId);
    if (!can(me.role, 'invoice.changeStatus', { isCardHolder: managesCard(card, me.id) })) {
      throw new AppError('forbidden', 'Apenas a titular do cartão ou um moderador pode fazer isso.');
    }
  };

  return {
    listByCard: (cardId) =>
      store.run(() => {
        const card = store.require('cards', cardId, 'Cartão') as Card;
        const me = store.requireMembership(card.familyId);
        return sortInvoicesDesc(store.db.invoices.filter((invoice) => invoice.cardId === cardId)).map((invoice) =>
          invoiceListItem(store, invoice, me),
        );
      }),

    listByFamily: (familyId) =>
      store.run(() => {
        const me = store.requireMembership(familyId);
        return sortInvoicesDesc(store.db.invoices.filter((invoice) => invoice.familyId === familyId)).map((invoice) =>
          invoiceListItem(store, invoice, me),
        );
      }),

    getDetails: (invoiceId) =>
      store.run(() => visibleInvoiceDetails(store, invoiceDetails(store, store.require('invoices', invoiceId, 'Fatura') as Invoice))),

    create: (cardId, ref) =>
      store.run(
        () => {
          const card = store.require('cards', cardId, 'Cartão') as Card;
          requireHolderPower(card);
          if (store.findInvoice(cardId, ref)) throw new AppError('validation', 'Essa fatura já existe.');
          const current = invoiceRefForDate(todayISO(), card.closingDay);
          if (compareRefs(ref, current) > 12) throw new AppError('validation', 'Só é possível criar faturas até 12 meses à frente.');
          const invoice = store.getOrCreateInvoice(card, ref);
          store.audit({
            familyId: card.familyId,
            entity: 'invoice',
            entityId: invoice.id,
            action: 'created',
            summary: 'Fatura criada',
            changes: [],
          });
          return invoice;
        },
        { write: true },
      ),

    changeStatus: (invoiceId, status) =>
      store.run(
        () => {
          const invoice = store.require('invoices', invoiceId, 'Fatura') as Invoice;
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          requireHolderPower(card);
          if (!canTransition(invoice.status, status)) {
            throw new AppError(
              'validation',
              `Não é possível ir de "${INVOICE_STATUS_LABEL[invoice.status]}" para "${INVOICE_STATUS_LABEL[status]}".`,
            );
          }
          if (invoice.status === 'reviewing' && status === 'closed') {
            const disputed = invoiceDetails(store, invoice).reviewProgress.disputed;
            if (disputed > 0) {
              throw new AppError(
                'validation',
                `Responda ${disputed === 1 ? 'a contestação' : `as ${disputed} contestações`} antes de fechar.`,
              );
            }
          }
          const before = invoice.status;
          invoice.status = status;
          store.audit({
            familyId: invoice.familyId,
            entity: 'invoice',
            entityId: invoice.id,
            action: 'status_changed',
            summary: `Fatura: ${INVOICE_STATUS_LABEL[status]}`,
            changes: [{ field: 'Status', from: INVOICE_STATUS_LABEL[before], to: INVOICE_STATUS_LABEL[status] }],
          });
          announceStatus(store, invoice);
          return invoice;
        },
        { write: true },
      ),
  };
}
