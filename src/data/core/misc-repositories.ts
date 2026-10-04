import { can, type Card, type Category, type Invoice, isInvoiceLocked } from '../../domain';
import { AppError } from '../errors';
import type { CategoryRepository, DashboardRepository } from '../repositories';
import { newId, nowISO, type Store } from './store';
import { currentInvoiceFor, hasHolderPower, invoiceDetails, purchaseListItem, todayISO, withActor } from './views';

export function createCategoryRepository(store: Store): CategoryRepository {
  const requireManager = (familyId: string) => {
    const me = store.requireMembership(familyId);
    if (!can(me.role, 'category.manage')) throw new AppError('forbidden', 'Você não pode alterar categorias.');
  };

  return {
    list: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.db.categories.filter((c) => c.familyId === familyId && !c.deletedAt).sort((a, b) => a.order - b.order);
      }),

    create: (familyId, input) =>
      store.run(
        () => {
          requireManager(familyId);
          if (!input.name.trim()) throw new AppError('validation', 'Dê um nome para a categoria.');
          const order = store.db.categories.filter((c) => c.familyId === familyId).length;
          const category: Category = { id: newId('cat'), familyId, order, ...input, name: input.name.trim() };
          store.db.categories.push(category);
          return category;
        },
        { write: true },
      ),

    update: (categoryId, input) =>
      store.run(
        () => {
          const category = store.require('categories', categoryId, 'Categoria') as Category;
          requireManager(category.familyId);
          Object.assign(category, input);
          return category;
        },
        { write: true },
      ),

    remove: (categoryId) =>
      store.run(
        () => {
          const category = store.require('categories', categoryId, 'Categoria') as Category;
          requireManager(category.familyId);
          // Soft delete: old purchases keep showing their category.
          category.deletedAt = nowISO();
        },
        { write: true },
      ),

    reorder: (familyId, orderedIds) =>
      store.run(
        () => {
          requireManager(familyId);
          orderedIds.forEach((id, order) => {
            const category = store.find('categories', id) as Category | undefined;
            if (category && category.familyId === familyId) category.order = order;
          });
        },
        { write: true },
      ),
  };
}

export function createDashboardRepository(store: Store): DashboardRepository {
  return {
    home: (familyId) =>
      store.run(() => {
        const me = store.requireMembership(familyId);
        const cards = store.db.cards.filter((c) => c.familyId === familyId && c.status !== 'archived');
        const invoices = store.db.invoices.filter((i) => i.familyId === familyId);

        let owedCents = 0;
        let toReceiveCents = 0;
        let openInvoicesCount = 0;
        for (const invoice of invoices) {
          if (invoice.status === 'archived') continue;
          const details = invoiceDetails(store, invoice);
          const mine = details.balances.find((b) => b.memberId === me.id);
          // What I owe counts once the invoice amounts are final (closed onwards).
          if (mine && isInvoiceLocked(invoice.status)) owedCents += mine.pendingCents;
          if (details.card.holderMemberId === me.id && isInvoiceLocked(invoice.status)) {
            toReceiveCents += details.totals.pendingCents;
          }
          if (invoice.status === 'open' || invoice.status === 'reviewing') openInvoicesCount += 1;
        }

        let myCurrentShareCents = 0;
        let nextDue: { date: string; cardName: string; invoiceId: string } | null = null;
        for (const card of cards) {
          const current = currentInvoiceFor(store, card);
          if (!current) continue;
          const mine = invoiceDetails(store, current).balances.find((b) => b.memberId === me.id);
          myCurrentShareCents += mine?.owedCents ?? 0;
        }
        const today = todayISO();
        const upcoming = invoices
          .filter((i) => i.dueDate >= today && i.status !== 'paid' && i.status !== 'archived')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        if (upcoming) {
          const card = store.require('cards', upcoming.cardId, 'Cartão') as Card;
          nextDue = { date: upcoming.dueDate, cardName: card.name, invoiceId: upcoming.id };
        }

        const activePurchases = store.db.purchases.filter((p) => p.familyId === familyId && p.status === 'active');
        const recentPurchases = [...activePurchases]
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
          .slice(0, 5)
          .map((p) => purchaseListItem(store, p));

        let installmentCount = 0;
        let remainingCents = 0;
        for (const purchase of activePurchases.filter((p) => p.installmentCount > 1)) {
          const future = store.db.installments.filter((i) => {
            if (i.purchaseId !== purchase.id) return false;
            const invoice = store.find('invoices', i.invoiceId) as Invoice | undefined;
            return invoice ? invoice.dueDate >= today : false;
          });
          if (future.length > 0) {
            installmentCount += 1;
            remainingCents += future.reduce((sum, i) => sum + i.amountCents, 0);
          }
        }

        // Pending actions: purchases to confirm, payments to confirm as holder.
        let toReviewCount = 0;
        let toReviewInvoice: string | null = null;
        let paymentsCount = 0;
        let paymentsInvoice: string | null = null;
        for (const invoice of invoices) {
          if (invoice.status === 'reviewing') {
            const waiting = invoiceDetails(store, invoice).lines.filter((line) => line.review.awaitingMe).length;
            if (waiting > 0) {
              toReviewCount += waiting;
              toReviewInvoice ??= invoice.id;
            }
          }
          const card = cards.find((c) => c.id === invoice.cardId) ?? (store.find('cards', invoice.cardId) as Card);
          if (hasHolderPower(card, me)) {
            const awaiting = store.db.payments.filter((p) => p.invoiceId === invoice.id && p.status === 'pending').length;
            if (awaiting > 0) {
              paymentsCount += awaiting;
              paymentsInvoice ??= invoice.id;
            }
          }
        }

        return {
          me,
          toReview: { count: toReviewCount, invoiceId: toReviewInvoice },
          paymentsToConfirm: { count: paymentsCount, invoiceId: paymentsInvoice },
          owedCents,
          toReceiveCents,
          nextDue,
          openInvoicesCount,
          recentPurchases,
          activeInstallments: { count: installmentCount, remainingCents },
          myCurrentShareCents,
        };
      }),

    activity: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.db.auditLogs
          .filter((log) => log.familyId === familyId)
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 100)
          .map((log) => withActor(store, log));
      }),
  };
}
