import { router } from 'expo-router';
import { CircleDot, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InvoiceStatusBadge, PaymentStatusBadge } from '@/components/finance';
import { GradientHeader, Screen } from '@/components/layout';
import { AppText, Badge, Chip, EmptyState, ErrorState, LoadingState, ProgressBar, Surface } from '@/components/ui';
import { errorMessage, type InvoiceListItem } from '@/data';
import { compareRefs, formatBRL, formatRef, type InvoiceRef, invoiceRefForDate } from '@/domain';
import { useCurrentFamily } from '@/features/families/hooks';
import { useFamilyInvoices } from '@/features/invoices/hooks';
import { makeStyles, spacing, useTheme } from '@/theme';
import { formatShortDate, todayISO } from '@/utils/dates';

type Filter = 'current' | 'pending' | 'past' | 'future';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'current', label: 'Atuais' },
  { value: 'pending', label: 'Recebendo' },
  { value: 'past', label: 'Anteriores' },
  { value: 'future', label: 'Futuras' },
];

function currentRef(item: InvoiceListItem): InvoiceRef {
  return invoiceRefForDate(todayISO(), item.card.closingDay);
}

function matches(item: InvoiceListItem, filter: Filter): boolean {
  const diff = compareRefs(item.invoice.ref, currentRef(item));
  switch (filter) {
    case 'current':
      return diff === 0;
    case 'pending':
      return item.invoice.status === 'collecting' || item.invoice.status === 'closed';
    case 'past':
      return diff < 0;
    case 'future':
      return diff > 0;
  }
}

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { current } = useCurrentFamily();
  const invoices = useFamilyInvoices(current?.family.id);
  const [filter, setFilter] = useState<Filter>('current');
  const items = useMemo(() => (invoices.data ?? []).filter((item) => matches(item, filter)), [invoices.data, filter]);

  return (
    <Screen
      withTabBar
      refreshing={invoices.isRefetching}
      onRefresh={() => invoices.refetch()}
      header={
        <GradientHeader>
          <AppText variant="h1" color="headerText">
            Faturas
          </AppText>
          <AppText variant="body" color="headerTextSecondary">
            {current?.family.name ?? 'Nenhuma família selecionada'}
          </AppText>
        </GradientHeader>
      }>
      <View style={styles.filters}>
        {FILTERS.map((option) => (
          <Chip key={option.value} label={option.label} selected={filter === option.value} onPress={() => setFilter(option.value)} />
        ))}
      </View>

      {invoices.isLoading ? (
        <LoadingState />
      ) : invoices.error ? (
        <ErrorState message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
      ) : items.length === 0 ? (
        <Surface>
          <EmptyState
            icon={ReceiptText}
            title="Nenhuma fatura aqui"
            description="As faturas são criadas automaticamente quando uma compra é registrada."
          />
        </Surface>
      ) : (
        items.map((item) => {
          const accruing = item.invoice.status === 'open' || item.invoice.status === 'reviewing';
          return (
            <Surface
              key={item.invoice.id}
              onPress={() => router.push(`/invoice/${item.invoice.id}`)}
              style={styles.card}
              accessibilityLabel={`Fatura ${formatRef(item.invoice.ref)} do ${item.card.name}`}>
              <View style={styles.top}>
                <View style={styles.flex}>
                  <AppText variant="caption" color="textSecondary">
                    {item.card.name}
                  </AppText>
                  <AppText variant="h3">{formatRef(item.invoice.ref, { capitalize: true })}</AppText>
                </View>
                <InvoiceStatusBadge status={item.invoice.status} />
              </View>
              <View style={styles.top}>
                <AppText variant="h2" color="brand" style={styles.flex}>
                  {formatBRL(item.totals.totalCents)}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  vence {formatShortDate(item.invoice.dueDate)}
                </AppText>
              </View>
              <ProgressBar progress={item.totals.progress} height={6} />
              <View style={styles.top}>
                <AppText variant="caption" color="textSecondary" style={styles.flex}>
                  Recebido {formatBRL(item.totals.receivedCents)} · {accruing ? 'a receber' : 'falta'} {formatBRL(item.totals.pendingCents)}
                </AppText>
              </View>
              {item.myBalance && item.myBalance.owedCents > 0 ? (
                <View style={styles.mine}>
                  <AppText variant="caption" style={styles.flex}>
                    Sua parte:{' '}
                    <AppText variant="caption" color="brand">
                      {formatBRL(item.myBalance.owedCents)}
                    </AppText>
                  </AppText>
                  {accruing && item.myBalance.status === 'pending' ? (
                    <Badge label="Em aberto" color={colors.textSecondary} background={colors.surfaceMuted} icon={CircleDot} />
                  ) : (
                    <PaymentStatusBadge status={item.myBalance.status} />
                  )}
                </View>
              ) : null}
            </Surface>
          );
        })
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: -spacing.sm },
  card: { gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
}));
