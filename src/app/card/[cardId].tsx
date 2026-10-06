import { router, useLocalSearchParams } from 'expo-router';
import { Plus, ReceiptText } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CreditCardView, InvoiceStatusBadge } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, ErrorState, ListRow, LoadingState, ProgressBar, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { formatRef, installmentAmounts, installmentProgress } from '@/domain';
import { useCard } from '@/features/cards/hooks';
import { useCardInvoices, useInvoice } from '@/features/invoices/hooks';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { spacing, useTheme } from '@/theme';
import { formatShortDate } from '@/utils/dates';

export default function CardScreen() {
  const formatBRL = useMoneyFormatter();
  const { colors } = useTheme();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const card = useCard(cardId);
  const invoices = useCardInvoices(cardId);
  const current = useInvoice(card.data?.currentInvoice?.id);

  if (card.isLoading) return <LoadingState />;
  if (card.error || !card.data) return <ErrorState message={errorMessage(card.error)} onRetry={() => card.refetch()} />;

  const { totals, currentInvoice, holder } = card.data;
  const accruing = !currentInvoice || currentInvoice.status === 'open' || currentInvoice.status === 'reviewing';
  const myOwedCents = current.data?.balances.find((b) => b.memberId === current.data?.me.id)?.owedCents ?? 0;
  const installments = current.data?.lines.filter((line) => line.installment.count > 1) ?? [];

  return (
    <>
      <PageHeader title={card.data.card.name} subtitle={`Fecha dia ${card.data.card.closingDay} · vence dia ${card.data.card.dueDay}`} />
      <Screen refreshing={card.isRefetching} onRefresh={() => Promise.all([card.refetch(), invoices.refetch(), current.refetch()])}>
        <View style={styles.center}>
          <CreditCardView card={card.data.card} holderName={holder.displayName} width={320} />
        </View>

        <Surface
          style={styles.summary}
          onPress={currentInvoice ? () => router.push(`/invoice/${currentInvoice.id}`) : undefined}
          accessibilityLabel="Abrir fatura atual">
          <View style={styles.summaryHeader}>
            <AppText variant="caption" color="textSecondary">
              Fatura atual{currentInvoice ? ` · ${formatRef(currentInvoice.ref, { capitalize: true })}` : ''}
            </AppText>
            {currentInvoice ? <InvoiceStatusBadge status={currentInvoice.status} /> : null}
          </View>
          <AppText variant="moneyLarge" color="brand">
            {formatBRL(totals.totalCents)}
          </AppText>
          <ProgressBar progress={totals.progress} />
          <View style={styles.stats}>
            <Stat label="Recebido" value={formatBRL(totals.receivedCents)} color={colors.success} />
            <Stat
              label={accruing ? 'A receber' : 'Falta receber'}
              value={formatBRL(totals.pendingCents)}
              color={totals.pendingCents && !accruing ? colors.danger : colors.text}
            />
            <Stat label="Vencimento" value={currentInvoice ? formatShortDate(currentInvoice.dueDate) : '—'} color={colors.text} />
          </View>
        </Surface>

        {currentInvoice && myOwedCents > 0 ? (
          <Surface padded={false} style={styles.list}>
            <ListRow
              title="Minha fatura"
              subtitle={`Só a sua parte: ${formatBRL(myOwedCents)}`}
              leading={<ReceiptText size={20} color={colors.primary} />}
              onPress={() => router.push(`/invoice/${currentInvoice.id}?view=mine`)}
            />
          </Surface>
        ) : null}

        <Button
          label="Nova compra neste cartão"
          icon={Plus}
          variant="accent"
          onPress={() => router.push(`/purchase/new?cardId=${cardId}`)}
        />

        {installments.length > 0 ? (
          <View>
            <SectionHeader title="Parcelamentos ativos" />
            <Surface padded={false} style={styles.list}>
              {installments.map((line, index) => {
                const progress = installmentProgress(
                  installmentAmounts(line.purchase.totalCents, line.installment.count),
                  line.installment.number,
                );
                return (
                  <View key={line.installment.id}>
                    {index > 0 && <Divider />}
                    <View style={styles.installment}>
                      <View style={styles.installmentTop}>
                        <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                          {line.purchase.merchant}
                        </AppText>
                        <AppText variant="money">{formatBRL(line.installment.amountCents)}</AppText>
                      </View>
                      <ProgressBar progress={progress.current / progress.count} color={colors.primary} height={6} />
                      <AppText variant="caption" color="textSecondary">
                        Parcela {progress.current} de {progress.count} ·{' '}
                        {progress.remainingCount === 0
                          ? 'última parcela'
                          : `restam ${progress.remainingCount} (${formatBRL(progress.remainingCents)})`}
                      </AppText>
                    </View>
                  </View>
                );
              })}
            </Surface>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Faturas" />
          <Surface padded={false} style={styles.list}>
            {invoices.data?.map((item, index) => (
              <View key={item.invoice.id}>
                {index > 0 && <Divider inset={spacing.lg + 32} />}
                <ListRow
                  title={formatRef(item.invoice.ref, { capitalize: true })}
                  subtitle={`${formatBRL(item.totals.totalCents)} · vence ${formatShortDate(item.invoice.dueDate)}`}
                  leading={<ReceiptText size={20} color={colors.primary} />}
                  trailing={<InvoiceStatusBadge status={item.invoice.status} />}
                  onPress={() => router.push(`/invoice/${item.invoice.id}`)}
                />
              </View>
            ))}
          </Surface>
        </View>
      </Screen>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.flex}>
      <AppText variant="small" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  summary: { gap: spacing.md },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg },
  installment: { paddingVertical: spacing.md, gap: spacing.sm },
  installmentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
