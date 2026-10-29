import type { ScenarioOperation } from '@/data';
import { type Cents, formatBRL, type InvoiceRef, refFromKey, splitEqually } from '@/domain';
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
      /** The whole card balance, one purchase, or a fixed amount. */
      scope: 'card' | 'purchase' | 'amount';
      purchaseId: string | null;
      /** Name and installments of the chosen purchase, for the summary. */
      purchaseLabel: string | null;
      purchaseInstallments: number | null;
      /** Only with a purchase; null: all of its future installments. */
      count: number | null;
      amountCents: Cents;
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
    case 'payoff': {
      const base = { kind: 'payoff' as const, cardId: draft.cardId, targetRef: refFromKey(draft.targetKey) };
      if (draft.scope === 'card') return base;
      if (draft.scope === 'amount') return draft.amountCents > 0 ? { ...base, amountCents: draft.amountCents } : null;
      if (!draft.purchaseId) return null;
      return { ...base, purchaseId: draft.purchaseId, ...(draft.count ? { count: draft.count } : {}) };
    }
  }
}

/** "nov/26" */
export function shortRef(ref: InvoiceRef): string {
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[ref.month - 1]}/${String(ref.year).slice(2)}`;
}

/** One line describing the simulation, shown while it is collapsed. */
export function draftSummary(draft: ScenarioDraft, cardName: (cardId: string) => string): string {
  switch (draft.kind) {
    case 'purchase': {
      const total = purchaseTotal(draft);
      if (total <= 0) return 'Falta informar o valor';
      const value = draft.count === 1 ? formatBRL(total) : `${draft.count}x de ${formatBRL(Math.floor(total / draft.count))}`;
      return `${value} no ${cardName(draft.cardId)}, a partir de ${shortRef(refFromKey(draft.startKey))}`;
    }
    case 'loan':
      if (draft.installmentCents <= 0) return 'Falta informar a parcela';
      return `${draft.receivedCents > 0 ? `Recebe ${formatBRL(draft.receivedCents)} em ${shortRef(refFromKey(draft.receivedKey))}, paga ` : 'Paga '}${draft.count}x de ${formatBRL(draft.installmentCents)} a partir de ${shortRef(refFromKey(draft.startKey))}`;
    case 'payoff': {
      const when = `na fatura de ${shortRef(refFromKey(draft.targetKey))}`;
      if (draft.scope === 'card') return `Todo o saldo do ${cardName(draft.cardId)} ${when}`;
      if (draft.scope === 'amount') {
        return draft.amountCents > 0 ? `${formatBRL(draft.amountCents)} do ${cardName(draft.cardId)} ${when}` : 'Falta informar o valor';
      }
      if (!draft.purchaseLabel) return 'Falta escolher a compra';
      const parts = draft.count ? `${draft.count} últimas parcelas` : 'todas as parcelas';
      return `${draft.purchaseLabel} (${parts}) ${when}`;
    }
  }
}
