import {
  allocateSharesToInstallments,
  installmentAmounts,
  installmentProgress,
  planInstallments,
} from '../installments';
import { refKey } from '../invoice-period';
import { sumCents } from '../money';

describe('installments', () => {
  it('splits R$ 2.400 into 12x R$ 200', () => {
    expect(installmentAmounts(240000, 12)).toEqual(Array(12).fill(20000));
  });

  it('puts leftover cents on the first installment', () => {
    const amounts = installmentAmounts(10000, 3);
    expect(amounts).toEqual([3334, 3333, 3333]);
    expect(sumCents(amounts)).toBe(10000);
  });

  it('rejects invalid counts', () => {
    expect(() => installmentAmounts(10000, 0)).toThrow();
    expect(() => installmentAmounts(10000, 1.5)).toThrow();
    expect(() => installmentAmounts(5, 12)).toThrow();
  });

  it('places each installment in a different consecutive invoice', () => {
    const plan = planInstallments({ totalCents: 240000, count: 12, purchaseDate: '2026-04-10', closingDay: 25 });
    const keys = plan.map((p) => refKey(p.invoiceRef));
    expect(keys[0]).toBe('2026-04');
    expect(keys[4]).toBe('2026-08');
    expect(keys[11]).toBe('2027-03');
    expect(new Set(keys).size).toBe(12);
    expect(plan[4]).toMatchObject({ number: 5, count: 12, amountCents: 20000 });
  });

  it('starts at the next invoice when bought on or after the closing day', () => {
    const plan = planInstallments({ totalCents: 30000, count: 3, purchaseDate: '2026-08-25', closingDay: 25 });
    expect(refKey(plan[0].invoiceRef)).toBe('2026-09');
  });

  it('shows progress as in "Parcela 5 de 12, restam 7, R$ 1.400"', () => {
    const progress = installmentProgress(installmentAmounts(240000, 12), 5);
    expect(progress).toMatchObject({ current: 5, count: 12, remainingCount: 7, remainingCents: 140000 });
    expect(installmentProgress(installmentAmounts(240000, 12), 12).isLast).toBe(true);
  });

  it('allocates member shares to installments keeping both totals exact', () => {
    const shares = [
      { memberId: 'lucas', amountCents: 4000 },
      { memberId: 'avo', amountCents: 8000 },
    ];
    const amounts = installmentAmounts(12000, 3);
    const matrix = allocateSharesToInstallments(amounts, shares);
    expect(matrix).toEqual([
      [1333, 2667],
      [1334, 2666],
      [1333, 2667],
    ]);
    matrix.forEach((row, i) => expect(sumCents(row)).toBe(amounts[i]));
    expect(sumCents(matrix.map((row) => row[0]))).toBe(4000);
    expect(sumCents(matrix.map((row) => row[1]))).toBe(8000);
  });

  it('keeps allocations exact and non-negative for awkward values', () => {
    const cases = [
      { total: 10001, count: 7, shares: [1, 3333, 6667] },
      { total: 99999, count: 12, shares: [33333, 33333, 33333] },
      { total: 1200, count: 12, shares: [1, 1199] },
      { total: 12, count: 12, shares: [5, 7] },
    ];
    for (const { total, count, shares } of cases) {
      const input = shares.map((amountCents, i) => ({ memberId: `m${i}`, amountCents }));
      const amounts = installmentAmounts(total, count);
      const matrix = allocateSharesToInstallments(amounts, input);
      matrix.forEach((row, i) => {
        expect(sumCents(row)).toBe(amounts[i]);
        expect(row.every((v) => v >= 0)).toBe(true);
      });
      shares.forEach((share, m) => expect(sumCents(matrix.map((row) => row[m]))).toBe(share));
    }
  });
});
