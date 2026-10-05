import { router, useLocalSearchParams } from 'expo-router';
import { FastForward, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Chip, ErrorState, IconButton, LoadingState, Surface } from '@/components/ui';
import { errorMessage, type PurchaseDetails } from '@/data';
import { formatBRL, formatRef } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useAnticipateInstallments, usePurchase } from '@/features/purchases/hooks';
import { makeStyles, radius, spacing } from '@/theme';

export default function AnticipateScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const purchase = usePurchase(purchaseId);
  if (purchase.isLoading) return <LoadingState />;
  if (!purchase.data?.anticipation) {
    return <ErrorState message={purchase.error ? errorMessage(purchase.error) : 'Não há parcelas para antecipar.'} />;
  }
  return <AnticipateForm details={purchase.data} anticipation={purchase.data.anticipation} />;
}

function AnticipateForm({
  details,
  anticipation,
}: {
  details: PurchaseDetails;
  anticipation: NonNullable<PurchaseDetails['anticipation']>;
}) {
  const styles = useStyles();
  const anticipate = useAnticipateInstallments();
  const { purchase } = details;
  const max = anticipation.available;
  const [count, setCount] = useState(max);
  // Last installments first, the same ones the bank brings forward.
  const future = details.installments
    .filter(({ invoice }) => invoice.ref.year * 12 + invoice.ref.month > anticipation.targetRef.year * 12 + anticipation.targetRef.month)
    .sort((a, b) => b.installment.number - a.installment.number);
  const chosen = future.slice(0, count);
  const chosenCents = chosen.reduce((sum, { installment }) => sum + installment.amountCents, 0);
  const payOff = count === max;

  return (
    <>
      <PageHeader title="Antecipar parcelas" subtitle={purchase.merchant} />
      <Screen
        footer={
          <Button
            label={payOff ? 'Quitar a compra' : `Antecipar ${count} ${count === 1 ? 'parcela' : 'parcelas'}`}
            icon={FastForward}
            size="lg"
            loading={anticipate.isPending}
            onPress={() => anticipate.mutate({ purchaseId: purchase.id, count }, { onSuccess: () => router.back() })}
          />
        }>
        <AppText variant="body" color="textSecondary">
          Use quando o titular do cartão antecipar parcelas no app do banco. As últimas parcelas passam para a fatura de{' '}
          {formatRef(anticipation.targetRef)}, e cada pessoa paga a sua parte nela.
        </AppText>

        <Surface style={styles.card}>
          <View style={styles.stepper}>
            <IconButton icon={Minus} accessibilityLabel="Menos parcelas" onPress={() => setCount((c) => Math.max(1, c - 1))} />
            <View style={styles.center} accessibilityLiveRegion="polite">
              <AppText variant="h2">
                {count} de {max}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {count === 1 ? 'parcela futura' : 'parcelas futuras'}
              </AppText>
            </View>
            <IconButton icon={Plus} accessibilityLabel="Mais parcelas" onPress={() => setCount((c) => Math.min(max, c + 1))} />
          </View>
          <View style={styles.chips}>
            <Chip label="Só a última" selected={count === 1} onPress={() => setCount(1)} />
            <Chip label="Quitar tudo" selected={payOff} onPress={() => setCount(max)} />
          </View>
        </Surface>

        <Surface style={styles.summary}>
          <AppText variant="caption" color="textSecondary">
            Vai para a fatura de {formatRef(anticipation.targetRef)}
          </AppText>
          <AppText variant="moneyLarge" color="brand">
            {formatBRL(chosenCents)}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            Parcelas{' '}
            {chosen
              .map(({ installment }) => installment.number)
              .sort((a, b) => a - b)
              .join(', ')}{' '}
            de {purchase.installmentCount}
          </AppText>
          {payOff ? (
            <AppText variant="caption" color="success">
              Com isso a compra fica quitada.
            </AppText>
          ) : null}
        </Surface>

        <AppText variant="small" color="textMuted">
          Se o banco deu desconto na antecipação, ajuste o valor da compra depois em Editar.
        </AppText>
        <FormError message={anticipate.error ? errorMessage(anticipate.error) : null} />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  center: { flex: 1, alignItems: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  summary: { alignItems: 'center', gap: spacing.xs },
}));
