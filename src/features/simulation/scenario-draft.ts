import type { ScenarioOperation } from '@/data';
import { type Cents, type InvoiceRef, refFromKey, splitEqually } from '@/domain';
import type { AmountMode } from '@/features/purchases/use-purchase-form';

/** What the person is typing for each simulation; turned into operations for the server. */
export type ScenarioDraft =
  | {
      id: string;
      kind: 'purchase';
      cardId: string;
      mode: AmountMode;
      totalCents: Cents;
      installmentCents: Cents;
      count: number;
      /** refKey of the first installment's invoice. */
      startKey: string;
      payerIds: string[];
    }
  | {
      id: string;
      kind: 'loan';
      receivedCents: Cents;
      receivedKey: string;
      installmentCents: Cents;
      count: number;
      startKey: string;
    }
  | {
      id: string;
      kind: 'payoff';
      cardId: string;
      targetKey: string;
      /** null: every future installment of the card. */
      purchaseId: string | null;
      /** Only with a purchase; null: all of its future installments. */
      count: number | null;
    };

export type DraftKind = ScenarioDraft['kind'];

export const DRAFT_TITLES: Record<DraftKind, string> = {
  purchase: 'Compra no cartão',
  loan: 'Empréstimo ou dívida fora do cartão',
  payoff: 'Quitar ou antecipar parcelas',
};

export function purchaseTotal(draft: Extract<ScenarioDraft, { kind: 'purchase' }>): Cents {
  return draft.mode === 'installment' ? draft.installmentCents * draft.count : draft.totalCents;
}

/** Drafts still being filled in are left out of the simulation. */
export function toOperation(draft: ScenarioDraft): ScenarioOperation | null {
  switch (draft.kind) {
    case 'purchase': {
      const total = purchaseTotal(draft);
      if (total < draft.count || draft.payerIds.length === 0) return null;
      return {
        kind: 'purchase',
        cardId: draft.cardId,
        totalCents: total,
        installmentCount: draft.count,
        startRef: refFromKey(draft.startKey),
        shares: splitEqually(total, draft.payerIds),
      };
    }
    case 'loan':
      if (draft.installmentCents <= 0) return null;
      return {
        kind: 'loan',
        receivedCents: draft.receivedCents,
        receivedRef: refFromKey(draft.receivedKey),
        installmentCents: draft.installmentCents,
        installmentCount: draft.count,
        startRef: refFromKey(draft.startKey),
      };
    case 'payoff':
      return {
        kind: 'payoff',
        cardId: draft.cardId,
        targetRef: refFromKey(draft.targetKey),
        ...(draft.purchaseId ? { purchaseId: draft.purchaseId, ...(draft.count ? { count: draft.count } : {}) } : {}),
      };
  }
}

/** "nov/26" */
export function shortRef(ref: InvoiceRef): string {
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[ref.month - 1]}/${String(ref.year).slice(2)}`;
}
