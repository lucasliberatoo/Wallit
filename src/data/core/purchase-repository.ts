import { formatBRL, type Purchase } from '../../domain';
import { AppError } from '../errors';
import type { CreatePurchaseInput } from '../models';
import type { PurchaseRepository } from '../repositories';
import { purchaseLink } from './labels';
import { notify } from './notify';
import { insertPurchase, updatePurchaseRecord } from './purchase-core';
import type { Store } from './store';
import { canEditPurchase, purchaseDetails, purchaseListItem, purchaseShares } from './views';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function createPurchaseRepository(store: Store): PurchaseRepository {
  const requireEditable = (purchaseId: string) => {
    const purchase = store.require('purchases', purchaseId, 'Compra') as Purchase;
    if (!canEditPurchase(store, purchase)) {
      throw new AppError('invoice_locked', 'Esta compra está numa fatura fechada. Só a titular pode alterar.');
    }
    return purchase;
  };

  return {
    create: (input) =>
      store.run(
        () => {
          store.requireMembership(input.familyId);
          const purchase = insertPurchase(store, input, store.currentUserId());
          for (const share of purchaseShares(store, purchase.id)) {
            notify(store, {
              familyId: purchase.familyId,
              memberIds: [share.member.id],
              type: 'purchase_added',
              title: 'Nova compra para você',
              body:
                purchase.installmentCount > 1
                  ? `${purchase.merchant}: ${purchase.installmentCount}x. Sua parte: ${purchase.installmentCount}x de ${formatBRL(Math.floor(share.amountCents / purchase.installmentCount))} (total ${formatBRL(share.amountCents)}).`
                  : `${purchase.merchant}: ${formatBRL(purchase.totalCents)}. Sua parte: ${formatBRL(share.amountCents)}.`,
              link: purchaseLink(purchase.id),
            });
          }
          return purchaseDetails(store, purchase);
        },
        { write: true },
      ),

    update: (purchaseId, changes) =>
      store.run(
        () => {
          const purchase = requireEditable(purchaseId);
          const next: CreatePurchaseInput = {
            familyId: purchase.familyId,
            cardId: purchase.cardId,
            installmentCount: purchase.installmentCount,
            merchant: changes.merchant ?? purchase.merchant,
            statementName: changes.statementName ?? purchase.statementName,
            totalCents: changes.totalCents ?? purchase.totalCents,
            date: changes.date ?? purchase.date,
            categoryId: changes.categoryId ?? purchase.categoryId,
            buyerMemberId: changes.buyerMemberId ?? purchase.buyerMemberId,
            note: changes.note ?? purchase.note,
            shares:
              changes.shares ?? purchaseShares(store, purchase.id).map((s) => ({ memberId: s.member.id, amountCents: s.amountCents })),
          };
          return purchaseDetails(store, updatePurchaseRecord(store, purchase, next, store.currentUserId()));
        },
        { write: true },
      ),

    cancel: (purchaseId) =>
      store.run(
        () => {
          const purchase = requireEditable(purchaseId);
          // Rule 14: soft delete, the purchase stays in history.
          purchase.status = 'cancelled';
          purchase.updatedAt = new Date().toISOString();
          store.audit({
            familyId: purchase.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'cancelled',
            summary: `Compra cancelada: ${purchase.merchant}`,
            changes: [],
          });
        },
        { write: true },
      ),

    get: (purchaseId) => store.run(() => purchaseDetails(store, store.require('purchases', purchaseId, 'Compra') as Purchase)),

    search: (familyId, filters) =>
      store.run(() => {
        store.requireMembership(familyId);
        const term = filters.search ? normalize(filters.search.trim()) : '';
        return store.db.purchases
          .filter((p) => p.familyId === familyId && p.status === 'active')
          .filter((p) => !filters.cardId || p.cardId === filters.cardId)
          .filter((p) => !filters.categoryId || p.categoryId === filters.categoryId)
          .filter((p) => !filters.buyerMemberId || p.buyerMemberId === filters.buyerMemberId)
          .filter((p) => !filters.onlyInstallments || p.installmentCount > 1)
          .filter((p) => !filters.from || p.date >= filters.from)
          .filter((p) => !filters.to || p.date <= filters.to)
          .filter(
            (p) =>
              !filters.memberId ||
              p.buyerMemberId === filters.memberId ||
              store.db.shares.some((s) => s.purchaseId === p.id && s.memberId === filters.memberId),
          )
          .filter((p) => !term || normalize(`${p.merchant} ${p.statementName ?? ''} ${p.note ?? ''}`).includes(term))
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
          .map((p) => purchaseListItem(store, p));
      }),
  };
}
