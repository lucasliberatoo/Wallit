import { type Card, DISPUTE_REASON_LABEL, formatBRL, type Invoice, type Purchase, type PurchaseReview } from '../../domain';
import { AppError } from '../errors';
import type { DisputeInput } from '../models';
import type { ReviewRepository } from '../repositories';
import { invoiceLabel, invoiceLink, purchaseLink } from './labels';
import { notify } from './notify';
import { newId, nowISO, type Store } from './store';
import { cardManagerIds, hasHolderPower, reviewerIds } from './views';

const MAX_NOTE_LENGTH = 500;

export function createReviewRepository(store: Store): ReviewRepository {
  /** Only people involved in a purchase answer for it, and only during the review. */
  const requireReviewer = (invoiceId: string, purchaseId: string) => {
    const invoice = store.require('invoices', invoiceId, 'Fatura') as Invoice;
    const me = store.requireMembership(invoice.familyId);
    if (invoice.status !== 'reviewing') throw new AppError('validation', 'Esta fatura não está em conferência.');
    const purchase = store.require('purchases', purchaseId, 'Compra') as Purchase;
    const inInvoice = store.db.installments.some((i) => i.purchaseId === purchaseId && i.invoiceId === invoiceId);
    if (purchase.familyId !== invoice.familyId || purchase.status !== 'active' || !inInvoice) {
      throw new AppError('not_found', 'Compra não encontrada nesta fatura.');
    }
    if (!reviewerIds(store, purchase.id, purchase.buyerMemberId).includes(me.id)) {
      throw new AppError('forbidden', 'Você só confere compras em que participa.');
    }
    return { invoice, purchase, me };
  };

  /** One answer per person and purchase; answering again replaces it. */
  const upsert = (invoice: Invoice, purchase: Purchase, memberId: string, changes: Partial<PurchaseReview>): PurchaseReview => {
    const now = nowISO();
    let review = store.db.reviews.find((r) => r.invoiceId === invoice.id && r.purchaseId === purchase.id && r.memberId === memberId);
    if (!review) {
      review = {
        id: newId('rev'),
        familyId: invoice.familyId,
        invoiceId: invoice.id,
        purchaseId: purchase.id,
        memberId,
        status: 'confirmed',
        createdAt: now,
        updatedAt: now,
      };
      store.db.reviews.push(review);
    }
    delete review.reason;
    delete review.note;
    delete review.resolutionNote;
    delete review.resolvedBy;
    Object.assign(review, changes, { updatedAt: now });
    return review;
  };

  return {
    confirm: (invoiceId, purchaseId) =>
      store.run(
        () => {
          const { invoice, purchase, me } = requireReviewer(invoiceId, purchaseId);
          const review = upsert(invoice, purchase, me.id, { status: 'confirmed' });
          store.audit({
            familyId: invoice.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'review_confirmed',
            summary: `${me.displayName} confirmou a compra`,
            changes: [],
          });
          return review;
        },
        { write: true },
      ),

    dispute: (invoiceId, purchaseId, input: DisputeInput) =>
      store.run(
        () => {
          const { invoice, purchase, me } = requireReviewer(invoiceId, purchaseId);
          if (!(input.reason in DISPUTE_REASON_LABEL)) throw new AppError('validation', 'Escolha o motivo.');
          const note = input.note?.trim();
          if (note && note.length > MAX_NOTE_LENGTH) throw new AppError('validation', 'A observação está longa demais.');
          const review = upsert(invoice, purchase, me.id, { status: 'disputed', reason: input.reason, note: note || undefined });
          store.audit({
            familyId: invoice.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'review_disputed',
            summary: `${me.displayName} contestou: ${DISPUTE_REASON_LABEL[input.reason]}`,
            changes: note ? [{ field: 'Observação', from: null, to: note }] : [],
          });
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          notify(store, {
            familyId: invoice.familyId,
            memberIds: cardManagerIds(store, card),
            type: 'dispute_opened',
            title: 'Compra contestada',
            body: `${me.displayName} não reconhece ${purchase.merchant} (${formatBRL(purchase.totalCents)}) na fatura de ${invoiceLabel(store, invoice)}.`,
            link: purchaseLink(purchase.id),
          });
          return review;
        },
        { write: true },
      ),

    resolve: (reviewId, note) =>
      store.run(
        () => {
          const review = store.require('reviews', reviewId, 'Contestação') as PurchaseReview;
          const invoice = store.require('invoices', review.invoiceId, 'Fatura') as Invoice;
          const card = store.require('cards', invoice.cardId, 'Cartão') as Card;
          const me = store.requireMembership(invoice.familyId);
          if (!hasHolderPower(card, me)) throw new AppError('forbidden', 'Só a titular responde contestações.');
          if (review.status !== 'disputed') throw new AppError('validation', 'Esta contestação já foi respondida.');
          const answer = note.trim();
          if (!answer) throw new AppError('validation', 'Escreva o que foi feito.');
          if (answer.length > MAX_NOTE_LENGTH) throw new AppError('validation', 'A resposta está longa demais.');
          review.status = 'resolved';
          review.resolutionNote = answer;
          review.resolvedBy = store.currentUserId();
          review.updatedAt = nowISO();
          const purchase = store.require('purchases', review.purchaseId, 'Compra') as Purchase;
          store.audit({
            familyId: invoice.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'dispute_resolved',
            summary: `Contestação de ${store.member(review.memberId).displayName} respondida`,
            changes: [{ field: 'Resposta', from: null, to: answer }],
          });
          notify(store, {
            familyId: invoice.familyId,
            memberIds: [review.memberId],
            type: 'dispute_resolved',
            title: 'Contestação respondida',
            body: `${me.displayName} respondeu sobre ${purchase.merchant}: "${answer}"`,
            link: invoiceLink(invoice),
          });
          return review;
        },
        { write: true },
      ),
  };
}
