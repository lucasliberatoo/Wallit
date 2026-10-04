import {
  can,
  type Card,
  type Category,
  type FieldChange,
  formatBRL,
  type ID,
  type Invoice,
  isInvoiceLocked,
  MAX_INSTALLMENTS,
  planInstallments,
  type Purchase,
  validateSplit,
  describeSplit,
} from '../../domain';
import { AppError } from '../errors';
import type { CreatePurchaseInput } from '../models';
import { findAlias, learnAlias } from './alias-repository';
import { newId, nowISO, type Store } from './store';

/** A purchase typed with only the statement name gets the family's alias. */
function withAlias(store: Store, input: CreatePurchaseInput): CreatePurchaseInput {
  if (input.merchant.trim()) return input;
  const alias = findAlias(store, input.familyId, input.statementName);
  return alias ? { ...input, merchant: alias.merchant } : input;
}

function validate(store: Store, input: CreatePurchaseInput): Card {
  const card = store.require('cards', input.cardId, 'Cartão') as Card;
  if (card.familyId !== input.familyId) throw new AppError('validation', 'Cartão não pertence a esta família.');
  if (!input.merchant.trim()) throw new AppError('validation', 'Informe o estabelecimento.');
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > MAX_INSTALLMENTS) {
    throw new AppError('validation', `Parcelamento deve ser entre 1x e ${MAX_INSTALLMENTS}x.`);
  }
  // Rule 3: a purchase needs a buyer from the family.
  const familyMemberIds = new Set(store.activeMembers(input.familyId).map((m) => m.id));
  if (!familyMemberIds.has(input.buyerMemberId)) throw new AppError('validation', 'Escolha quem comprou.');
  const category = store.find('categories', input.categoryId) as Category | undefined;
  if (!category || category.familyId !== input.familyId || category.deletedAt) {
    throw new AppError('validation', 'Escolha uma categoria.');
  }
  if (input.shares.some((share) => !familyMemberIds.has(share.memberId))) {
    throw new AppError('validation', 'Responsável não faz parte da família.');
  }
  // Rule 1/2: shares must add up exactly to the total, with no negative values.
  const split = validateSplit(input.totalCents, input.shares);
  if (split.status !== 'complete') throw new AppError('validation', describeSplit(split));
  return card;
}

/** Rule 4/5/6: links each installment to its invoice; one installment per invoice. */
function writeInstallments(store: Store, purchase: Purchase, card: Card, actorMemberCanEditLocked: boolean): void {
  const plan = planInstallments({
    totalCents: purchase.totalCents,
    count: purchase.installmentCount,
    purchaseDate: purchase.date,
    closingDay: card.closingDay,
  });
  for (const planned of plan) {
    const invoice = store.getOrCreateInvoice(card, planned.invoiceRef);
    if (isInvoiceLocked(invoice.status) && !actorMemberCanEditLocked) {
      throw new AppError('invoice_locked', 'Essa compra cairia numa fatura já fechada. Peça à titular.');
    }
    store.db.installments.push({
      id: newId('ins'),
      purchaseId: purchase.id,
      invoiceId: invoice.id,
      number: planned.number,
      count: planned.count,
      amountCents: planned.amountCents,
    });
  }
}

function canEditLocked(store: Store, card: Card, actorUserId: ID): boolean {
  const member = store.db.members.find((m) => m.familyId === card.familyId && m.userId === actorUserId && m.status === 'active');
  if (!member) return false;
  return can(member.role, 'invoice.editLocked', { isCardHolder: card.holderMemberId === member.id });
}

export function insertPurchase(store: Store, rawInput: CreatePurchaseInput, actorUserId: ID, createdAt = nowISO()): Purchase {
  const input = withAlias(store, rawInput);
  const card = validate(store, input);
  const purchase: Purchase = {
    id: newId('pur'),
    familyId: input.familyId,
    cardId: input.cardId,
    merchant: input.merchant.trim(),
    statementName: input.statementName?.trim() || undefined,
    totalCents: input.totalCents,
    date: input.date,
    categoryId: input.categoryId,
    buyerMemberId: input.buyerMemberId,
    installmentCount: input.installmentCount,
    note: input.note?.trim() || undefined,
    status: 'active',
    createdBy: actorUserId,
    createdAt,
    updatedAt: createdAt,
  };

  const snapshot = { installments: store.db.installments.length, invoices: store.db.invoices.length };
  try {
    writeInstallments(store, purchase, card, canEditLocked(store, card, actorUserId));
  } catch (error) {
    // Keep the write atomic, like a database transaction would.
    store.db.installments.length = snapshot.installments;
    store.db.invoices.length = snapshot.invoices;
    throw error;
  }

  store.db.purchases.push(purchase);
  for (const share of input.shares) {
    store.db.shares.push({ id: newId('shr'), purchaseId: purchase.id, memberId: share.memberId, amountCents: share.amountCents });
  }
  store.db.auditLogs.push({
    id: newId('log'),
    familyId: purchase.familyId,
    entity: 'purchase',
    entityId: purchase.id,
    action: 'created',
    summary: `Compra registrada: ${purchase.merchant}, ${formatBRL(purchase.totalCents)}`,
    changes: [],
    actorUserId,
    at: createdAt,
  });
  learnAlias(store, purchase, actorUserId);
  return purchase;
}

