import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, History, Pencil, ShoppingBag, ThumbsUp, Trash2, UserRound, X } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { CategoryIcon, InvoiceStatusBadge } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import {
  AppText,
  Avatar,
  Button,
  Divider,
  ErrorState,
  IconButton,
  ListRow,
  LoadingState,
  ProgressBar,
  SectionHeader,
  Surface,
} from '@/components/ui';
import { errorMessage } from '@/data';
import { formatBRL, formatRef, installmentAmounts, installmentProgress } from '@/domain';
import { AttachmentsSection } from '@/features/attachments/components/AttachmentsSection';
import { useCancelPurchase, usePurchase } from '@/features/purchases/hooks';
import { DisputeList } from '@/features/reviews/components/DisputeList';
import { ReviewBadge } from '@/features/reviews/components/ReviewBadge';
import { useConfirmPurchase } from '@/features/reviews/hooks';
import { confirmAction, showError } from '@/utils/confirm';
import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { formatDate, formatDateTime, formatShortDate, todayISO } from '@/utils/dates';

export default function PurchaseScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { purchaseId, created } = useLocalSearchParams<{ purchaseId: string; created?: string }>();
  const purchase = usePurchase(purchaseId);
  const cancel = useCancelPurchase();
  const confirmPurchase = useConfirmPurchase();

  if (purchase.isLoading) return <LoadingState />;
  if (purchase.error || !purchase.data) return <ErrorState message={errorMessage(purchase.error)} onRetry={() => purchase.refetch()} />;

  const data = purchase.data;
  const { purchase: p } = data;
  const amounts = installmentAmounts(p.totalCents, p.installmentCount);
  const today = todayISO();
  const currentIndex = data.installments.findIndex(({ invoice }) => invoice.dueDate >= today);
  const progress =
    p.installmentCount > 1 ? installmentProgress(amounts, currentIndex === -1 ? p.installmentCount : currentIndex + 1) : null;
  const cancelled = p.status === 'cancelled';

  const confirmCancel = async () => {
    const ok = await confirmAction({
      title: 'Cancelar compra?',
      message: 'Ela sai das faturas, mas continua no histórico.',
      confirmLabel: 'Cancelar compra',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(purchaseId, {
      onSuccess: () => router.back(),
      onError: (error) => showError('Não foi possível cancelar', errorMessage(error)),
    });
  };

  const review = data.review;

  return (
    <>
      <PageHeader
        title="Compra"
        subtitle={data.card.name}
        onBack={created ? () => router.navigate('/') : undefined}
        right={
          data.canEdit ? (
            <IconButton icon={Pencil} accessibilityLabel="Editar compra" onPress={() => router.push(`/purchase/edit/${purchaseId}`)} />
          ) : null
        }
      />
      <Screen refreshing={purchase.isRefetching} onRefresh={() => purchase.refetch()}>
        {created ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.success}>
            <CircleCheck size={22} color={colors.success} />
            <AppText variant="bodyStrong" color="success">
              Compra registrada!
            </AppText>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(250)}>
          <Surface elevation="md" style={styles.hero}>
            <CategoryIcon icon={data.category?.icon} color={data.category?.color} size={56} />
            <AppText variant="h2" align="center">
              {p.merchant}
            </AppText>
            {p.statementName ? (
              <AppText variant="caption" color="textMuted" align="center">
                Na fatura: {p.statementName}
              </AppText>
            ) : null}
            <AppText variant="moneyLarge" color={cancelled ? 'textMuted' : 'brand'} style={cancelled && styles.strike}>
              {formatBRL(p.totalCents)}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {formatDate(p.date)} · {data.category?.name ?? 'Sem categoria'}
              {p.installmentCount > 1 ? ` · ${p.installmentCount}x de ${formatBRL(amounts[amounts.length - 1])}` : ''}
            </AppText>
            {cancelled ? (
              <AppText variant="caption" color="danger">
                Compra cancelada
              </AppText>
            ) : null}
          </Surface>
        </Animated.View>

        {review && !cancelled ? (
          <Surface style={styles.review}>
            <View style={styles.reviewHeader}>
              <AppText variant="bodyStrong" style={styles.flex}>
                Conferência
              </AppText>
              <ReviewBadge review={review} />
            </View>
            {review.awaitingMe ? (
              <>
                <AppText variant="caption" color="textSecondary">
                  Você reconhece esta compra e a sua parte nela?
                </AppText>
                <View style={styles.reviewActions}>
                  <Button
                    label="Contestar"
                    icon={X}
                    variant="secondary"
                    fullWidth={false}
                    style={styles.flexButton}
                    onPress={() => router.push(`/review/dispute?invoiceId=${review.invoiceId}&purchaseId=${purchaseId}`)}
                  />
                  <Button
                    label="Reconheço"
                    icon={ThumbsUp}
                    fullWidth={false}
                    style={styles.flexButton}
                    loading={confirmPurchase.isPending}
                    onPress={() =>
                      confirmPurchase.mutate(
                        { invoiceId: review.invoiceId, purchaseId },
                        { onError: (error) => showError('Não foi possível confirmar', errorMessage(error)) },
                      )
                    }
                  />
                </View>
              </>
            ) : review.myReview?.status === 'confirmed' ? (
              <Button
                label="Mudei de ideia, contestar"
                variant="ghost"
                onPress={() => router.push(`/review/dispute?invoiceId=${review.invoiceId}&purchaseId=${purchaseId}`)}
              />
            ) : null}
          </Surface>
        ) : null}

        {data.disputes.length > 0 ? (
          <View>
            <SectionHeader title="Contestações" />
            <DisputeList
              disputes={data.disputes}
              canResolve={data.canManage}
              onResolve={(dispute) => router.push(`/review/resolve?purchaseId=${purchaseId}&reviewId=${dispute.review.id}`)}
            />
          </View>
        ) : null}

        <View>
          <SectionHeader title="Quem comprou e quem paga" />
          <Surface padded={false} style={styles.list}>
            <ListRow title={data.buyer.displayName} subtitle="Comprou" leading={<ShoppingBag size={20} color={colors.primary} />} />
            {data.shares.map((share) => (
              <View key={share.member.id}>
                <Divider inset={spacing.lg + 32} />
                <ListRow
                  title={share.member.displayName}
                  subtitle={
                    p.installmentCount > 1
                      ? `Paga ${Math.round((share.amountCents / p.totalCents) * 100)}% · total ${formatBRL(share.amountCents)}`
                      : `Paga ${Math.round((share.amountCents / p.totalCents) * 100)}%`
                  }
                  leading={<Avatar name={share.member.displayName} color={share.member.avatarColor} photo={share.member.photo} size={32} />}
                  trailing={
                    p.installmentCount > 1 ? (
                      <View style={styles.perInstallment}>
                        <AppText variant="money">{formatBRL(Math.floor(share.amountCents / p.installmentCount))}</AppText>
                        <AppText variant="small" color="textMuted">
                          por parcela
                        </AppText>
                      </View>
                    ) : (
                      <AppText variant="money">{formatBRL(share.amountCents)}</AppText>
                    )
                  }
                />
              </View>
            ))}
          </Surface>
        </View>

        {progress ? (
          <View>
            <SectionHeader title="Parcelamento" />
            <Surface style={styles.installments}>
              <AppText variant="bodyStrong">
                Parcela {progress.current} de {progress.count}
              </AppText>
              <ProgressBar progress={progress.current / progress.count} color={colors.primary} />
              <AppText variant="caption" color="textSecondary">
                {progress.remainingCount === 0
                  ? 'Última parcela'
                  : `Restam ${progress.remainingCount} parcelas · ${formatBRL(progress.remainingCents)}`}
              </AppText>
              <Divider />
              {data.installments.map(({ installment, invoice }) => (
                <ListRow
                  key={installment.id}
                  title={`${installment.number}/${installment.count} · ${formatRef(invoice.ref, { capitalize: true })}`}
                  subtitle={`${formatBRL(installment.amountCents)} · vence ${formatShortDate(invoice.dueDate)}`}
                  trailing={<InvoiceStatusBadge status={invoice.status} />}
                  onPress={() => router.push(`/invoice/${invoice.id}`)}
                />
              ))}
            </Surface>
          </View>
        ) : data.installments[0] ? (
          <Surface
            onPress={() => router.push(`/invoice/${data.installments[0].invoice.id}`)}
            style={styles.invoiceLink}
            accessibilityLabel="Abrir fatura">
            <AppText variant="bodyStrong" style={styles.flex}>
              Fatura {formatRef(data.installments[0].invoice.ref, { capitalize: true })}
            </AppText>
            <InvoiceStatusBadge status={data.installments[0].invoice.status} />
          </Surface>
        ) : null}

        {p.note ? (
          <Surface>
            <AppText variant="caption" color="textSecondary">
              Observação
            </AppText>
            <AppText variant="body">{p.note}</AppText>
          </Surface>
        ) : null}

        <AttachmentsSection
          purchaseId={purchaseId}
          attachments={data.attachments}
          canAdd={!cancelled}
          canRemove={(attachment) => data.canManage || attachment.createdBy === data.me.userId}
        />

        <View>
          <SectionHeader title="Histórico de alterações" />
          <Surface style={styles.history}>
            {data.history.map((log) => (
              <View key={log.id} style={styles.log}>
                <View style={styles.logIcon}>
                  <History size={14} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{log.summary}</AppText>
                  {log.changes.map((change) => (
                    <AppText key={change.field} variant="caption" color="textSecondary">
                      {change.field}: {change.from ?? '—'} → {change.to ?? '—'}
                    </AppText>
                  ))}
                  <View style={styles.logMeta}>
                    <UserRound size={12} color={colors.textMuted} />
                    <AppText variant="small" color="textMuted">
                      {log.actorName} · {formatDateTime(log.at)}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </Surface>
        </View>

        {data.canEdit ? (
          <Button label="Cancelar compra" icon={Trash2} variant="danger" onPress={confirmCancel} loading={cancel.isPending} />
        ) : null}
      </Screen>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xxl },
  strike: { textDecorationLine: 'line-through' },
  list: { paddingHorizontal: spacing.lg },
  installments: { gap: spacing.sm },
  invoiceLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  review: { gap: spacing.md },
  perInstallment: { alignItems: 'flex-end' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewActions: { flexDirection: 'row', gap: spacing.sm },
  flexButton: { flex: 1 },
  history: { gap: spacing.lg },
  log: { flexDirection: 'row', gap: spacing.md },
  logIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
}));
