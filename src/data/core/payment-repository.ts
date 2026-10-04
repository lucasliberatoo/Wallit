import { type Card, formatBRL, INVOICE_STATUS_LABEL, type Invoice, type InvoiceStatus, type Payment, validatePayment } from '../../domain';
import { AppError } from '../errors';
import type { PaymentRepository } from '../repositories';
import { invoiceLabel, invoiceLink } from './labels';
import { notify } from './notify';
import { newId, nowISO, type Store } from './store';
import { cardManagerIds, hasHolderPower, invoiceDetails } from './views';

/** Moves the invoice forward when payments start arriving or everything was received. */
function advanceStatus(store: Store, invoice: Invoice): void {
  let next: InvoiceStatus | null = null;
  if (invoice.status === 'closed') next = 'collecting';
  if (invoice.status === 'collecting' && invoiceDetails(store, invoice).totals.pendingCents === 0) next = 'paid';
  if (!next) return;
  const before = invoice.status;
  invoice.status = next;
  store.audit({
    familyId: invoice.familyId,
    entity: 'invoice',
    entityId: invoice.id,
    action: 'status_changed',
    summary: `Fatura: ${INVOICE_STATUS_LABEL[next]}`,
    changes: [{ field: 'Status', from: INVOICE_STATUS_LABEL[before], to: INVOICE_STATUS_LABEL[next] }],
  });
  if (next === 'collecting') advanceStatus(store, invoice);
}

