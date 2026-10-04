import { router, useLocalSearchParams } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Chip, ErrorState, LoadingState, Surface, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { DISPUTE_REASON_LABEL, type DisputeReason, formatBRL, MAX_ATTACHMENTS_PER_PURCHASE } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { AttachButtons } from '@/features/attachments/components/AttachButtons';
import { PickedFiles } from '@/features/attachments/components/PickedFiles';
import { useAddAttachment } from '@/features/attachments/hooks';
import type { PickedFile } from '@/features/attachments/pick-attachment';
import { useInvoice } from '@/features/invoices/hooks';
import { useDisputePurchase } from '@/features/reviews/hooks';
import { makeStyles, spacing } from '@/theme';
import { formatDate } from '@/utils/dates';

const REASONS = Object.keys(DISPUTE_REASON_LABEL) as DisputeReason[];

export default function DisputeScreen() {
  const styles = useStyles();
  const { invoiceId, purchaseId } = useLocalSearchParams<{ invoiceId: string; purchaseId: string }>();
  const invoice = useInvoice(invoiceId);
  const dispute = useDisputePurchase();
  const addAttachment = useAddAttachment();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (invoice.isLoading) return <LoadingState />;
  const line = invoice.data?.lines.find((l) => l.purchase.id === purchaseId);
  if (!invoice.data || !line) return <ErrorState message={errorMessage(invoice.error)} onRetry={() => invoice.refetch()} />;

  const noteRequired = reason === 'other';
  const canSubmit = Boolean(reason) && (!noteRequired || note.trim().length > 0);

  const submit = async () => {
    if (!reason) return;
    setSaving(true);
    setError(null);
    try {
      const review = await dispute.mutateAsync({ invoiceId, purchaseId, input: { reason, note: note.trim() || undefined } });
      for (const file of files) await addAttachment.mutateAsync({ purchaseId, reviewId: review.id, ...file });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Contestar compra" subtitle={line.purchase.merchant} />
      <Screen
        footer={<Button label="Enviar contestação" icon={CircleAlert} size="lg" disabled={!canSubmit} loading={saving} onPress={submit} />}>
        <Surface style={styles.summary}>
          <AppText variant="bodyStrong">{line.purchase.merchant}</AppText>
          <AppText variant="caption" color="textSecondary">
            {formatBRL(line.installment.amountCents)} · {formatDate(line.purchase.date)} · comprou {line.buyer.displayName}
          </AppText>
        </Surface>

        <View style={styles.block}>
          <AppText variant="bodyStrong">O que há de errado?</AppText>
          <View style={styles.chips}>
            {REASONS.map((value) => (
              <Chip key={value} label={DISPUTE_REASON_LABEL[value]} selected={reason === value} onPress={() => setReason(value)} />
            ))}
          </View>
        </View>

        <TextField
          label={noteRequired ? 'Explique o motivo' : 'Comentário (opcional)'}
          placeholder="Ex.: essa compra é da Ana, não minha"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={300}
        />

        <View style={styles.block}>
          <AppText variant="bodyStrong">Anexar print ou comprovante (opcional)</AppText>
          <PickedFiles files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} />
          {files.length < MAX_ATTACHMENTS_PER_PURCHASE - line.attachmentCount ? (
            <AttachButtons onPicked={(file) => setFiles((current) => [...current, file])} disabled={saving} />
          ) : null}
        </View>

        <FormError message={error} />
        <AppText variant="small" color="textMuted">
          {invoice.data.holder.displayName} recebe um aviso e a fatura só fecha depois que a contestação for respondida.
        </AppText>
      </Screen>
    </>
  );
}

const useStyles = makeStyles(() => ({
  summary: { gap: 2 },
  block: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
