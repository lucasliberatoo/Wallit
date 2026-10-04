import type { InvoiceStatus } from './types';

export const INVOICE_STATUS_FLOW: readonly InvoiceStatus[] = ['open', 'reviewing', 'closed', 'collecting', 'paid', 'archived'];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'Aberta',
  reviewing: 'Em conferência',
  closed: 'Fechada',
  collecting: 'Recebendo pagamentos',
  paid: 'Paga',
  archived: 'Arquivada',
};

/** Statuses where purchases are protected against regular edits (rule 10). */
export function isInvoiceLocked(status: InvoiceStatus): boolean {
  return INVOICE_STATUS_FLOW.indexOf(status) >= INVOICE_STATUS_FLOW.indexOf('closed');
}

export function acceptsPurchases(status: InvoiceStatus): boolean {
  return !isInvoiceLocked(status);
}

export function nextInvoiceStatus(status: InvoiceStatus): InvoiceStatus | null {
  const index = INVOICE_STATUS_FLOW.indexOf(status);
  return INVOICE_STATUS_FLOW[index + 1] ?? null;
}

/** Moving forward one step, or reopening a closed invoice back to open. */
export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (nextInvoiceStatus(from) === to) return true;
  return to === 'open' && (from === 'reviewing' || from === 'closed');
}
