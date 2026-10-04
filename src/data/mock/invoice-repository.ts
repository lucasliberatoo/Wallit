import {
  can,
  canTransition,
  type Card,
  type Invoice,
  INVOICE_STATUS_LABEL,
  invoiceRefForDate,
  compareRefs,
} from '@/domain';
import { AppError } from '../errors';
import type { InvoiceRepository } from '../repositories';
import type { MockStore } from './store';
import { invoiceDetails, invoiceListItem, sortInvoicesDesc, todayISO } from './views';

export function createMockInvoiceRepository(store: MockStore): InvoiceRepository {
  const requireHolderPower = (card: Card) => {
    const me = store.requireMembership(card.familyId);
    if (!can(me.role, 'invoice.changeStatus', { isCardHolder: card.holderMemberId === me.id })) {
      throw new AppError('forbidden', 'Apenas a titular do cartão pode fazer isso.');
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
      store.run(() => invoiceDetails(store, store.require('invoices', invoiceId, 'Fatura') as Invoice)),

    create: (cardId, ref) =>
      store.run(
        () => {
          const card = store.require('cards', cardId, 'Cartão') as Card;
          requireHolderPower(card);
          if (store.findInvoice(cardId, ref)) throw new AppError('validation', 'Essa fatura já existe.');
          const current = invoiceRefForDate(todayISO(), card.closingDay);
          if (compareRefs(ref, current) > 12) throw new AppError('validation', 'Só é possível criar faturas até 12 meses à frente.');
          const invoice = store.getOrCreateInvoice(card, ref);
          store.audit({ familyId: card.familyId, entity: 'invoice', entityId: invoice.id, action: 'created', summary: 'Fatura criada', changes: [] });
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
            throw new AppError('validation', `Não é possível ir de "${INVOICE_STATUS_LABEL[invoice.status]}" para "${INVOICE_STATUS_LABEL[status]}".`);
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
          return invoice;
        },
        { write: true },
      ),
  };
}
