import { can, type Card, type Category, formatBRL, type Invoice, isInvoiceLocked, type Payment, validatePayment } from '@/domain';
import { AppError } from '../errors';
import type { CategoryRepository, DashboardRepository, PaymentRepository } from '../repositories';
import { newId, nowISO, type MockStore } from './store';
import { currentInvoiceFor, invoiceDetails, purchaseListItem, todayISO, withActor } from './views';

export function createMockCategoryRepository(store: MockStore): CategoryRepository {
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

export function createMockPaymentRepository(store: MockStore): PaymentRepository {
  return {
    register: (input) =>
      store.run(
        () => {
          const invoice = store.require('invoices', input.invoiceId, 'Fatura') as Invoice;
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          const me = store.requireMembership(invoice.familyId);
          const isCardHolder = card.holderMemberId === me.id;
          // The holder confirms any payment; members can register their own.
          if (!can(me.role, 'payment.register', { isCardHolder }) && input.memberId !== me.id) {
            throw new AppError('forbidden', 'Você só pode registrar seus próprios pagamentos.');
          }
          if (input.memberId === card.holderMemberId) {
            throw new AppError('validation', 'A titular paga direto ao banco.');
          }
          const details = invoiceDetails(store, invoice);
          const balance = details.balances.find((b) => b.memberId === input.memberId);
          const error = validatePayment({
            owedCents: balance?.owedCents ?? 0,
            alreadyPaidCents: balance?.paidCents ?? 0,
            amountCents: input.amountCents,
          });
          if (error === 'exceeds_pending') {
            throw new AppError('validation', `O valor passa do que falta pagar (${formatBRL(balance!.pendingCents)}).`);
          }
          if (error === 'nothing_owed') throw new AppError('validation', 'Não há valor pendente para esta pessoa.');
          if (error) throw new AppError('validation', 'Informe um valor válido.');

          const payment: Payment = {
            id: newId('pay'),
            invoiceId: invoice.id,
            memberId: input.memberId,
            amountCents: input.amountCents,
            paidAt: nowISO(),
            registeredBy: store.currentUserId(),
            note: input.note,
          };
          store.db.payments.push(payment);
          const member = store.member(input.memberId);
          store.audit({
            familyId: invoice.familyId,
            entity: 'payment',
            entityId: payment.id,
            action: 'payment_registered',
            summary: `${member.displayName} pagou ${formatBRL(payment.amountCents)}`,
            changes: [],
          });
          return payment;
        },
        { write: true },
      ),
  };
}

export function createMockDashboardRepository(store: MockStore): DashboardRepository {
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

        return {
          me,
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
