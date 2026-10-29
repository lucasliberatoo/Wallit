import {
  addMonths,
  allocateSharesToInstallments,
  type Card,
  compareRefs,
  describeSplit,
  dueDateFor,
  type FamilyMember,
  type ID,
  installmentAmounts,
  type Invoice,
  type InvoiceRef,
  invoiceRefForDate,
  isInvoiceLocked,
  MAX_INSTALLMENTS,
  type Purchase,
  refFromKey,
  refKey,
  validateSplit,
} from '../../domain';
import { AppError } from '../errors';
import type { PurchaseSimulation, ScenarioCardLimit, ScenarioInput, ScenarioMonth, ScenarioResult, SimulationMonth } from '../models';
import { anticipationTargetRef } from './anticipation';
import type { Store } from './store';
import { installmentShares, todayISO } from './views';

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
): PurchaseSimulation {
  return { card, me, months: simulationMonths(store, card, me, changes), myTotalCents };
}

/** Most months a scenario shows. */
const MAX_SCENARIO_MONTHS = 60;
const MAX_LOAN_INSTALLMENTS = 120;

function fail(index: number, message: string): never {
  throw new AppError('validation', `Simulação ${index + 1}: ${message}`);
}

/**
 * Several simulated operations together (purchases, loans, paying off
 * installments early), compared month by month with how things are today,
 * for every card together and for my part only. Nothing is saved.
 */
