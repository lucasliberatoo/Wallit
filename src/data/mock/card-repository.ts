import { can, type Card, invoiceRefForDate, isValidDayOfMonth, type Wallet } from '@/domain';
import { AppError } from '../errors';
import type { WalletSummary } from '../models';
import type { CardRepository, WalletRepository } from '../repositories';
import { newId, nowISO, type MockStore } from './store';
import { cardSummary, todayISO } from './views';

export function createMockWalletRepository(store: MockStore): WalletRepository {
  const walletSummary = (wallet: Wallet): WalletSummary => ({
    wallet,
    cards: store.db.cards
      .filter((card) => card.walletId === wallet.id && card.status !== 'archived')
      .map((card) => cardSummary(store, card)),
  });

  return {
    list: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.db.wallets.filter((w) => w.familyId === familyId && !w.deletedAt).map(walletSummary);
      }),

    get: (walletId) =>
      store.run(() => {
        const wallet = store.require('wallets', walletId, 'Carteira') as Wallet;
        store.requireMembership(wallet.familyId);
        return walletSummary(wallet);
      }),

    create: ({ familyId, name }) =>
      store.run(
        () => {
          const me = store.requireMembership(familyId);
          if (!can(me.role, 'wallet.create')) throw new AppError('forbidden', 'Apenas o dono da família cria carteiras.');
          if (!name.trim()) throw new AppError('validation', 'Dê um nome para a carteira.');
          const wallet: Wallet = { id: newId('wal'), familyId, name: name.trim(), createdAt: nowISO() };
          store.db.wallets.push(wallet);
          store.audit({
            familyId,
            entity: 'wallet',
            entityId: wallet.id,
            action: 'created',
            summary: `Carteira criada: ${wallet.name}`,
            changes: [],
          });
          return wallet;
        },
        { write: true },
      ),
  };
}

export function createMockCardRepository(store: MockStore): CardRepository {
  return {
    listByFamily: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.db.cards
          .filter((card) => card.familyId === familyId && card.status !== 'archived')
          .map((card) => cardSummary(store, card));
      }),

    get: (cardId) =>
      store.run(() => {
        const card = store.require('cards', cardId, 'Cartão') as Card;
        store.requireMembership(card.familyId);
        return cardSummary(store, card);
      }),

    create: (input) =>
      store.run(
        () => {
          const wallet = store.require('wallets', input.walletId, 'Carteira') as Wallet;
          const me = store.requireMembership(wallet.familyId);
          if (!can(me.role, 'card.create') && input.holderMemberId !== me.id) {
            throw new AppError('forbidden', 'Você não pode criar cartões nesta família.');
          }
          if (!input.name.trim()) throw new AppError('validation', 'Dê um nome para o cartão.');
          if (!isValidDayOfMonth(input.closingDay) || !isValidDayOfMonth(input.dueDay)) {
            throw new AppError('validation', 'Dias de fechamento e vencimento devem ser entre 1 e 31.');
          }
          const holder = store.member(input.holderMemberId);
          if (holder.familyId !== wallet.familyId) throw new AppError('validation', 'Titular não faz parte da família.');
          const card: Card = {
            id: newId('crd'),
            familyId: wallet.familyId,
            walletId: wallet.id,
            name: input.name.trim(),
            holderMemberId: holder.id,
            theme: input.theme,
            brand: input.brand,
            limitCents: input.limitCents,
            closingDay: input.closingDay,
            dueDay: input.dueDay,
            status: 'active',
            createdAt: nowISO(),
          };
          store.db.cards.push(card);
          if (holder.role === 'member') holder.role = 'titular';
          // The current invoice exists from day one so it can be opened right away.
          store.getOrCreateInvoice(card, invoiceRefForDate(todayISO(), card.closingDay));
          store.audit({
            familyId: card.familyId,
            entity: 'card',
            entityId: card.id,
            action: 'created',
            summary: `Cartão criado: ${card.name}`,
            changes: [],
          });
          return card;
        },
        { write: true },
      ),
  };
}
