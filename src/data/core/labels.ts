import { type Card, type Invoice, monthName } from '../../domain';
import type { Store } from './store';

/** "agosto (Cartão Principal)", used in notification texts. */
export function invoiceLabel(store: Store, invoice: Invoice): string {
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  return `${monthName(invoice.ref.month)} (${card.name})`;
}

export const invoiceLink = (invoice: Invoice) => `/invoice/${invoice.id}`;
export const purchaseLink = (purchaseId: string) => `/purchase/${purchaseId}`;
