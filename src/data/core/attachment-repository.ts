import {
  ATTACHMENT_MAX_DATA_URL_LENGTH,
  ATTACHMENT_MIME_TYPES,
  type Attachment,
  can,
  type Card,
  dataUrlSize,
  MAX_ATTACHMENTS_PER_PURCHASE,
  type Purchase,
  type PurchaseReview,
} from '../../domain';
import { AppError } from '../errors';
import type { AttachmentRepository } from '../repositories';
import { newId, nowISO, type Store } from './store';
import { hasHolderPower } from './views';

const MAX_NAME_LENGTH = 120;

export function createAttachmentRepository(store: Store): AttachmentRepository {
  const requireVisible = (attachmentId: string) => {
    const attachment = store.require('attachments', attachmentId, 'Anexo') as Attachment;
    if (attachment.deletedAt) throw new AppError('not_found', 'Anexo não encontrado.');
    const me = store.requireMembership(attachment.familyId);
    return { attachment, me };
  };

  return {
    add: (input) =>
      store.run(
        () => {
          const purchase = store.require('purchases', input.purchaseId, 'Compra') as Purchase;
          const me = store.requireMembership(purchase.familyId);
          if (!can(me.role, 'purchase.create')) throw new AppError('forbidden', 'Você não pode anexar arquivos.');
          if (input.reviewId) {
            const review = store.find('reviews', input.reviewId) as PurchaseReview | undefined;
            if (!review || review.purchaseId !== purchase.id) throw new AppError('not_found', 'Contestação não encontrada.');
          }
          const mimeType = input.mimeType.toLowerCase();
          if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType) || !input.dataUrl.startsWith(`data:${mimeType};base64,`)) {
            throw new AppError('validation', 'Envie uma imagem (JPG, PNG) ou um PDF.');
          }
          if (input.dataUrl.length > ATTACHMENT_MAX_DATA_URL_LENGTH) {
            throw new AppError('validation', 'Arquivo grande demais. O limite é de 2 MB.');
          }
          const count = store.db.attachments.filter((a) => a.purchaseId === purchase.id && !a.deletedAt).length;
          if (count >= MAX_ATTACHMENTS_PER_PURCHASE) {
            throw new AppError('validation', `Cada compra aceita até ${MAX_ATTACHMENTS_PER_PURCHASE} anexos.`);
          }

          const attachment: Attachment = {
            id: newId('att'),
            familyId: purchase.familyId,
            purchaseId: purchase.id,
            reviewId: input.reviewId,
            name: input.name.trim().slice(0, MAX_NAME_LENGTH) || 'Anexo',
            mimeType,
            sizeBytes: dataUrlSize(input.dataUrl),
            createdBy: store.currentUserId(),
            createdAt: nowISO(),
          };
          store.db.attachments.push(attachment);
          store.db.blobs[attachment.id] = input.dataUrl;
          store.audit({
            familyId: purchase.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'updated',
            summary: `Anexo adicionado: ${attachment.name}`,
            changes: [],
          });
          return attachment;
        },
        { write: true },
      ),

    remove: (attachmentId) =>
      store.run(
        () => {
          const { attachment, me } = requireVisible(attachmentId);
          const purchase = store.require('purchases', attachment.purchaseId, 'Compra') as Purchase;
          const card = store.require('cards', purchase.cardId, 'Cartão') as Card;
          if (attachment.createdBy !== store.currentUserId() && !hasHolderPower(card, me)) {
            throw new AppError('forbidden', 'Só quem anexou ou a titular pode remover.');
          }
          // Rule 14: hidden, not erased.
          attachment.deletedAt = nowISO();
          store.audit({
            familyId: attachment.familyId,
            entity: 'purchase',
            entityId: purchase.id,
            action: 'updated',
            summary: `Anexo removido: ${attachment.name}`,
            changes: [],
          });
        },
        { write: true },
      ),

    getData: (attachmentId) =>
      store.run(() => {
        const { attachment } = requireVisible(attachmentId);
        const dataUrl = store.db.blobs[attachment.id];
        if (!dataUrl) throw new AppError('not_found', 'Não foi possível abrir o anexo.');
        return { attachment, dataUrl };
      }),
  };
}
