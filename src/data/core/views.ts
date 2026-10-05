import {
  allocateSharesToInstallments,
  type AuditLog,
  can,
  type Card,
  compareRefs,
  computeInvoiceTotals,
  computeMemberBalances,
  type DebtLine,
  type Family,
  type FamilyMember,
  type ID,
  type Invoice,
  invoiceRefForDate,
  isInvoiceLocked,
  lineReviewState,
  type Purchase,
  type PurchaseInstallment,
  type PurchaseReview,
  reviewProgress,
} from '../../domain';
import type {
  AuditLogView,
  CardSummary,
  InvoiceDetails,
  InvoiceLine,
  InvoiceListItem,
  DisputeView,
  LineReview,
  PurchaseDetails,
  PurchaseListItem,
  ShareView,
} from '../models';
import { anticipatableInstallments, anticipationTargetRef } from './anticipation';
import type { Store } from './store';

/** Today's date in São Paulo-agnostic local form (YYYY-MM-DD). */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function purchaseShares(store: Store, purchaseId: ID): ShareView[] {
  return store.db.shares
    .filter((share) => share.purchaseId === purchaseId)
    .map((share) => ({ member: store.member(share.memberId), amountCents: share.amountCents }));
}

function purchaseInstallments(store: Store, purchaseId: ID): PurchaseInstallment[] {
  return store.db.installments.filter((installment) => installment.purchaseId === purchaseId).sort((a, b) => a.number - b.number);
}

/** Each member's part of one installment, derived from the purchase shares. */
export function installmentShares(store: Store, installment: PurchaseInstallment): ShareView[] {
  const shares = purchaseShares(store, installment.purchaseId);
  const amounts = purchaseInstallments(store, installment.purchaseId).map((i) => i.amountCents);
  const matrix = allocateSharesToInstallments(
    amounts,
    shares.map((share) => ({ memberId: share.member.id, amountCents: share.amountCents })),
  );
  const row = matrix[installment.number - 1];
  return shares.map((share, index) => ({ member: share.member, amountCents: row[index] })).filter((share) => share.amountCents > 0);
}

function activePurchase(store: Store, purchaseId: ID): Purchase | undefined {
  const purchase = store.find('purchases', purchaseId) as Purchase | undefined;
  return purchase && purchase.status === 'active' ? purchase : undefined;
}

/** Holder of the card, or the family owner, manages its invoices. */
export function hasHolderPower(card: Card, member: FamilyMember): boolean {
  return can(member.role, 'invoice.changeStatus', { isCardHolder: card.holderMemberId === member.id });
}

/**
 * Who answers for a card's invoices: the holder, or the family owners when
 * the holder doesn't use the app (e.g. the grandmother's card).
 */
export function cardManagerIds(store: Store, card: Card): ID[] {
  const holder = store.member(card.holderMemberId);
  if (holder.userId && holder.status === 'active') return [holder.id];
  return store
    .activeMembers(card.familyId)
    .filter((m) => m.role === 'owner' && m.userId)
    .map((m) => m.id);
}

/** Who confirms a purchase in a review: buyer and payers that use the app. */
export function reviewerIds(store: Store, purchaseId: ID, buyerMemberId: ID): ID[] {
  const ids = new Set([buyerMemberId, ...store.db.shares.filter((s) => s.purchaseId === purchaseId).map((s) => s.memberId)]);
  return [...ids].filter((id) => {
    const member = store.find('members', id) as FamilyMember | undefined;
    return Boolean(member && member.status === 'active' && member.userId);
  });
}

export function disputeViews(store: Store, reviews: readonly PurchaseReview[]): DisputeView[] {
  return reviews.map((review) => ({ review, member: store.member(review.memberId) }));
}

function lineReview(store: Store, invoice: Invoice, purchase: Purchase, meId: ID | null): LineReview {
  const reviews = store.db.reviews.filter((r) => r.invoiceId === invoice.id && r.purchaseId === purchase.id);
  const reviewers = reviewerIds(store, purchase.id, purchase.buyerMemberId);
  const state = lineReviewState(reviewers, reviews);
  const myReview = (meId && reviews.find((r) => r.memberId === meId)) || null;
  return {
    status: state.status,
    pendingMembers: state.pendingMemberIds.map((id) => store.member(id)),
    disputes: disputeViews(store, state.disputes),
    myReview,
    awaitingMe: invoice.status === 'reviewing' && meId !== null && state.pendingMemberIds.includes(meId),
  };
}

export function invoiceLines(store: Store, invoice: Invoice, meId: ID | null = null): InvoiceLine[] {
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
          review: lineReview(store, invoice, purchase, meId),
          attachmentCount: store.db.attachments.filter((a) => a.purchaseId === purchase.id && !a.deletedAt).length,
        },
      ];
    })
    .sort((a, b) => b.purchase.date.localeCompare(a.purchase.date));
}