export function runScenario(store: Store, input: ScenarioInput): ScenarioResult {
  const me = store.requireMembership(input.familyId);
  if (input.operations.length > 20) throw new AppError('validation', 'Use no máximo 20 simulações de uma vez.');
  const cards = store.db.cards.filter((card) => card.familyId === input.familyId && card.status !== 'archived');
  const familyMemberIds = new Set(store.activeMembers(input.familyId).map((m) => m.id));
  const openRefs = new Map(cards.map((card) => [card.id, anticipationTargetRef(store, card)]));

  const cardChanges = new Map<ID, Map<string, MonthChange>>(cards.map((card) => [card.id, new Map()]));
  const loans = new Map<string, { payments: number; received: number }>();
  const addLoan = (ref: InvoiceRef, payments: number, received: number) => {
    const current = loans.get(refKey(ref)) ?? { payments: 0, received: 0 };
    loans.set(refKey(ref), { payments: current.payments + payments, received: current.received + received });
  };
  const limitAdded = new Map<ID, number>();
  const moved = new Set<ID>();
  const payoffs: ScenarioResult['payoffs'] = [];

  const requireCard = (index: number, cardId: ID): Card => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) fail(index, 'cartão não encontrado.');
    return card;
  };
  const requireOpenRef = (index: number, card: Card, ref: InvoiceRef, what: string) => {
    if (compareRefs(ref, openRefs.get(card.id)!) < 0) fail(index, `${what} não pode ser uma fatura já fechada.`);
  };

  input.operations.forEach((operation, index) => {
    if (operation.kind === 'purchase') {
      const card = requireCard(index, operation.cardId);
      requireOpenRef(index, card, operation.startRef, 'a primeira parcela');
      const count = operation.installmentCount;
      if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
        fail(index, `parcelamento deve ser entre 1x e ${MAX_INSTALLMENTS}x.`);
      }
      if (!Number.isInteger(operation.totalCents) || operation.totalCents < count) fail(index, 'informe o valor da compra.');
      const shares = operation.shares?.length ? operation.shares : [{ memberId: me.id, amountCents: operation.totalCents }];
      if (shares.some((share) => !familyMemberIds.has(share.memberId))) fail(index, 'responsável não faz parte da família.');
      const split = validateSplit(operation.totalCents, shares);
      if (split.status !== 'complete') fail(index, describeSplit(split));
      const amounts = installmentAmounts(operation.totalCents, count);
      const mine = myInstallmentParts(amounts, shares, me.id);
      amounts.forEach((amount, i) => addChange(cardChanges.get(card.id)!, addMonths(operation.startRef, i), amount, mine[i]));
      limitAdded.set(card.id, (limitAdded.get(card.id) ?? 0) + operation.totalCents);
      return;
    }

    if (operation.kind === 'loan') {
      const count = operation.installmentCount;
      if (!Number.isInteger(count) || count < 1 || count > MAX_LOAN_INSTALLMENTS) {
        fail(index, `o empréstimo deve ter de 1 a ${MAX_LOAN_INSTALLMENTS} parcelas.`);
      }
      if (!Number.isInteger(operation.installmentCents) || operation.installmentCents <= 0) fail(index, 'informe o valor da parcela.');
      if (!Number.isInteger(operation.receivedCents) || operation.receivedCents < 0) fail(index, 'valor recebido inválido.');
      if (operation.receivedCents > 0) addLoan(operation.receivedRef, 0, operation.receivedCents);
      for (let i = 0; i < count; i += 1) addLoan(addMonths(operation.startRef, i), operation.installmentCents, 0);
      return;
    }

    const card = requireCard(index, operation.cardId);
    requireOpenRef(index, card, operation.targetRef, 'a fatura que recebe as parcelas');
    const changes = cardChanges.get(card.id)!;
    // What the earlier simulations put on this card, before this payoff moves anything.
    const earlier = [...changes.entries()].map(([key, change]) => ({ ref: refFromKey(key), ...change }));
    let movedCents = 0;
    let myMovedCents = 0;
    const move = (from: InvoiceRef, cardCents: number, myCents: number) => {
      addChange(changes, from, -cardCents, -myCents);
      addChange(changes, operation.targetRef, cardCents, myCents);
      movedCents += cardCents;
      myMovedCents += myCents;
    };

    let installments = store.db.installments.filter((installment) => {
      if (moved.has(installment.id)) return false;
      if (operation.purchaseId ? installment.purchaseId !== operation.purchaseId : false) return false;
      const purchase = store.find('purchases', installment.purchaseId) as Purchase | undefined;
      if (!purchase || purchase.status !== 'active' || purchase.cardId !== card.id) return false;
      const invoice = store.find('invoices', installment.invoiceId) as Invoice | undefined;
      return Boolean(invoice && compareRefs(invoice.ref, operation.targetRef) > 0 && !isInvoiceLocked(invoice.status));
    });
    if (operation.purchaseId) {
      const purchase = store.find('purchases', operation.purchaseId) as Purchase | undefined;
      if (!purchase || purchase.familyId !== input.familyId) fail(index, 'compra não encontrada.');
      if (installments.length === 0) fail(index, 'essa compra não tem parcelas depois dessa fatura.');
      const count = operation.count ?? installments.length;
      if (!Number.isInteger(count) || count < 1 || count > installments.length) {
        fail(index, `escolha de 1 a ${installments.length} parcelas.`);
      }
      installments = installments.sort((a, b) => b.number - a.number).slice(0, count);
    }
    for (const installment of installments) {
      const invoice = store.require('invoices', installment.invoiceId, 'Fatura') as Invoice;
      const myCents = installmentShares(store, installment).find((share) => share.member.id === me.id)?.amountCents ?? 0;
      move(invoice.ref, installment.amountCents, myCents);
      moved.add(installment.id);
    }
    if (!operation.purchaseId) {
      // Paying off the whole card also covers what the earlier simulations put on it.
      for (const change of earlier) {
        if (compareRefs(change.ref, operation.targetRef) <= 0) continue;
        if (change.cardCents === 0 && change.myCents === 0) continue;
        move(change.ref, change.cardCents, change.myCents);
      }
    }
    payoffs.push({ operation: index, movedCents, myMovedCents });
  });

  // From the first open invoice to the last month anything is due.
  const refs: InvoiceRef[] = [...openRefs.values()];
  for (const changes of cardChanges.values()) for (const key of changes.keys()) refs.push(refFromKey(key));
  for (const key of loans.keys()) refs.push(refFromKey(key));
  const cardIds = new Set(cards.map((card) => card.id));
  for (const invoice of store.db.invoices) {
    if (!cardIds.has(invoice.cardId) || invoice.status === 'paid' || invoice.status === 'archived') continue;
    if (store.db.installments.some((i) => i.invoiceId === invoice.id && activePurchase(store, i.purchaseId))) refs.push(invoice.ref);
  }
  const sorted = refs.sort(compareRefs);
  const first = sorted.length ? sorted[0] : invoiceRefForDate(todayISO(), 1);
  const last = sorted.length ? sorted[sorted.length - 1] : first;
  const months: ScenarioMonth[] = [];
  for (let ref = first; compareRefs(ref, last) <= 0 && months.length < MAX_SCENARIO_MONTHS; ref = addMonths(ref, 1)) {
    const key = refKey(ref);
    const month: ScenarioMonth = {
      ref,
      cards: { beforeCents: 0, afterCents: 0 },
      mine: { beforeCents: 0, afterCents: 0 },
      loanPaymentsCents: loans.get(key)?.payments ?? 0,
      loanReceivedCents: loans.get(key)?.received ?? 0,
    };
    for (const card of cards) {
      const before = invoiceAmounts(store, store.findInvoice(card.id, ref), me.id);
      const change = cardChanges.get(card.id)!.get(key) ?? { cardCents: 0, myCents: 0 };
      month.cards.beforeCents += before.cardCents;
      month.cards.afterCents += before.cardCents + change.cardCents;
      month.mine.beforeCents += before.myCents;
      month.mine.afterCents += before.myCents + change.myCents;
    }
    months.push(month);
  }

  const limits: ScenarioCardLimit[] = cards.flatMap((card) => {
    const added = limitAdded.get(card.id);
    if (!added || !card.limitCents) return [];
    const availableBeforeCents = card.limitCents - usedLimitCents(store, card);
    return [{ card, availableBeforeCents, availableAfterCents: availableBeforeCents - added }];
  });

  return { me, months, limits, payoffs, openRefs: [...openRefs.entries()].map(([cardId, ref]) => ({ cardId, ref })) };
}
