import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CircleAlert, Copy, RotateCcw, Search, ThumbsUp, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

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
import { errorMessage, type InvoiceLine, type PaymentView } from '@/data';
import { can, canTransition, formatBRL, formatRef, INVOICE_STATUS_LABEL, nextInvoiceStatus } from '@/domain';
import { useChangeInvoiceStatus, useConfirmPayment, useInvoice, useRejectPayment } from '@/features/invoices/hooks';
import { PaymentsToConfirm } from '@/features/invoices/components/PaymentsToConfirm';
import { PixCard } from '@/features/invoices/components/PixCard';
import { ReviewBadge } from '@/features/reviews/components/ReviewBadge';
import { ReviewProgressCard } from '@/features/reviews/components/ReviewProgressCard';
import { useConfirmPurchase } from '@/features/reviews/hooks';
import { confirmAction, showError } from '@/utils/confirm';
import { filterLines, type GroupBy, groupLines } from '@/features/invoices/group-lines';
import { MemberBalanceRow } from '@/features/invoices/components/MemberBalanceRow';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

type Tab = 'purchases' | 'members';

const NEXT_ACTION_LABEL: Partial<Record<string, string>> = {
  reviewing: 'Iniciar conferência',
  closed: 'Fechar fatura',
  collecting: 'Cobrar a família',
  paid: 'Marcar como paga',
  archived: 'Arquivar',
};

export default function InvoiceScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const invoice = useInvoice(invoiceId);
  const changeStatus = useChangeInvoiceStatus();
  const confirmPurchase = useConfirmPurchase();
  const confirmPayment = useConfirmPayment();
  const rejectPayment = useRejectPayment();
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
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

  const reviewing = data.invoice.status === 'reviewing';
  const awaitingMe = data.lines.filter((line) => line.review.awaitingMe);
  const openDisputes = data.reviewProgress.disputed;
  const blockedByDisputes = next === 'closed' && openDisputes > 0;
  const pendingPayments = data.payments.filter((payment) => payment.status === 'pending');
  const showReview = reviewing || data.lines.some((line) => line.review.disputes.length > 0);

  const advance = async () => {
    if (!next) return;
    const message =
      next === 'closed'
        ? 'Depois de fechada, as compras ficam protegidas e só a titular pode alterá-las. Cada pessoa recebe o valor da sua parte.'
        : next === 'reviewing'
          ? 'Cada pessoa vai receber um aviso para conferir as próprias compras.'
          : `A fatura passará para "${INVOICE_STATUS_LABEL[next]}".`;
    if (!(await confirmAction({ title: NEXT_ACTION_LABEL[next] ?? 'Avançar', message }))) return;
    changeStatus.mutate({ invoiceId, status: next }, { onError: (error) => showError('Não foi possível alterar', errorMessage(error)) });
  };

  const confirmLine = (line: InvoiceLine) =>
    confirmPurchase.mutate(
      { invoiceId, purchaseId: line.purchase.id },
      { onError: (error) => showError('Não foi possível confirmar', errorMessage(error)) },
    );

  const confirmAll = async () => {
    setConfirmingAll(true);
    try {
      for (const line of awaitingMe) await confirmPurchase.mutateAsync({ invoiceId, purchaseId: line.purchase.id });
    } catch (error) {
      showError('Não foi possível confirmar', errorMessage(error));
    } finally {
      setConfirmingAll(false);
    }
  };

  const onConfirmPayment = (payment: PaymentView) => {
    setBusyPaymentId(payment.id);
    confirmPayment.mutate(payment.id, {
      onError: (error) => showError('Não foi possível confirmar', errorMessage(error)),
      onSettled: () => setBusyPaymentId(null),
    });
  };

  const onRejectPayment = async (payment: PaymentView) => {
    const ok = await confirmAction({
      title: 'Não recebeu?',
      message: `O pagamento de ${formatBRL(payment.amountCents)} de ${payment.member.displayName} volta a ficar em aberto e a pessoa é avisada.`,
      confirmLabel: 'Não recebi',
      destructive: true,
    });
    if (!ok) return;
    setBusyPaymentId(payment.id);
    rejectPayment.mutate(
      { paymentId: payment.id },
      {
        onError: (error) => showError('Não foi possível recusar', errorMessage(error)),
        onSettled: () => setBusyPaymentId(null),
      },
    );
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
          <PixCard
            holderName={data.holder.displayName}
            pixKey={data.holderPixKey}
            toSendCents={myBalance.pendingCents - myBalance.awaitingCents}
            awaitingCents={myBalance.awaitingCents}
            onInform={() => router.push(`/invoice/payment?invoiceId=${invoiceId}&memberId=${data.me.id}`)}
          />
        ) : null}

        {reviewing ? (
          <ReviewProgressCard
            progress={data.reviewProgress}
            awaitingMeCount={awaitingMe.length}
            onConfirmAll={confirmAll}
            confirmingAll={confirmingAll}
          />
        ) : null}

        {data.canManage && pendingPayments.length > 0 ? (
          <PaymentsToConfirm payments={pendingPayments} busyId={busyPaymentId} onConfirm={onConfirmPayment} onReject={onRejectPayment} />
        ) : null}

        {canChangeStatus && (next || canTransition(data.invoice.status, 'open')) ? (
          <View style={styles.statusActions}>
            {blockedByDisputes ? (
              <View style={styles.warning}>
                <CircleAlert size={16} color={colors.danger} />
                <AppText variant="caption" color="danger" style={styles.flex}>
                  {openDisputes === 1
                    ? 'Há 1 compra contestada. Responda a contestação antes de fechar a fatura.'
                    : `Há ${openDisputes} compras contestadas. Responda as contestações antes de fechar a fatura.`}
                </AppText>
              </View>
            ) : null}
            {next ? (
              <Button
                label={NEXT_ACTION_LABEL[next] ?? 'Avançar'}
                icon={ArrowRight}
                onPress={advance}
                loading={changeStatus.isPending}
                disabled={blockedByDisputes}
              />
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
                          attachmentCount={line.attachmentCount}
                          onPress={() => router.push(`/purchase/${line.purchase.id}`)}
                          footer={
                            showReview ? (
                              <>
                                <ReviewBadge review={line.review} />
                                {reviewing && line.review.awaitingMe ? (
                                  <View style={styles.lineActions}>
                                    <Button
                                      label="Contestar"
                                      icon={X}
                                      variant="secondary"
                                      fullWidth={false}
                                      style={styles.lineButton}
                                      onPress={() => router.push(`/review/dispute?invoiceId=${invoiceId}&purchaseId=${line.purchase.id}`)}
                                    />
                                    <Button
                                      label="Reconheço"
                                      icon={ThumbsUp}
                                      fullWidth={false}
                                      style={styles.lineButton}
                                      disabled={confirmingAll}
                                      onPress={() => confirmLine(line)}
                                    />
                                  </View>
                                ) : null}
                              </>
                            ) : null
                          }
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

const useStyles = makeStyles((colors) => ({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
  },
  lineActions: { flexDirection: 'row', gap: spacing.sm },
  lineButton: { flex: 1, height: 36, paddingHorizontal: spacing.sm },
  statusActions: { gap: spacing.sm },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  list: { paddingHorizontal: spacing.lg, borderRadius: radius.xl },
  pixHint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.xs },
  flex: { flex: 1 },
}));
