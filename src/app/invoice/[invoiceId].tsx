import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Copy, RotateCcw, Search, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { InvoiceSummaryCard, PurchaseRow } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import {
  AppText,
  Button,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  SegmentedControl,
  Surface,
  TextField,
} from '@/components/ui';
import { errorMessage } from '@/data';
import { can, canTransition, formatBRL, formatRef, INVOICE_STATUS_LABEL, nextInvoiceStatus } from '@/domain';
import { useChangeInvoiceStatus, useInvoice } from '@/features/invoices/hooks';
import { filterLines, type GroupBy, groupLines } from '@/features/invoices/group-lines';
import { MemberBalanceRow } from '@/features/invoices/components/MemberBalanceRow';
import { colors, palette, radius, spacing } from '@/theme';

type Tab = 'purchases' | 'members';

const NEXT_ACTION_LABEL: Partial<Record<string, string>> = {
  reviewing: 'Iniciar conferência',
  closed: 'Fechar fatura',
  collecting: 'Cobrar a família',
  paid: 'Marcar como paga',
  archived: 'Arquivar',
};

export default function InvoiceScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const invoice = useInvoice(invoiceId);
  const changeStatus = useChangeInvoiceStatus();
  const [tab, setTab] = useState<Tab>('purchases');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [search, setSearch] = useState('');

  const groups = useMemo(
    () => (invoice.data ? groupLines(filterLines(invoice.data.lines, search), groupBy) : []),
    [invoice.data, search, groupBy],
  );

  if (invoice.isLoading) return <LoadingState />;
  if (invoice.error || !invoice.data) return <ErrorState message={errorMessage(invoice.error)} onRetry={() => invoice.refetch()} />;

  const data = invoice.data;
  const isCardHolder = data.card.holderMemberId === data.me.id;
  const canChangeStatus = can(data.me.role, 'invoice.changeStatus', { isCardHolder });
  const canRegisterAny = can(data.me.role, 'payment.register', { isCardHolder });
  const next = nextInvoiceStatus(data.invoice.status);
  const myBalance = data.balances.find((b) => b.memberId === data.me.id);

  const advance = () => {
    if (!next) return;
    const run = () =>
      changeStatus.mutate(
        { invoiceId, status: next },
        { onError: (error) => Alert.alert('Não foi possível alterar', errorMessage(error)) },
      );
    const message =
      next === 'closed'
        ? 'Depois de fechada, as compras ficam protegidas e só a titular pode alterá-las.'
        : `A fatura passará para "${INVOICE_STATUS_LABEL[next]}".`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) run();
    } else {
      Alert.alert(NEXT_ACTION_LABEL[next] ?? 'Avançar', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: run },
      ]);
    }
  };

  return (
    <>
      <PageHeader title={`Fatura ${formatRef(data.invoice.ref, { capitalize: true })}`} subtitle={data.card.name} />
      <Screen refreshing={invoice.isRefetching} onRefresh={() => invoice.refetch()}>
        <InvoiceSummaryCard
          pendingLabel={data.invoice.status === 'open' || data.invoice.status === 'reviewing' ? 'A receber' : 'Falta receber'}
          title={`${data.lines.length} ${data.lines.length === 1 ? 'compra' : 'compras'}`}
          totals={data.totals}
          dueDate={data.invoice.dueDate}
          status={data.invoice.status}
          holderName={data.holder.displayName}
        />

        {myBalance && myBalance.status !== 'holder' && myBalance.pendingCents > 0 && data.invoice.status !== 'open' ? (
          <Surface style={styles.pix}>
            <View style={styles.pixText}>
              <AppText variant="caption" color="textSecondary">
                Sua parte
              </AppText>
              <AppText variant="h3">
                Enviar {formatBRL(myBalance.pendingCents)} para {data.holder.displayName}
              </AppText>
            </View>
            <Button
              label="Informar pagamento"
              icon={Send}
              variant="accent"
              onPress={() => router.push(`/invoice/payment?invoiceId=${invoiceId}&memberId=${data.me.id}`)}
            />
          </Surface>
        ) : null}

        {canChangeStatus && (next || canTransition(data.invoice.status, 'open')) ? (
          <View style={styles.statusActions}>
            {next ? (
              <Button label={NEXT_ACTION_LABEL[next] ?? 'Avançar'} icon={ArrowRight} onPress={advance} loading={changeStatus.isPending} />
            ) : null}
            {canTransition(data.invoice.status, 'open') ? (
              <Button
                label="Reabrir fatura"
                icon={RotateCcw}
                variant="ghost"
                onPress={() => changeStatus.mutate({ invoiceId, status: 'open' })}
              />
            ) : null}
          </View>
        ) : null}

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'purchases', label: 'Compras' },
            { value: 'members', label: 'Quem deve quanto' },
          ]}
        />

        {tab === 'purchases' ? (
          <View style={styles.section}>
            <TextField
              label="Buscar"
              placeholder="Estabelecimento, pessoa ou categoria"
              value={search}
              onChangeText={setSearch}
              trailing={<Search size={18} color={colors.textMuted} />}
            />
            <View style={styles.chips}>
              <Chip label="Por data" selected={groupBy === 'date'} onPress={() => setGroupBy('date')} />
              <Chip label="Por categoria" selected={groupBy === 'category'} onPress={() => setGroupBy('category')} />
            </View>
            {groups.length === 0 ? (
              <Surface>
                <EmptyState icon={Search} title={search ? 'Nada encontrado' : 'Nenhuma compra nesta fatura'} />
              </Surface>
            ) : (
              groups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <AppText variant="overline" color="textSecondary">
                      {group.title}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {formatBRL(group.totalCents)}
                    </AppText>
                  </View>
                  <Surface padded={false} style={styles.list}>
                    {group.lines.map((line, index) => (
                      <View key={line.installment.id}>
                        {index > 0 && <Divider inset={56} />}
                        <PurchaseRow
                          merchant={line.purchase.merchant}
                          statementName={line.purchase.statementName}
                          amountCents={line.installment.amountCents}
                          category={line.category}
                          buyer={line.buyer}
                          payers={line.shares.map((s) => s.member)}
                          installment={{ number: line.installment.number, count: line.installment.count }}
                          onPress={() => router.push(`/purchase/${line.purchase.id}`)}
                        />
                      </View>
                    ))}
                  </Surface>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Surface padded={false} style={styles.list}>
              {data.balances.map((balance, index) => (
                <View key={balance.memberId}>
                  {index > 0 && <Divider />}
                  <MemberBalanceRow
                    balance={balance}
                    isMe={balance.memberId === data.me.id}
                    canRegister={canRegisterAny || balance.memberId === data.me.id}
                    invoiceOpen={data.invoice.status === 'open' || data.invoice.status === 'reviewing'}
                    onRegister={() => router.push(`/invoice/payment?invoiceId=${invoiceId}&memberId=${balance.memberId}`)}
                  />
                </View>
              ))}
            </Surface>
            {data.holder.id === data.me.id ? null : (
              <View style={styles.pixHint}>
                <Copy size={14} color={colors.textMuted} />
                <AppText variant="small" color="textMuted" style={styles.flex}>
                  Os pagamentos são feitos por PIX direto para a titular. O Wallit só organiza quem já pagou.
                </AppText>
              </View>
            )}
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  pix: { gap: spacing.md, backgroundColor: palette.yellow100, borderWidth: 1, borderColor: palette.yellow400 },
  pixText: { gap: 2 },
  statusActions: { gap: spacing.xs },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  list: { paddingHorizontal: spacing.lg, borderRadius: radius.xl },
  pixHint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.xs },
  flex: { flex: 1 },
});