export function balancesFor(store: Store, invoice: Invoice, card: Card, lines: InvoiceLine[]) {
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

export function invoiceDetails(store: Store, invoice: Invoice): InvoiceDetails {
  const me = store.requireMembership(invoice.familyId);
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const lines = invoiceLines(store, invoice, me.id);
  const { balances, payments, totals } = balancesFor(store, invoice, card, lines);
  const holder = store.member(card.holderMemberId);
  const holderUser = holder.userId ? store.db.users.find((u) => u.id === holder.userId) : undefined;
  return {
    invoice,
    card,
    holder,
    lines,
    balances: balances.map((balance) => ({ ...balance, member: store.member(balance.memberId) })).sort((a, b) => b.owedCents - a.owedCents),
    totals,
    payments: [...payments]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .map((payment) => ({ ...payment, member: store.member(payment.memberId) })),
    me,
    reviewProgress: reviewProgress(lines.map((line) => line.review)),
    canManage: hasHolderPower(card, me),
    holderPixKey: holderUser?.pixKey ?? null,
  };
}

/**
 * Family setting "only managers see how much each person owes": members who
 * don't manage the card see just their own balance and payments.
 */
export function canSeeAllBalances(store: Store, familyId: ID, card: Card | null, me: FamilyMember): boolean {
  const family = store.find('families', familyId) as Family | undefined;
  if ((family?.balancesVisibility ?? 'everyone') === 'everyone') return true;
  if (me.role === 'owner') return true;
  return card ? hasHolderPower(card, me) : false;
}

export function visibleInvoiceDetails(store: Store, details: InvoiceDetails): InvoiceDetails {
  if (canSeeAllBalances(store, details.invoice.familyId, details.card, details.me)) return details;
  const meId = details.me.id;
  return {
    ...details,
    balances: details.balances.filter((b) => b.memberId === meId),
    payments: details.payments.filter((p) => p.memberId === meId),
    balancesRestricted: true,
  };
}

export function invoiceListItem(store: Store, invoice: Invoice, me: FamilyMember): InvoiceListItem {
  const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
  const { balances, totals } = balancesFor(store, invoice, card, invoiceLines(store, invoice));
  return { invoice, card, totals, myBalance: balances.find((b) => b.memberId === me.id) ?? null };
}

export function currentInvoiceFor(store: Store, card: Card): Invoice | null {
  return store.findInvoice(card.id, invoiceRefForDate(todayISO(), card.closingDay)) ?? null;
}

export function cardSummary(store: Store, card: Card): CardSummary {
  const currentInvoice = currentInvoiceFor(store, card);
  const totals = currentInvoice
    ? balancesFor(store, currentInvoice, card, invoiceLines(store, currentInvoice)).totals
    : computeInvoiceTotals([]);
  return { card, holder: store.member(card.holderMemberId), currentInvoice, totals };
}

export function sortInvoicesDesc(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => compareRefs(b.ref, a.ref));
}

export function purchaseListItem(store: Store, purchase: Purchase, installment?: PurchaseInstallment): PurchaseListItem {
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
export function canEditPurchase(store: Store, purchase: Purchase): boolean {
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

export function withActor(store: Store, log: AuditLog): AuditLogView {
  const user = store.db.users.find((u) => u.id === log.actorUserId);
  return { ...log, actorName: user?.name ?? 'Alguém' };
}

function anticipationInfo(store: Store, purchase: Purchase, card: Card, me: FamilyMember): PurchaseDetails['anticipation'] {
  if (purchase.status !== 'active' || purchase.installmentCount < 2) return null;
  if (!canEditPurchase(store, purchase) && !hasHolderPower(card, me)) return null;
  const targetRef = anticipationTargetRef(store, card);
  const installments = anticipatableInstallments(store, purchase, targetRef);
  if (installments.length === 0) return null;
  return {
    available: installments.length,
    availableCents: installments.reduce((sum, installment) => sum + installment.amountCents, 0),
    targetRef,
  };
}

export function purchaseDetails(store: Store, purchase: Purchase): PurchaseDetails {
  const me = store.requireMembership(purchase.familyId);
  const card = store.require('cards', purchase.cardId, 'Cartão') as Card;
  const reviewingInvoice = purchaseInstallments(store, purchase.id)
    .map((installment) => store.find('invoices', installment.invoiceId) as Invoice | undefined)
    .find((invoice) => invoice?.status === 'reviewing');
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
    canManage: hasHolderPower(card, me),
    me,
    anticipation: anticipationInfo(store, purchase, card, me),
    review: reviewingInvoice ? { invoiceId: reviewingInvoice.id, ...lineReview(store, reviewingInvoice, purchase, me.id) } : null,
    attachments: store.db.attachments
      .filter((a) => a.purchaseId === purchase.id && !a.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    disputes: disputeViews(
      store,
      store.db.reviews.filter((r) => r.purchaseId === purchase.id && (r.status === 'disputed' || r.status === 'resolved')),
    ),
  };
}
