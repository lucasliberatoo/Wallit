import { useMemo, useReducer } from 'react';

import type { CreatePurchaseInput } from '@/data';
import { type Cents, MAX_INSTALLMENTS, type ShareInput, splitEqually, validateSplit } from '@/domain';
import { todayISO } from '@/utils/dates';

export interface PurchaseFormState {
  totalCents: Cents;
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

function reducer(state: PurchaseFormState, action: Action): PurchaseFormState {
  switch (action.type) {
    case 'setTotal': {
      const shares = state.autoSplit
        ? equalShares(
            action.value,
            state.shares.map((s) => s.memberId),
          )
        : state.shares;
      return { ...state, totalCents: action.value, shares };
    }
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'setCard':
      return { ...state, cardId: action.value };
    case 'setCategory':
      return { ...state, categoryId: action.value };
    case 'setInstallments':
      return { ...state, installmentCount: Math.min(Math.max(action.value, 1), MAX_INSTALLMENTS) };
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
