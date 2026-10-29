import {
  allocateSharesToInstallments,
  type Card,
  compareRefs,
  dueDateFor,
  type FamilyMember,
  type ID,
  type Invoice,
  type InvoiceRef,
  type Purchase,
  refFromKey,
  refKey,
} from '../../domain';
import type { PurchaseSimulation, SimulationMonth } from '../models';
import type { Store } from './store';
import { installmentShares } from './views';

/** How much a simulated change adds (or takes away) in one invoice. */
export interface MonthChange {
  cardCents: number;
  myCents: number;
}

function activePurchase(store: Store, purchaseId: ID): Purchase | undefined {
  const purchase = store.find('purchases', purchaseId) as Purchase | undefined;
  return purchase && purchase.status === 'active' ? purchase : undefined;
}

/** Card invoice total and my part in it, as they are today. */
function invoiceAmounts(store: Store, invoice: Invoice | undefined, meId: ID): { cardCents: number; myCents: number } {
  if (!invoice) return { cardCents: 0, myCents: 0 };
  let cardCents = 0;
  let myCents = 0;
  for (const installment of store.db.installments) {
    if (installment.invoiceId !== invoice.id || !activePurchase(store, installment.purchaseId)) continue;
    cardCents += installment.amountCents;
    myCents += installmentShares(store, installment).find((share) => share.member.id === meId)?.amountCents ?? 0;
  }
  return { cardCents, myCents };
}

/** What is still to be paid on the card: installments in invoices not paid yet. */
export function usedLimitCents(store: Store, card: Card): number {
  const unpaid = new Set(
    store.db.invoices.filter((i) => i.cardId === card.id && i.status !== 'paid' && i.status !== 'archived').map((i) => i.id),
  );
  return store.db.installments
    .filter((installment) => unpaid.has(installment.invoiceId) && activePurchase(store, installment.purchaseId))
    .reduce((sum, installment) => sum + installment.amountCents, 0);
}

/** Before/after of every invoice the change touches, oldest first. */
export function simulationMonths(store: Store, card: Card, me: FamilyMember, changes: Map<string, MonthChange>): SimulationMonth[] {
  return [...changes.entries()]
    .map(([key, change]) => {
      const ref: InvoiceRef = refFromKey(key);
      const invoice = store.findInvoice(card.id, ref);
      const before = invoiceAmounts(store, invoice, me.id);
      return {
        ref,
        dueDate: invoice?.dueDate ?? dueDateFor(ref, card.closingDay, card.dueDay),
        status: invoice?.status ?? null,
        beforeCents: before.cardCents,
        addedCents: change.cardCents,
        myBeforeCents: before.myCents,
        myAddedCents: change.myCents,
      };
    })
    .sort((a, b) => compareRefs(a.ref, b.ref));
}

export function addChange(changes: Map<string, MonthChange>, ref: InvoiceRef, cardCents: number, myCents: number): void {
  const key = refKey(ref);
  const current = changes.get(key) ?? { cardCents: 0, myCents: 0 };
  changes.set(key, { cardCents: current.cardCents + cardCents, myCents: current.myCents + myCents });
}

/** My part of each installment, given the purchase split. */
export function myInstallmentParts(amounts: number[], shares: { memberId: ID; amountCents: number }[], meId: ID): number[] {
  const index = shares.findIndex((share) => share.memberId === meId);
  if (index < 0) return amounts.map(() => 0);
  return allocateSharesToInstallments(amounts, shares).map((row) => row[index]);
}

export function simulationResult(
  store: Store,
  card: Card,
  me: FamilyMember,
  changes: Map<string, MonthChange>,
  myTotalCents: number,
  addedToLimit: number | null,
): PurchaseSimulation {
  let limit: PurchaseSimulation['limit'] = null;
  if (addedToLimit !== null && card.limitCents) {
    const usedCents = usedLimitCents(store, card);
    limit = {
      limitCents: card.limitCents,
      usedCents,
      availableBeforeCents: card.limitCents - usedCents,
      availableAfterCents: card.limitCents - usedCents - addedToLimit,
    };
  }
  return { card, me, months: simulationMonths(store, card, me, changes), myTotalCents, limit };
}
