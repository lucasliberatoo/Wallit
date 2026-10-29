import { useMemo, useReducer } from 'react';

import type { CreatePurchaseInput } from '@/data';
import { type Cents, MAX_INSTALLMENTS, type ShareInput, splitEqually, validateSplit } from '@/domain';
import { todayISO } from '@/utils/dates';

/** The amount typed is the whole purchase, or one installment that repeats. */
export type AmountMode = 'total' | 'installment';

export interface PurchaseFormState {
  totalCents: Cents;
  amountMode: AmountMode;
  /** Typed in 'installment' mode; the total is this times the installment count. */
  installmentCents: Cents;
  merchant: string;
  statementName: string;
  cardId: string | null;
  date: string;
  categoryId: string | null;
  installmentCount: number;
  buyerId: string | null;
  shares: ShareInput[];
  /** While true, amounts follow "split equally" automatically. Editing a value turns it off. */
  autoSplit: boolean;
  note: string;
}

type Action =
  | { type: 'setTotal'; value: Cents }
  | { type: 'setInstallmentValue'; value: Cents }
  | { type: 'setAmountMode'; value: AmountMode }
  | { type: 'setField'; field: 'merchant' | 'statementName' | 'note' | 'date'; value: string }
  | { type: 'setCard'; value: string }
  | { type: 'setCategory'; value: string }
  | { type: 'setInstallments'; value: number }
  | { type: 'setBuyer'; value: string }
  | { type: 'togglePayer'; memberId: string }
  | { type: 'setShareAmount'; memberId: string; value: Cents }
  | { type: 'splitEqually' }
  | { type: 'fillRemaining'; memberId: string };

function equalShares(total: Cents, memberIds: string[]): ShareInput[] {
  return total > 0 ? splitEqually(total, memberIds) : memberIds.map((memberId) => ({ memberId, amountCents: 0 }));
}

function withTotal(state: PurchaseFormState, total: Cents): PurchaseFormState {
  const shares = state.autoSplit
    ? equalShares(
        total,
        state.shares.map((s) => s.memberId),
      )
    : state.shares;
  return { ...state, totalCents: total, shares };
}

function reducer(state: PurchaseFormState, action: Action): PurchaseFormState {
  switch (action.type) {
    case 'setTotal':
      return withTotal(state, action.value);
    case 'setInstallmentValue':
      return withTotal({ ...state, installmentCents: action.value }, action.value * state.installmentCount);
    case 'setAmountMode': {
      if (action.value === state.amountMode) return state;
      if (action.value === 'total') return { ...state, amountMode: 'total' };
      const installmentCents = Math.floor(state.totalCents / state.installmentCount);
      return withTotal({ ...state, amountMode: 'installment', installmentCents }, installmentCents * state.installmentCount);
    }
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'setCard':
      return { ...state, cardId: action.value };
    case 'setCategory':
      return { ...state, categoryId: action.value };
    case 'setInstallments': {
      const installmentCount = Math.min(Math.max(action.value, 1), MAX_INSTALLMENTS);
      // "R$ 50 por mês": more installments means a bigger total, the installment stays.
      if (state.amountMode === 'installment') {
        return withTotal({ ...state, installmentCount }, state.installmentCents * installmentCount);
      }
      return { ...state, installmentCount };
    }
    case 'setBuyer': {
      // If the split is still "the buyer pays everything", follow the new buyer.
      const followsBuyer = state.autoSplit && state.shares.length <= 1;
      return {
        ...state,
        buyerId: action.value,
        shares: followsBuyer ? equalShares(state.totalCents, [action.value]) : state.shares,
      };
    }
    case 'togglePayer': {
      const exists = state.shares.some((s) => s.memberId === action.memberId);
      const memberIds = exists
        ? state.shares.filter((s) => s.memberId !== action.memberId).map((s) => s.memberId)
        : [...state.shares.map((s) => s.memberId), action.memberId];
      if (state.autoSplit) return { ...state, shares: equalShares(state.totalCents, memberIds) };
      const shares = exists
        ? state.shares.filter((s) => s.memberId !== action.memberId)
        : [...state.shares, { memberId: action.memberId, amountCents: 0 }];
      return { ...state, shares };
    }
    case 'setShareAmount':
      return {
        ...state,
        autoSplit: false,
        shares: state.shares.map((s) => (s.memberId === action.memberId ? { ...s, amountCents: action.value } : s)),
      };
    case 'splitEqually':
      return {
        ...state,
        autoSplit: true,
        shares: equalShares(
          state.totalCents,
          state.shares.map((s) => s.memberId),
        ),
      };
    case 'fillRemaining': {
      const others = state.shares.filter((s) => s.memberId !== action.memberId).reduce((sum, s) => sum + s.amountCents, 0);
      const value = Math.max(state.totalCents - others, 0);
      return {
        ...state,
        autoSplit: false,
        shares: state.shares.map((s) => (s.memberId === action.memberId ? { ...s, amountCents: value } : s)),
      };
    }
  }
}

export function initialPurchaseForm(partial: Partial<PurchaseFormState> = {}): PurchaseFormState {
  return {
    totalCents: 0,
    amountMode: 'total',
    installmentCents: 0,
    merchant: '',
    statementName: '',
    cardId: null,
    date: todayISO(),
    categoryId: null,
    installmentCount: 1,
    buyerId: null,
    shares: [],
    autoSplit: true,
    note: '',
    ...partial,
  };
}

/** Form state + business validation for creating or editing a purchase. */
export function usePurchaseForm(initial: PurchaseFormState) {
  const [state, dispatch] = useReducer(reducer, initial);

  const split = useMemo(() => validateSplit(state.totalCents, state.shares), [state.totalCents, state.shares]);
  const installmentValue = state.totalCents > 0 ? Math.floor(state.totalCents / state.installmentCount) : 0;

  const missing: string[] = [];
  if (state.totalCents <= 0) missing.push('valor');
  if (!state.merchant.trim()) missing.push('estabelecimento');
  if (!state.cardId) missing.push('cartão');
  if (!state.categoryId) missing.push('categoria');
  if (!state.buyerId) missing.push('quem comprou');
  if (state.totalCents > 0 && state.totalCents < state.installmentCount) missing.push('parcelamento válido');

  const canSave = missing.length === 0 && split.status === 'complete';

  const toInput = (familyId: string): CreatePurchaseInput => ({
    familyId,
    cardId: state.cardId!,
    merchant: state.merchant,
    statementName: state.statementName || undefined,
    totalCents: state.totalCents,
    date: state.date,
    categoryId: state.categoryId!,
    buyerMemberId: state.buyerId!,
    installmentCount: state.installmentCount,
    shares: state.shares,
    note: state.note || undefined,
  });

  return { state, dispatch, split, canSave, missing, installmentValue, toInput };
}
