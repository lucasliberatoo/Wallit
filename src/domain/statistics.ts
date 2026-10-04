import { addMonths, compareRefs, type InvoiceRef, refKey } from './invoice-period';
import { type Cents, sumCents } from './money';
import type { ID } from './types';

/** One installment (or one member's part of it) as statistics see it. */
export interface SpendingEntry {
  purchaseId: ID;
  ref: InvoiceRef;
  categoryId: ID;
  cardId: ID;
  memberId: ID;
  amountCents: Cents;
  installmentCount: number;
  /** The invoice is still to come (due date ahead). */
  isFuture: boolean;
}

export interface Breakdown {
  id: ID;
  totalCents: Cents;
  /** 0-1 of the period total. */
  share: number;
}

export interface MonthTotal {
  ref: InvoiceRef;
  totalCents: Cents;
}

export interface Statistics {
  totalCents: Cents;
  purchaseCount: number;
  months: MonthTotal[];
  byCategory: Breakdown[];
  byMember: Breakdown[];
  byCard: Breakdown[];
  /** Spending in purchases split into installments, inside the period. */
  installmentSpendCents: Cents;
  /** Installments still to be charged after the period's current month. */
  futureInstallmentsCents: Cents;
  averageMonthCents: Cents;
  /** Change from the previous month to the last month of the period, 0-1 based (null without data). */
  lastMonthChange: number | null;
}

function breakdown(entries: readonly SpendingEntry[], keyOf: (entry: SpendingEntry) => ID, total: Cents): Breakdown[] {
  const sums = new Map<ID, Cents>();
  for (const entry of entries) sums.set(keyOf(entry), (sums.get(keyOf(entry)) ?? 0) + entry.amountCents);
  return [...sums.entries()]
    .map(([id, totalCents]) => ({ id, totalCents, share: total === 0 ? 0 : totalCents / total }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Spending statistics over invoice months `from`..`to` (inclusive). Entries
 * are per member share, so a purchase split between two people counts once
 * in the totals and once per person in `byMember`.
 */
export function computeStatistics(entries: readonly SpendingEntry[], period: { from: InvoiceRef; to: InvoiceRef }): Statistics {
  const inPeriod = entries.filter((e) => compareRefs(e.ref, period.from) >= 0 && compareRefs(e.ref, period.to) <= 0);
  const totalCents = sumCents(inPeriod.map((e) => e.amountCents));

  const months: MonthTotal[] = [];
  for (let ref = period.from; compareRefs(ref, period.to) <= 0; ref = addMonths(ref, 1)) {
    const key = refKey(ref);
    months.push({ ref, totalCents: sumCents(inPeriod.filter((e) => refKey(e.ref) === key).map((e) => e.amountCents)) });
  }

  const last = months.at(-1);
  const previous = months.at(-2);
  const lastMonthChange =
    last && previous && previous.totalCents > 0 ? (last.totalCents - previous.totalCents) / previous.totalCents : null;

  return {
    totalCents,
    purchaseCount: new Set(inPeriod.map((e) => e.purchaseId)).size,
    months,
    byCategory: breakdown(inPeriod, (e) => e.categoryId, totalCents),
    byMember: breakdown(inPeriod, (e) => e.memberId, totalCents),
    byCard: breakdown(inPeriod, (e) => e.cardId, totalCents),
    installmentSpendCents: sumCents(inPeriod.filter((e) => e.installmentCount > 1).map((e) => e.amountCents)),
    futureInstallmentsCents: sumCents(
      entries.filter((e) => e.isFuture && e.installmentCount > 1 && compareRefs(e.ref, period.to) > 0).map((e) => e.amountCents),
    ),
    averageMonthCents: months.length === 0 ? 0 : Math.round(totalCents / months.length),
    lastMonthChange,
  };
}
