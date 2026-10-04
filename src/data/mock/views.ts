import {
  allocateSharesToInstallments,
  type AuditLog,
  can,
  type Card,
  compareRefs,
  computeInvoiceTotals,
  computeMemberBalances,
  type DebtLine,
  type FamilyMember,
  type ID,
  type Invoice,
  invoiceRefForDate,
  isInvoiceLocked,
  type Purchase,
  type PurchaseInstallment,
} from '@/domain';
import type {
  AuditLogView,
  CardSummary,
  InvoiceDetails,
  InvoiceLine,
  InvoiceListItem,
  PurchaseDetails,
  PurchaseListItem,
  ShareView,
} from '../models';
import type { MockStore } from './store';

/** Today's date in São Paulo-agnostic local form (YYYY-MM-DD). */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function purchaseShares(store: MockStore, purchaseId: ID): ShareView[] {
  return store.db.shares
    .filter((share) => share.purchaseId === purchaseId)
    .map((share) => ({ member: store.member(share.memberId), amountCents: share.amountCents }));
}

function purchaseInstallments(store: MockStore, purchaseId: ID): PurchaseInstallment[] {
  return store.db.installments
    .filter((installment) => installment.purchaseId === purchaseId)
    .sort((a, b) => a.number - b.number);
}

/** Each member's part of one installment, derived from the purchase shares. */
export function installmentShares(store: MockStore, installment: PurchaseInstallment): ShareView[] {
  const shares = purchaseShares(store, installment.purchaseId);
  const amounts = purchaseInstallments(store, installment.purchaseId).map((i) => i.amountCents);
  const matrix = allocateSharesToInstallments(
    amounts,
    shares.map((share) => ({ memberId: share.member.id, amountCents: share.amountCents })),
  );
  const row = matrix[installment.number - 1];
  return shares
    .map((share, index) => ({ member: share.member, amountCents: row[index] }))
    .filter((share) => share.amountCents > 0);
}

function activePurchase(store: MockStore, purchaseId: ID): Purchase | undefined {
  const purchase = store.find('purchases', purchaseId) as Purchase | undefined;
  return purchase && purchase.status === 'active' ? purchase : undefined;
}

export function invoiceLines(store: MockStore, invoice: Invoice): InvoiceLine[] {
  return store.db.installments
    .filter((installment) => installment.invoiceId === invoice.id)
    .flatMap((installment) => {
      const purchase = activePurchase(store, installment.purchaseId);
      if (!purchase) return [];
      return [
        {
          installment,
          purchase,
          category: store.db.categories.find((c) => c.id === purchase.categoryId) ?? null,
          buyer: store.member(purchase.buyerMemberId),
          shares: installmentShares(store, installment),
        },
      ];
    })
    .sort((a, b) => b.purchase.date.localeCompare(a.purchase.date));
}

function balancesFor(store: MockStore, invoice: Invoice, card: Card, lines: InvoiceLine[]) {
  const debts: DebtLine[] = lines.flatMap((line) =>
    line.shares.map((share) => ({ memberId: share.member.id, amountCents: share.amountCents })),
  );
  const payments = store.db.payments.filter((payment) => payment.invoiceId === invoice.id);
  const members = store.activeMembers(invoice.familyId);
  const balances = computeMemberBalances({
    memberIds: members.map((m) => m.id),
    holderMemberId: card.holderMemberId,
    debts,
    payments,
  });
  return { balances, payments, totals: computeInvoiceTotals(balances) };
}

export function invoiceDetails(store: MockStore, invoice: Invoice): InvoiceDetails {
  const me = store.requireMembership(invoice.familyId);
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const lines = invoiceLines(store, invoice);
  const { balances, payments, totals } = balancesFor(store, invoice, card, lines);
  return {
    invoice,
    card,
    holder: store.member(card.holderMemberId),
    lines,
    balances: balances
      .map((balance) => ({ ...balance, member: store.member(balance.memberId) }))
      .sort((a, b) => b.owedCents - a.owedCents),
    totals,
    payments,
    me,
  };
}

export function invoiceListItem(store: MockStore, invoice: Invoice, me: FamilyMember): InvoiceListItem {
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const { balances, totals } = balancesFor(store, invoice, card, invoiceLines(store, invoice));
  return { invoice, card, totals, myBalance: balances.find((b) => b.memberId === me.id) ?? null };
}

export function currentInvoiceFor(store: MockStore, card: Card): Invoice | null {
  return store.findInvoice(card.id, invoiceRefForDate(todayISO(), card.closingDay)) ?? null;
}

export function cardSummary(store: MockStore, card: Card): CardSummary {
  const currentInvoice = currentInvoiceFor(store, card);
  const totals = currentInvoice
    ? balancesFor(store, currentInvoice, card, invoiceLines(store, currentInvoice)).totals
    : computeInvoiceTotals([]);
  return { card, holder: store.member(card.holderMemberId), currentInvoice, totals };
}

export function sortInvoicesDesc(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => compareRefs(b.ref, a.ref));
}

export function purchaseListItem(
  store: MockStore,
  purchase: Purchase,
  installment?: PurchaseInstallment,
): PurchaseListItem {
  return {
    purchase,
    category: store.db.categories.find((c) => c.id === purchase.categoryId) ?? null,
    buyer: store.member(purchase.buyerMemberId),
    card: store.require('cards', purchase.cardId, 'Cartão') as Card,
    payers: purchaseShares(store, purchase.id).map((share) => share.member),
    installment,
  };
}

/** Rule 10 + section 18: editable while invoices are open; afterwards only holder/owner. */
export function canEditPurchase(store: MockStore, purchase: Purchase): boolean {
  if (purchase.status !== 'active') return false;
  const me = store.requireMembership(purchase.familyId);
  const card = store.require('cards', purchase.cardId, 'Cartão') as Card;
  const isCardHolder = card.holderMemberId === me.id;
  const locked = purchaseInstallments(store, purchase.id).some((installment) => {
    const invoice = store.find('invoices', installment.invoiceId) as Invoice | undefined;
    return invoice ? isInvoiceLocked(invoice.status) : false;
  });
  if (locked) return can(me.role, 'invoice.editLocked', { isCardHolder });
  return can(me.role, 'purchase.edit', { isCardHolder });
}

export function withActor(store: MockStore, log: AuditLog): AuditLogView {
  const user = store.db.users.find((u) => u.id === log.actorUserId);
  return { ...log, actorName: user?.name ?? 'Alguém' };
}

export function purchaseDetails(store: MockStore, purchase: Purchase): PurchaseDetails {
  store.requireMembership(purchase.familyId);
  return {
    purchase,
    category: store.db.categories.find((c) => c.id === purchase.categoryId) ?? null,
    buyer: store.member(purchase.buyerMemberId),
    card: store.require('cards', purchase.cardId, 'Cartão') as Card,
    shares: purchaseShares(store, purchase.id),
    installments: purchaseInstallments(store, purchase.id).map((installment) => ({
      installment,
      invoice: store.require('invoices', installment.invoiceId, 'Fatura') as Invoice,
    })),
    history: store.db.auditLogs
      .filter((log) => log.entity === 'purchase' && log.entityId === purchase.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((log) => withActor(store, log)),
    canEdit: canEditPurchase(store, purchase),
  };
}
