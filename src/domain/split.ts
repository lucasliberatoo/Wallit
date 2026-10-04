import { type Cents, formatBRL, isValidCents, splitEvenly, sumCents } from './money';
import type { ID } from './types';

export interface ShareInput {
  memberId: ID;
  amountCents: Cents;
}

export type SplitStatus = 'complete' | 'missing' | 'exceeding' | 'invalid';

export type SplitIssue =
  | 'invalid_total'
  | 'no_participants'
  | 'invalid_amount'
  | 'duplicate_member'
  | 'empty_share';

export interface SplitValidation {
  status: SplitStatus;
  total: Cents;
  allocated: Cents;
  /** total - allocated: positive means missing, negative means exceeding. */
  difference: Cents;
  issues: SplitIssue[];
}

/**
 * Rule 1: the shares must add up to exactly the purchase total.
 * Rule 2: no negative values. Every participant must pay something.
 */
export function validateSplit(total: Cents, shares: readonly ShareInput[]): SplitValidation {
  const issues: SplitIssue[] = [];

  if (!isValidCents(total) || total === 0) issues.push('invalid_total');
  if (shares.length === 0) issues.push('no_participants');
  if (shares.some((share) => !isValidCents(share.amountCents))) issues.push('invalid_amount');
  if (shares.some((share) => share.amountCents === 0)) issues.push('empty_share');
  if (new Set(shares.map((share) => share.memberId)).size !== shares.length) {
    issues.push('duplicate_member');
  }

  const allocated = sumCents(shares.map((share) => share.amountCents));
  const difference = total - allocated;

  let status: SplitStatus;
  if (issues.length > 0) status = 'invalid';
  else if (difference === 0) status = 'complete';
  else if (difference > 0) status = 'missing';
  else status = 'exceeding';

  return { status, total, allocated, difference, issues };
}

export function isSplitComplete(total: Cents, shares: readonly ShareInput[]): boolean {
  return validateSplit(total, shares).status === 'complete';
}

/** "Dividir igualmente": exact split, leftover cents go to the first members. */
export function splitEqually(total: Cents, memberIds: readonly ID[]): ShareInput[] {
  if (memberIds.length === 0) return [];
  const amounts = splitEvenly(total, memberIds.length);
  return memberIds.map((memberId, index) => ({ memberId, amountCents: amounts[index] }));
}

export function describeSplit(validation: SplitValidation): string {
  switch (validation.status) {
    case 'complete':
      return 'Divisão completa';
    case 'missing':
      return `Faltam ${formatBRL(validation.difference)} para completar a compra.`;
    case 'exceeding':
      return `A divisão passou ${formatBRL(-validation.difference)} do valor da compra.`;
    case 'invalid':
      if (validation.issues.includes('invalid_total')) return 'Informe o valor da compra.';
      if (validation.issues.includes('no_participants')) return 'Escolha quem paga.';
      if (validation.issues.includes('empty_share')) return 'Cada pessoa precisa pagar algum valor.';
      return 'Divisão inválida.';
  }
}
