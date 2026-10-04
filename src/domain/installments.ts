import { allocateProportionally, assertValidCents, type Cents } from './money';
import { addMonths, invoiceRefForDate, type InvoiceRef } from './invoice-period';
import type { ShareInput } from './split';
import type { ISODate } from './types';

export const MAX_INSTALLMENTS = 48;

export interface PlannedInstallment {
  number: number;
  count: number;
  amountCents: Cents;
  invoiceRef: InvoiceRef;
}

/**
 * Splits the total into installment amounts, bank style: the leftover cents
 * go to the first installment. 100,00 in 3x -> 33,34 + 33,33 + 33,33.
 */
export function installmentAmounts(total: Cents, count: number): Cents[] {
  assertValidCents(total);
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new RangeError(`Número de parcelas inválido: ${count}`);
  }
  if (total < count) {
    throw new RangeError('Cada parcela precisa ter pelo menos R$ 0,01');
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === 0 ? remainder : 0));
}

/**
 * Rule 5/6: each installment is linked to the original purchase and lands in a
 * different, consecutive invoice, starting at the invoice of the purchase date.
 */
export function planInstallments(params: {
  totalCents: Cents;
  count: number;
  purchaseDate: ISODate;
  closingDay: number;
}): PlannedInstallment[] {
  const amounts = installmentAmounts(params.totalCents, params.count);
  const firstRef = invoiceRefForDate(params.purchaseDate, params.closingDay);
  return amounts.map((amountCents, index) => ({
    number: index + 1,
    count: params.count,
    amountCents,
    invoiceRef: addMonths(firstRef, index),
  }));
}

/**
 * Distributes each member's share of the purchase across the installments so
 * that, at the same time:
 * - each installment's shares add up exactly to the installment amount;
 * - each member's installment shares add up exactly to their purchase share.
 *
 * Each installment is allocated proportionally to what every member still
 * owes, which keeps all values non-negative.
 *
 * Returns one array per installment, aligned with `shares`.
 */
export function allocateSharesToInstallments(amounts: readonly Cents[], shares: readonly ShareInput[]): Cents[][] {
  const remaining = shares.map((share) => share.amountCents);
  let remainingTotal = amounts.reduce((sum, amount) => sum + amount, 0);

  return amounts.map((amount) => {
    const allocation =
      amount === 0 ? remaining.map(() => 0) : amount === remainingTotal ? [...remaining] : allocateProportionally(amount, remaining);
    allocation.forEach((value, index) => {
      remaining[index] -= value;
    });
    remainingTotal -= amount;
    return allocation;
  });
}

export interface InstallmentProgress {
  current: number;
  count: number;
  remainingCount: number;
  remainingCents: Cents;
  paidCents: Cents;
  isLast: boolean;
}

/** "Parcela 5 de 12 · Restam 7 parcelas · Valor restante R$ 1.400,00". */
export function installmentProgress(amounts: readonly Cents[], currentNumber: number): InstallmentProgress {
  const count = amounts.length;
  if (currentNumber < 1 || currentNumber > count) {
    throw new RangeError(`Parcela ${currentNumber} fora do intervalo 1-${count}`);
  }
  const remainingCents = amounts.slice(currentNumber).reduce((sum, amount) => sum + amount, 0);
  const paidCents = amounts.slice(0, currentNumber).reduce((sum, amount) => sum + amount, 0);
  return {
    current: currentNumber,
    count,
    remainingCount: count - currentNumber,
    remainingCents,
    paidCents,
    isLast: currentNumber === count,
  };
}
