import {
  addMonths,
  type Card,
  compareRefs,
  formatRef,
  invoiceRefForDate,
  isInvoiceLocked,
  type Invoice,
  type InvoiceRef,
  type Purchase,
  type PurchaseInstallment,
} from '../../domain';
import type { Store } from './store';
import { todayISO } from './views';

/** Most installments one anticipation looks ahead for an open invoice. */
const MAX_LOOKAHEAD = 24;

/** First invoice of the card still open today: anticipated installments land there. */
export function anticipationTargetRef(store: Store, card: Card): InvoiceRef {
  let ref = invoiceRefForDate(todayISO(), card.closingDay);
  for (let i = 0; i < MAX_LOOKAHEAD; i += 1) {
    const existing = store.findInvoice(card.id, ref);
    if (!existing || !isInvoiceLocked(existing.status)) return ref;
    ref = addMonths(ref, 1);
  }
  return ref;
}

/**
 * Installments that can be brought forward: in invoices after the target that
 * are still open, last ones first (banks anticipate from the end).
 */
export function anticipatableInstallments(store: Store, purchase: Purchase, targetRef: InvoiceRef): PurchaseInstallment[] {
  return store.db.installments
    .filter((installment) => installment.purchaseId === purchase.id)
    .filter((installment) => {
      const invoice = store.find('invoices', installment.invoiceId) as Invoice | undefined;
      return Boolean(invoice && compareRefs(invoice.ref, targetRef) > 0 && !isInvoiceLocked(invoice.status));
    })
    .sort((a, b) => b.number - a.number);
}

export function anticipationSummary(count: number, target: Invoice): string {
  return `${count} ${count === 1 ? 'parcela antecipada' : 'parcelas antecipadas'} para a fatura de ${formatRef(target.ref)}`;
}
