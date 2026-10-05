import { type Card, type Invoice, refKey, sumCents } from '../../domain';
import type { ReportPerson } from '../models';
import type { ReportRepository } from '../repositories';
import { nowISO, type Store } from './store';
import { balancesFor, canSeeAllBalances, invoiceLines } from './views';

/**
 * Monthly summary for the family group: every card's invoice of one month,
 * how much each person spent and paid, and the purchases behind it.
 */
export function createReportRepository(store: Store): ReportRepository {
  return {
    monthly: (familyId, ref) =>
      store.run(() => {
        const me = store.requireMembership(familyId);
        const family = store.require('families', familyId, 'Família') as { name: string };
        const invoices = (store.db.invoices as Invoice[]).filter((i) => i.familyId === familyId && refKey(i.ref) === refKey(ref));
        const people = new Map<string, ReportPerson>();
        const person = (memberId: string) => {
          let row = people.get(memberId);
          if (!row) {
            row = { member: store.member(memberId), spentCents: 0, paidCents: 0, awaitingCents: 0, pendingCents: 0, boughtCents: 0, holderOf: [] };
            people.set(memberId, row);
          }
          return row;
        };
        store.activeMembers(familyId).forEach((m) => person(m.id));

        const reportInvoices = [];
        const lines = [];
        for (const invoice of invoices) {
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          const invoiceLinesList = invoiceLines(store, invoice);
          const { balances, totals } = balancesFor(store, invoice, card, invoiceLinesList);
          if (invoiceLinesList.length === 0 && totals.totalCents === 0) continue;
          const holder = store.member(card.holderMemberId);
          person(holder.id).holderOf.push(card.name);
          for (const balance of balances) {
            const row = person(balance.memberId);
            row.spentCents += balance.owedCents;
            row.paidCents += Math.min(balance.paidCents, balance.owedCents);
            row.awaitingCents += Math.min(balance.awaitingCents, balance.pendingCents);
            row.pendingCents += balance.pendingCents;
          }
          reportInvoices.push({
            invoiceId: invoice.id,
            cardName: card.name,
            holderName: holder.displayName,
            dueDate: invoice.dueDate,
            status: invoice.status,
            totalCents: totals.totalCents,
          });
          for (const line of invoiceLinesList) {
            person(line.buyer.id).boughtCents += line.installment.amountCents;
            lines.push({
              date: line.purchase.date,
              merchant: line.purchase.merchant,
              cardName: card.name,
              buyerName: line.buyer.displayName,
              categoryName: line.category?.name ?? null,
              installment: line.purchase.installmentCount > 1 ? `${line.installment.number}/${line.purchase.installmentCount}` : null,
              amountCents: line.installment.amountCents,
              shares: line.shares.map((share) => ({ memberId: share.member.id, name: share.member.displayName, amountCents: share.amountCents })),
            });
          }
        }

        const seeAll = canSeeAllBalances(store, familyId, null, me);
        const rows = [...people.values()]
          .filter((row) => row.spentCents > 0 || row.boughtCents > 0 || row.holderOf.length > 0)
          .filter((row) => seeAll || row.member.id === me.id)
          .sort((a, b) => b.spentCents - a.spentCents);
        return {
          familyName: family.name,
          ref,
          generatedAt: nowISO(),
          people: rows,
          invoices: reportInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
          lines: seeAll
            ? lines.sort((a, b) => a.date.localeCompare(b.date))
            : lines.filter((line) => line.shares.some((s) => s.memberId === me.id)).sort((a, b) => a.date.localeCompare(b.date)),
          totals: {
            spentCents: sumCents(rows.map((r) => r.spentCents)),
            paidCents: sumCents(rows.map((r) => r.paidCents)),
            pendingCents: sumCents(rows.map((r) => r.pendingCents)),
          },
          restricted: !seeAll,
        };
      }),
  };
}
