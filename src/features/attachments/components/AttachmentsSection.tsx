import { router } from 'expo-router';
import { Paperclip } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { AppText, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { type Attachment, isImageMime, MAX_ATTACHMENTS_PER_PURCHASE } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';
import { confirmAction, showError } from '@/utils/confirm';
import { useAddAttachment, useAttachmentData, useRemoveAttachment } from '../hooks';
import { AttachButtons } from './AttachButtons';
import { AttachmentThumb } from './AttachmentThumb';

export interface AttachmentsSectionProps {
  purchaseId: string;
  attachments: Attachment[];
  canAdd: boolean;
  canRemove: (attachment: Attachment) => boolean;
}

function SavedThumb({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const image = isImageMime(attachment.mimeType);
  const data = useAttachmentData(image ? attachment.id : undefined);
  return (
    <AttachmentThumb
      name={attachment.name}
      mimeType={attachment.mimeType}
      dataUrl={data.data?.dataUrl}
      loading={image && data.isLoading}
      onPress={() => router.push(`/attachment/${attachment.id}`)}
      onRemove={onRemove}
    />
  );
}

/** Receipts and screenshots attached to a purchase. */
export function AttachmentsSection({ purchaseId, attachments, canAdd, canRemove }: AttachmentsSectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const add = useAddAttachment();
  const remove = useRemoveAttachment();
  const full = attachments.length >= MAX_ATTACHMENTS_PER_PURCHASE;

  const confirmRemove = async (attachment: Attachment) => {
    const ok = await confirmAction({
      title: 'Remover anexo?',
      message: `"${attachment.name}" deixa de aparecer na compra.`,
      confirmLabel: 'Remover',
      destructive: true,
    });
    if (ok) remove.mutate(attachment.id, { onError: (error) => showError('Não foi possível remover', errorMessage(error)) });
  };

  if (!canAdd && attachments.length === 0) return null;

  return (
    <View>
      <SectionHeader title="Comprovantes e anexos" />
      <Surface style={styles.card}>
        {attachments.length === 0 ? (
          <View style={styles.empty}>
            <Paperclip size={18} color={colors.textMuted} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              Anexe um print da compra online, a nota ou o comprovante.
            </AppText>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {attachments.map((attachment) => (
              <SavedThumb
                key={attachment.id}
                attachment={attachment}
                onRemove={canRemove(attachment) ? () => confirmRemove(attachment) : undefined}
              />
            ))}
          </ScrollView>
        )}
        {canAdd && !full ? (
          <AttachButtons
            disabled={add.isPending}
            onPicked={(file) =>
              add.mutate({ purchaseId, ...file }, { onError: (error) => showError('Não foi possível anexar', errorMessage(error)) })
            }
          />
        ) : null}
        {add.isPending ? (
          <AppText variant="small" color="textMuted">
            Enviando anexo…
          </AppText>
        ) : null}
      </Surface>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.md },
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  thumbs: { gap: spacing.md, paddingTop: 6, paddingRight: 6 },
}));
