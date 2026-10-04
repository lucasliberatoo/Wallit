import { type Cents, isValidCents, sumCents } from './money';
import type { ID, PaymentStatus } from './types';

/** One member's responsibility for one installment in an invoice. */
export interface DebtLine {
  memberId: ID;
  amountCents: Cents;
}

export interface PaymentLine {
  memberId: ID;
  amountCents: Cents;
  /** Defaults to confirmed. Only confirmed payments count as received. */
  status?: PaymentStatus;
}

export type MemberPaymentStatus = 'paid' | 'partial' | 'pending' | 'none' | 'holder';

export interface MemberBalance {
  memberId: ID;
  owedCents: Cents;
  paidCents: Cents;
  pendingCents: Cents;
  /** Transfers the member marked as done that the holder hasn't confirmed yet. */
  awaitingCents: Cents;
  status: MemberPaymentStatus;
}

export function paymentStatus(owed: Cents, paid: Cents): Exclude<MemberPaymentStatus, 'holder'> {
  if (owed === 0) return 'none';
  if (paid >= owed) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

/**
 * How much each member owes in an invoice and how much they already paid.
 * The card holder pays the bank directly, so their own share is never
 * "pending": it is reported with status `holder`.
 */
export function computeMemberBalances(params: {
  memberIds: readonly ID[];
  holderMemberId: ID;
  debts: readonly DebtLine[];
  payments: readonly PaymentLine[];
}): MemberBalance[] {
  const owed = new Map<ID, Cents>();
  const paid = new Map<ID, Cents>();
  const awaiting = new Map<ID, Cents>();
  for (const debt of params.debts) owed.set(debt.memberId, (owed.get(debt.memberId) ?? 0) + debt.amountCents);
  for (const payment of params.payments) {
    const status = payment.status ?? 'confirmed';
    if (status === 'rejected') continue;
    const target = status === 'confirmed' ? paid : awaiting;
    target.set(payment.memberId, (target.get(payment.memberId) ?? 0) + payment.amountCents);
  }

  const ids = [...new Set([...params.memberIds, ...owed.keys()])];
  return ids.map((memberId) => {
    const owedCents = owed.get(memberId) ?? 0;
    const paidCents = paid.get(memberId) ?? 0;
    const isHolder = memberId === params.holderMemberId;
    return {
      memberId,
      owedCents,
      paidCents: isHolder ? owedCents : paidCents,
      pendingCents: isHolder ? 0 : Math.max(owedCents - paidCents, 0),
      awaitingCents: isHolder ? 0 : (awaiting.get(memberId) ?? 0),
      status: isHolder ? 'holder' : paymentStatus(owedCents, paidCents),
    };
  });
}

export interface InvoiceTotals {
  /** Invoice total charged by the bank. */
  totalCents: Cents;
  /** The holder's own share, which nobody transfers. */
  holderShareCents: Cents;
  /** What the holder must receive from the other members. */
  receivableCents: Cents;
  /** What the holder already received. */
  receivedCents: Cents;
  /** What is still missing. */
  pendingCents: Cents;
  /** Part of the pending amount already marked as sent, waiting for the holder. */
  awaitingCents: Cents;
  /** 0-1, share of the receivable already received. */
  progress: number;
}

/** Rule 13: the invoice must show total, received and pending. */
export function computeInvoiceTotals(balances: readonly MemberBalance[]): InvoiceTotals {
  const totalCents = sumCents(balances.map((balance) => balance.owedCents));
  const holderShareCents = sumCents(balances.filter((balance) => balance.status === 'holder').map((balance) => balance.owedCents));
  const others = balances.filter((balance) => balance.status !== 'holder');
  const receivableCents = sumCents(others.map((balance) => balance.owedCents));
  const receivedCents = sumCents(others.map((balance) => Math.min(balance.paidCents, balance.owedCents)));
  const pendingCents = receivableCents - receivedCents;
  return {
    totalCents,
    holderShareCents,
    receivableCents,
    receivedCents,
    pendingCents,
    awaitingCents: sumCents(others.map((balance) => Math.min(balance.awaitingCents, balance.pendingCents))),
    progress: receivableCents === 0 ? 1 : receivedCents / receivableCents,
  };
}

export type PaymentValidationError = 'invalid_amount' | 'exceeds_pending' | 'nothing_owed';

/**
 * Rule 11: partial payments are allowed.
 * Rule 12: the amount paid can never exceed what is owed.
 */
export function validatePayment(params: {
  owedCents: Cents;
  alreadyPaidCents: Cents;
  amountCents: Cents;
  /** Payments still waiting for confirmation also count, so nobody pays twice. */
  awaitingCents?: Cents;
}): PaymentValidationError | null {
  const pending = params.owedCents - params.alreadyPaidCents - (params.awaitingCents ?? 0);
  if (!isValidCents(params.amountCents) || params.amountCents === 0) return 'invalid_amount';
  if (pending <= 0) return 'nothing_owed';
  if (params.amountCents > pending) return 'exceeds_pending';
  return null;
}