export function createPaymentRepository(store: Store): PaymentRepository {
  const requireReviewable = (paymentId: string) => {
    const payment = store.require('payments', paymentId, 'Pagamento') as Payment;
    const invoice = store.require('invoices', payment.invoiceId, 'Fatura') as Invoice;
    const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
    if (!hasHolderPower(card, store.requireMembership(invoice.familyId))) {
      throw new AppError('forbidden', 'Só a titular do cartão confirma pagamentos.');
    }
    if (payment.status !== 'pending') throw new AppError('validation', 'Este pagamento já foi respondido.');
    return { payment, invoice };
  };

  return {
    register: (input) =>
      store.run(
        () => {
          const invoice = store.require('invoices', input.invoiceId, 'Fatura') as Invoice;
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          const me = store.requireMembership(invoice.familyId);
          const holderPower = hasHolderPower(card, me);
          // The holder registers anyone's payment; members only their own.
          if (!holderPower && input.memberId !== me.id) {
            throw new AppError('forbidden', 'Você só pode registrar seus próprios pagamentos.');
          }
          if (input.memberId === card.holderMemberId) {
            throw new AppError('validation', 'A titular paga direto ao banco.');
          }
          const details = invoiceDetails(store, invoice);
          const balance = details.balances.find((b) => b.memberId === input.memberId);
          const error = validatePayment({
            owedCents: balance?.owedCents ?? 0,
            alreadyPaidCents: balance?.paidCents ?? 0,
            awaitingCents: balance?.awaitingCents ?? 0,
            amountCents: input.amountCents,
          });
          if (error === 'exceeds_pending') {
            const open = (balance?.pendingCents ?? 0) - (balance?.awaitingCents ?? 0);
            throw new AppError('validation', `O valor passa do que falta pagar (${formatBRL(Math.max(open, 0))}).`);
          }
          if (error === 'nothing_owed') {
            throw new AppError(
              'validation',
              balance && balance.awaitingCents > 0 ? 'Já existe pagamento aguardando a titular confirmar.' : 'Não há valor pendente para esta pessoa.',
            );
          }
          if (error) throw new AppError('validation', 'Informe um valor válido.');

          const now = nowISO();
          const payment: Payment = {
            id: newId('pay'),
            invoiceId: invoice.id,
            memberId: input.memberId,
            amountCents: input.amountCents,
            paidAt: now,
            registeredBy: store.currentUserId(),
            note: input.note?.trim() || undefined,
            // A transfer only counts once the holder confirms it was received.
            status: holderPower ? 'confirmed' : 'pending',
            ...(holderPower ? { reviewedBy: store.currentUserId(), reviewedAt: now } : {}),
          };
          store.db.payments.push(payment);
          const member = store.member(input.memberId);
          store.audit({
            familyId: invoice.familyId,
            entity: 'payment',
            entityId: payment.id,
            action: 'payment_registered',
            summary:
              payment.status === 'confirmed'
                ? `${member.displayName} pagou ${formatBRL(payment.amountCents)}`
                : `${member.displayName} marcou um pagamento de ${formatBRL(payment.amountCents)}`,
            changes: [],
          });

          if (payment.status === 'pending') {
            notify(store, {
              familyId: invoice.familyId,
              memberIds: cardManagerIds(store, card),
              type: 'payment_registered',
              title: 'Pagamento para confirmar',
              body: `${member.displayName} marcou um pagamento de ${formatBRL(payment.amountCents)} na fatura de ${invoiceLabel(store, invoice)}.`,
              link: invoiceLink(invoice),
            });
          } else {
            notify(store, {
              familyId: invoice.familyId,
              memberIds: [member.id],
              type: 'payment_confirmed',
              title: 'Pagamento confirmado',
              body: `Seu pagamento de ${formatBRL(payment.amountCents)} na fatura de ${invoiceLabel(store, invoice)} foi registrado.`,
              link: invoiceLink(invoice),
            });
          }
          advanceStatus(store, invoice);
          return payment;
        },
        { write: true },
      ),

    confirm: (paymentId) =>
      store.run(
        () => {
          const { payment, invoice } = requireReviewable(paymentId);
          const balance = invoiceDetails(store, invoice).balances.find((b) => b.memberId === payment.memberId);
          if (!balance || payment.amountCents > balance.pendingCents) {
            throw new AppError('validation', 'Esse valor passa do que falta pagar. Recuse e peça para marcar de novo.');
          }
          payment.status = 'confirmed';
          payment.reviewedBy = store.currentUserId();
          payment.reviewedAt = nowISO();
          const member = store.member(payment.memberId);
          store.audit({
            familyId: invoice.familyId,
            entity: 'payment',
            entityId: payment.id,
            action: 'payment_confirmed',
            summary: `Pagamento de ${member.displayName} confirmado: ${formatBRL(payment.amountCents)}`,
            changes: [],
          });
          notify(store, {
            familyId: invoice.familyId,
            memberIds: [payment.memberId],
            type: 'payment_confirmed',
            title: 'Pagamento confirmado',
            body: `Seu pagamento de ${formatBRL(payment.amountCents)} na fatura de ${invoiceLabel(store, invoice)} foi confirmado.`,
            link: invoiceLink(invoice),
          });
          advanceStatus(store, invoice);
          return payment;
        },
        { write: true },
      ),

    reject: (paymentId, note) =>
      store.run(
        () => {
          const { payment, invoice } = requireReviewable(paymentId);
          payment.status = 'rejected';
          payment.reviewedBy = store.currentUserId();
          payment.reviewedAt = nowISO();
          const reason = note?.trim();
          if (reason) payment.note = payment.note ? `${payment.note} · Titular: ${reason}` : `Titular: ${reason}`;
          const member = store.member(payment.memberId);
          store.audit({
            familyId: invoice.familyId,
            entity: 'payment',
            entityId: payment.id,
            action: 'payment_rejected',
            summary: `Pagamento de ${member.displayName} não confirmado: ${formatBRL(payment.amountCents)}`,
            changes: reason ? [{ field: 'Motivo', from: null, to: reason }] : [],
          });
          notify(store, {
            familyId: invoice.familyId,
            memberIds: [payment.memberId],
            type: 'payment_rejected',
            title: 'Pagamento não confirmado',
            body: `A titular não confirmou seu pagamento de ${formatBRL(payment.amountCents)}${reason ? `: "${reason}"` : '.'}`,
            link: invoiceLink(invoice),
          });
          return payment;
        },
        { write: true },
      ),
  };
}
