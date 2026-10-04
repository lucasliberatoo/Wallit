import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Pencil } from 'lucide-react-native';
import { useState } from 'react';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, ErrorState, LoadingState, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { usePurchase } from '@/features/purchases/hooks';
import { DisputeList } from '@/features/reviews/components/DisputeList';
import { useResolveDispute } from '@/features/reviews/hooks';

export default function ResolveDisputeScreen() {
  const { purchaseId, reviewId } = useLocalSearchParams<{ purchaseId: string; reviewId: string }>();
  const purchase = usePurchase(purchaseId);
  const resolve = useResolveDispute();
  const [note, setNote] = useState('');

  if (purchase.isLoading) return <LoadingState />;
  const dispute = purchase.data?.disputes.find((d) => d.review.id === reviewId);
  if (!purchase.data || !dispute) return <ErrorState message={errorMessage(purchase.error)} onRetry={() => purchase.refetch()} />;

  return (
    <>
      <PageHeader title="Responder contestação" subtitle={purchase.data.purchase.merchant} />
      <Screen
        footer={
          <Button
            label="Marcar como resolvida"
            icon={CircleCheck}
            size="lg"
            disabled={note.trim().length === 0}
            loading={resolve.isPending}
            onPress={() => resolve.mutate({ reviewId, note: note.trim() }, { onSuccess: () => router.back() })}
          />
        }>
        <DisputeList disputes={[dispute]} canResolve={false} onResolve={() => undefined} />
        {purchase.data.canEdit ? (
          <>
            <AppText variant="caption" color="textSecondary">
              Se a compra estiver errada, corrija o valor, a data ou a divisão antes de responder.
            </AppText>
            <Button
              label="Corrigir a compra"
              icon={Pencil}
              variant="secondary"
              onPress={() => router.push(`/purchase/edit/${purchaseId}`)}
            />
          </>
        ) : null}
        <TextField
          label="Resposta"
          placeholder="Ex.: corrigi a divisão, agora fica só com a Ana"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={300}
        />
        <FormError message={resolve.error ? errorMessage(resolve.error) : null} />
        <AppText variant="small" color="textMuted">
          {dispute.member.displayName} recebe um aviso com a sua resposta.
        </AppText>
      </Screen>
    </>
  );
}