function sharesLabel(store: Store, purchaseId: ID): string {
  return store.db.shares
    .filter((share) => share.purchaseId === purchaseId)
    .map((share) => `${store.member(share.memberId).displayName} ${formatBRL(share.amountCents)}`)
    .join(', ');
}

/**
 * Section 18: edits never silently erase data; every relevant change is
 * recorded with before/after values.
 */
export function updatePurchaseRecord(store: Store, purchase: Purchase, rawNext: CreatePurchaseInput, actorUserId: ID): Purchase {
  const next = withAlias(store, rawNext);
  const card = validate(store, next);
  const changes: FieldChange[] = [];
  const track = (field: string, from: string | undefined, to: string | undefined) => {
    if ((from ?? '') !== (to ?? '')) changes.push({ field, from: from ?? null, to: to ?? null });
  };

  const sharesBefore = sharesLabel(store, purchase.id);
  track('Estabelecimento', purchase.merchant, next.merchant.trim());
  track('Nome na fatura', purchase.statementName, next.statementName?.trim() || undefined);
  track('Valor', formatBRL(purchase.totalCents), formatBRL(next.totalCents));
  track('Data', purchase.date, next.date);
  track('Categoria', categoryName(store, purchase.categoryId), categoryName(store, next.categoryId));
  track('Quem comprou', store.member(purchase.buyerMemberId).displayName, store.member(next.buyerMemberId).displayName);
  track('Observação', purchase.note, next.note?.trim() || undefined);

  const regenerate = purchase.totalCents !== next.totalCents || purchase.date !== next.date;
  const previousInstallments = store.db.installments.filter((i) => i.purchaseId === purchase.id);
  const updated: Purchase = {
    ...purchase,
    merchant: next.merchant.trim(),
    statementName: next.statementName?.trim() || undefined,
    totalCents: next.totalCents,
    date: next.date,
    categoryId: next.categoryId,
    buyerMemberId: next.buyerMemberId,
    note: next.note?.trim() || undefined,
    updatedAt: nowISO(),
  };

  if (regenerate) {
    store.db.installments = store.db.installments.filter((i) => i.purchaseId !== purchase.id);
    try {
      writeInstallments(store, updated, card, canEditLocked(store, card, actorUserId));
    } catch (error) {
      store.db.installments = [...store.db.installments.filter((i) => i.purchaseId !== purchase.id), ...previousInstallments];
      throw error;
    }
  }

  store.db.shares = store.db.shares.filter((share) => share.purchaseId !== purchase.id);
  for (const share of next.shares) {
    store.db.shares.push({ id: newId('shr'), purchaseId: purchase.id, memberId: share.memberId, amountCents: share.amountCents });
  }
  const sharesAfter = sharesLabel(store, purchase.id);
  track('Divisão', sharesBefore, sharesAfter);

  // Confirmations were about the old values: everyone checks the purchase again.
  if (regenerate || sharesBefore !== sharesAfter || purchase.buyerMemberId !== next.buyerMemberId) {
    store.db.reviews = store.db.reviews.filter((review) => review.purchaseId !== purchase.id || review.status === 'resolved');
  }

  Object.assign(purchase, updated);
  learnAlias(store, purchase, actorUserId);
  if (changes.length > 0) {
    store.audit({
      familyId: purchase.familyId,
      entity: 'purchase',
      entityId: purchase.id,
      action: 'updated',
      summary: changes.length === 1 ? `${changes[0].field} alterado` : `${changes.length} campos alterados`,
      changes,
      actorUserId,
    });
  }
  return purchase;
}

function categoryName(store: Store, categoryId: ID): string | undefined {
  return (store.find('categories', categoryId) as Category | undefined)?.name;
}

export function purchaseInvoices(store: Store, purchaseId: ID): Invoice[] {
  return store.db.installments
    .filter((i) => i.purchaseId === purchaseId)
    .map((i) => store.require('invoices', i.invoiceId, 'Fatura') as Invoice);
}
