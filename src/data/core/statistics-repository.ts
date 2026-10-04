import { type Card, compareRefs, computeStatistics, type Invoice, type SpendingEntry } from '../../domain';
import { AppError } from '../errors';
import type { StatisticsRepository } from '../repositories';
import type { Store } from './store';
import { installmentShares, todayISO } from './views';

const MAX_MONTHS = 24;

export function createStatisticsRepository(store: Store): StatisticsRepository {
  return {
    get: (familyId, filters) =>
      store.run(() => {
        store.requireMembership(familyId);
        if (compareRefs(filters.from, filters.to) > 0) throw new AppError('validation', 'O período começa depois de terminar.');
        const months = (filters.to.year - filters.from.year) * 12 + filters.to.month - filters.from.month + 1;
        if (months > MAX_MONTHS) throw new AppError('validation', `Escolha um período de até ${MAX_MONTHS} meses.`);

        const today = todayISO();
        const entries: SpendingEntry[] = [];
        for (const purchase of store.db.purchases) {
          if (purchase.familyId !== familyId || purchase.status !== 'active') continue;
          if (filters.cardId && purchase.cardId !== filters.cardId) continue;
          if (filters.categoryId && purchase.categoryId !== filters.categoryId) continue;
          for (const installment of store.db.installments.filter((i) => i.purchaseId === purchase.id)) {
            const invoice = store.require('invoices', installment.invoiceId, 'Fatura') as Invoice;
            for (const share of installmentShares(store, installment)) {
              if (filters.memberId && share.member.id !== filters.memberId) continue;
              entries.push({
                purchaseId: purchase.id,
                ref: invoice.ref,
                categoryId: purchase.categoryId,
                cardId: purchase.cardId,
                memberId: share.member.id,
                amountCents: share.amountCents,
                installmentCount: purchase.installmentCount,
                isFuture: invoice.dueDate >= today,
              });
            }
          }
        }

        return {
          ...computeStatistics(entries, { from: filters.from, to: filters.to }),
          categories: store.db.categories.filter((c) => c.familyId === familyId),
          members: store.db.members.filter((m) => m.familyId === familyId),
          cards: store.db.cards.filter((c: Card) => c.familyId === familyId),
        };
      }),
  };
}
