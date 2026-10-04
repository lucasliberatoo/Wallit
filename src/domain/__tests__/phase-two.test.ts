import { normalizeStatementName } from '../aliases';
import { dataUrlSize } from '../attachments';
import { computeMemberBalances, computeInvoiceTotals, validatePayment } from '../balances';
import { lineReviewState, reviewProgress } from '../review';
import { computeStatistics, type SpendingEntry } from '../statistics';
import type { PurchaseReview } from '../types';

const review = (memberId: string, status: PurchaseReview['status']): PurchaseReview => ({
  id: `r-${memberId}`,
  familyId: 'f',
  invoiceId: 'i',
  purchaseId: 'p',
  memberId,
  status,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
});

describe('invoice review', () => {
  it('is pending until everyone involved answers', () => {
    expect(lineReviewState(['lucas', 'avo'], [review('lucas', 'confirmed')])).toMatchObject({
      status: 'pending',
      pendingMemberIds: ['avo'],
    });
    expect(lineReviewState(['lucas'], [review('lucas', 'confirmed')]).status).toBe('confirmed');
  });

  it('flags open disputes and clears them once resolved', () => {
    expect(lineReviewState(['lucas'], [review('lucas', 'disputed')]).status).toBe('disputed');
    expect(lineReviewState(['lucas'], [review('lucas', 'resolved')]).status).toBe('confirmed');
  });

  it('treats purchases with nobody to ask as confirmed', () => {
    expect(lineReviewState([], []).status).toBe('confirmed');
  });

  it('summarizes the review progress', () => {
    expect(reviewProgress([{ status: 'confirmed' }, { status: 'pending' }, { status: 'disputed' }, { status: 'confirmed' }])).toEqual({
      total: 4,
      confirmed: 2,
      pending: 1,
      disputed: 1,
      progress: 0.5,
    });
  });
});

describe('payments waiting for the holder', () => {
  const balances = computeMemberBalances({
    memberIds: ['avo', 'lucas'],
    holderMemberId: 'avo',
    debts: [{ memberId: 'lucas', amountCents: 80000 }],
    payments: [
      { memberId: 'lucas', amountCents: 30000, status: 'confirmed' },
      { memberId: 'lucas', amountCents: 20000, status: 'pending' },
      { memberId: 'lucas', amountCents: 99999, status: 'rejected' },
    ],
  });
  const lucas = balances.find((b) => b.memberId === 'lucas')!;

  it('only counts confirmed payments as paid', () => {
    expect(lucas).toMatchObject({ paidCents: 30000, pendingCents: 50000, awaitingCents: 20000, status: 'partial' });
    expect(computeInvoiceTotals(balances)).toMatchObject({ receivedCents: 30000, pendingCents: 50000, awaitingCents: 20000 });
  });

  it('does not let anyone mark more than what is left after transfers in flight', () => {
    const base = { owedCents: 80000, alreadyPaidCents: 30000, awaitingCents: 20000 };
    expect(validatePayment({ ...base, amountCents: 30000 })).toBeNull();
    expect(validatePayment({ ...base, amountCents: 30001 })).toBe('exceeds_pending');
    expect(validatePayment({ ...base, awaitingCents: 50000, amountCents: 1 })).toBe('nothing_owed');
  });
});

describe('statement names', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeStatementName('  Januário  da silveira ')).toBe('JANUARIO DA SILVEIRA');
    expect(normalizeStatementName('IFD*IFOOD.COM')).toBe('IFD*IFOOD.COM');
  });
});

describe('attachments', () => {
  it('measures the file inside a data URL', () => {
    expect(dataUrlSize('data:text/plain;base64,aGVsbG8=')).toBe(5);
  });
});

describe('statistics', () => {
  const entry = (overrides: Partial<SpendingEntry>): SpendingEntry => ({
    purchaseId: 'p1',
    ref: { year: 2026, month: 8 },
    categoryId: 'mercado',
    cardId: 'c1',
    memberId: 'lucas',
    amountCents: 1000,
    installmentCount: 1,
    isFuture: false,
    ...overrides,
  });

  const stats = computeStatistics(
    [
      entry({}),
      entry({ purchaseId: 'p2', memberId: 'maria', amountCents: 3000, categoryId: 'farmacia' }),
      entry({ purchaseId: 'p3', ref: { year: 2026, month: 7 }, amountCents: 2000 }),
      entry({ purchaseId: 'p4', installmentCount: 3, amountCents: 500 }),
      entry({ purchaseId: 'p4', installmentCount: 3, amountCents: 500, ref: { year: 2026, month: 9 }, isFuture: true }),
    ],
    { from: { year: 2026, month: 7 }, to: { year: 2026, month: 8 } },
  );

  it('totals the period month by month', () => {
    expect(stats.totalCents).toBe(6500);
    expect(stats.months.map((m) => m.totalCents)).toEqual([2000, 4500]);
    expect(stats.purchaseCount).toBe(4);
    expect(stats.averageMonthCents).toBe(3250);
    expect(stats.lastMonthChange).toBe(1.25);
  });

  it('ranks categories and people', () => {
    expect(stats.byCategory[0]).toMatchObject({ id: 'mercado', totalCents: 3500 });
    expect(stats.byMember.map((m) => m.id)).toEqual(['lucas', 'maria']);
  });

  it('separates installments inside the period from those still to come', () => {
    expect(stats.installmentSpendCents).toBe(500);
    expect(stats.futureInstallmentsCents).toBe(500);
  });
});
