import { router } from 'expo-router';
import { useEffect } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  HandCoins,
  Layers,
  SearchCheck,
  UsersRound,
  Wallet,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { MoneyText } from '@/components/finance';
import { GradientHeader, Screen } from '@/components/layout';
import { AppText, Avatar, EmptyState, ErrorState, IconButton, LoadingState, PressableScale, Surface } from '@/components/ui';
import { errorMessage } from '@/data';

import { useCurrentUser } from '@/features/auth/hooks';
import { useCurrentFamily } from '@/features/families/hooks';
import { useHomeSummary } from '@/features/home/hooks';
import { RecentPurchases } from '@/features/home/RecentPurchases';
import { useUnreadCount } from '@/features/notifications/hooks';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { usePreferencesStore } from '@/stores/preferences-store';
import { fontFamily, makeStyles, radius, spacing, useTheme } from '@/theme';
import { formatLongDate } from '@/utils/dates';
import { updateWidget } from '@/widget/sync';

export default function HomeScreen() {
  const formatBRL = useMoneyFormatter();
  const { colors } = useTheme();
  const styles = useStyles();
  const user = useCurrentUser();
  const { current, isLoading: loadingFamilies } = useCurrentFamily();
  const home = useHomeSummary(current?.family.id);
  const unread = useUnreadCount();
  const unreadCount = unread.data ?? 0;
  const firstName = user?.name.split(' ')[0] ?? '';
  const hideValues = usePreferencesStore((state) => state.hideValues);
  const familyName = current?.family.name ?? null;

  // The Android widget shows the same numbers as this screen.
  useEffect(() => {
    if (familyName && home.data) updateWidget(familyName, home.data, hideValues).catch(() => undefined);
  }, [familyName, home.data, hideValues]);

  const header = (
    <GradientHeader overlap={current && home.data ? <OwedCard summary={home.data} /> : undefined}>
      <View style={styles.topRow}>
        <PressableScale onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Abrir seu perfil">
          <Avatar
            name={user?.name ?? '?'}
            color={user?.avatarColor ?? colors.primary}
            photo={user?.photo}
            size={44}
            ringColor={colors.headerText}
          />
        </PressableScale>
        <View style={styles.greeting}>
          <AppText variant="h2" color="headerText">
            Olá, {firstName}!
          </AppText>
          {current ? (
            <PressableScale
              onPress={() => router.navigate('/families')}
              accessibilityLabel={`Família atual: ${current.family.name}. Trocar família`}
              style={styles.familyPill}>
              <AppText variant="caption" color="headerText" numberOfLines={1}>
                {current.family.name}
              </AppText>
              <ChevronDown size={14} color={colors.headerText} />
            </PressableScale>
          ) : null}
        </View>
        <View>
          <IconButton
            icon={Bell}
            tone="glass"
            accessibilityLabel={unreadCount > 0 ? `Notificações, ${unreadCount} novas` : 'Notificações'}
            onPress={() => router.push('/notifications')}
          />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge} pointerEvents="none">
              <AppText variant="small" color="textOnDark" style={styles.bold}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </GradientHeader>
  );

  if (loadingFamilies) return <LoadingState />;

  if (!current) {
    return (
      <Screen header={header} withTabBar>
        <EmptyState
          icon={UsersRound}
          title="Crie sua primeira família"
          description="Uma família é o grupo que divide o cartão: sua casa, amigos, uma viagem…"
          actionLabel="Criar família"
          onAction={() => router.push('/family/new')}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} withTabBar refreshing={home.isRefetching} onRefresh={() => home.refetch()}>
      {home.isLoading ? (
        <LoadingState />
      ) : home.error ? (
        <ErrorState message={errorMessage(home.error)} onRetry={() => home.refetch()} />
      ) : home.data ? (
        <>
          <View style={styles.tiles}>
            <Tile
              icon={CalendarClock}
              tint={colors.primary}
              title="Próximo vencimento"
              value={home.data.nextDue ? formatLongDate(home.data.nextDue.date) : 'Nenhum'}
              caption={home.data.nextDue?.cardName}
              onPress={home.data.nextDue ? () => router.push(`/invoice/${home.data!.nextDue!.invoiceId}`) : undefined}
            />
            <Tile
              icon={Layers}
              tint={colors.accent}
              title="Suas parcelas"
              value={`${home.data.activeInstallments.count} ${home.data.activeInstallments.count === 1 ? 'compra' : 'compras'}`}
              caption={`${formatBRL(home.data.activeInstallments.remainingCents)} da sua parte a vencer`}
              onPress={() => router.push('/history?installments=1')}
            />
          </View>

          {home.data.toReview.count > 0 && home.data.toReview.invoiceId ? (
            <ActionCard
              icon={SearchCheck}
              tint={colors.warning}
              background={colors.warningSoft}
              title={home.data.toReview.count === 1 ? '1 compra para conferir' : `${home.data.toReview.count} compras para conferir`}
              caption="Confirme se reconhece suas compras da fatura"
              onPress={() => router.push(`/invoice/${home.data!.toReview.invoiceId}`)}
            />
          ) : null}

          {home.data.paymentsToConfirm.count > 0 && home.data.paymentsToConfirm.invoiceId ? (
            <ActionCard
              icon={Wallet}
              tint={colors.success}
              background={colors.successSoft}
              title={
                home.data.paymentsToConfirm.count === 1
                  ? '1 pagamento para confirmar'
                  : `${home.data.paymentsToConfirm.count} pagamentos para confirmar`
              }
              caption="Veja se o PIX caiu e confirme"
              onPress={() => router.push(`/invoice/${home.data!.paymentsToConfirm.invoiceId}`)}
            />
          ) : null}

          {home.data.toReceiveCents > 0 ? (
            <Surface onPress={() => router.navigate('/invoices')} style={styles.receive} accessibilityLabel="Valores a receber">
              <View style={[styles.tileIcon, { backgroundColor: colors.successSoft }]}>
                <HandCoins size={20} color={colors.success} />
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  Você tem a receber como titular
                </AppText>
                <MoneyText value={home.data.toReceiveCents} color="success" />
              </View>
              <ArrowRight size={18} color={colors.textMuted} />
            </Surface>
          ) : null}

          <ActionCard
            icon={ChartColumn}
            tint={colors.primary}
            background={colors.primarySoft}
            title="Estatísticas"
            caption="Para onde vai o dinheiro da família"
            onPress={() => router.push('/statistics')}
          />

          <ActionCard
            icon={FileText}
            tint={colors.accent}
            background={colors.primarySoft}
            title="Relatório do mês"
            caption="PDF ou planilha para mandar no grupo"
            onPress={() => router.push('/report')}
          />

          <RecentPurchases familyId={current.family.id} meId={home.data.me.id} />
        </>
      ) : null}
    </Screen>
  );
}

function OwedCard({ summary }: { summary: NonNullable<ReturnType<typeof useHomeSummary>['data']> }) {
  const formatBRL = useMoneyFormatter();
  const styles = useStyles();
  const settled = summary.owedCents === 0;
  return (
    <Surface elevation="md" style={styles.owed}>
      <View style={styles.owedHeader}>
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          {settled ? 'Você está em dia' : 'Você deve'}
        </AppText>
        <HideValuesButton />
      </View>
      <MoneyText value={summary.owedCents} variant="moneyLarge" color={settled ? 'success' : 'brand'} />
      <View style={styles.owedFooter}>
        <AppText variant="caption" color="textSecondary">
          Sua parte nas faturas atuais:{' '}
          <AppText variant="caption" color="text" style={styles.bold}>
            {formatBRL(summary.myCurrentShareCents)}
          </AppText>
        </AppText>
      </View>
    </Surface>
  );
}

/** Eye icon: hides every amount in the app until tapped again. */
function HideValuesButton() {
  const { colors } = useTheme();
  const hidden = usePreferencesStore((state) => state.hideValues);
  const toggle = usePreferencesStore((state) => state.toggleHideValues);
  const Icon = hidden ? EyeOff : Eye;
  return (
    <PressableScale
      onPress={toggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}>
      <Icon size={20} color={colors.textSecondary} />
    </PressableScale>
  );
}

interface ActionCardProps {
  icon: typeof CalendarClock;
  tint: string;
  background: string;
  title: string;
  caption: string;
  onPress: () => void;
}

function ActionCard({ icon: Icon, tint, background, title, caption, onPress }: ActionCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Surface onPress={onPress} style={styles.receive} accessibilityLabel={title}>
      <View style={[styles.tileIcon, styles.noMargin, { backgroundColor: background }]}>
        <Icon size={20} color={tint} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {caption}
        </AppText>
      </View>
      <ArrowRight size={18} color={colors.textMuted} />
    </Surface>
  );
}

interface TileProps {
  icon: typeof CalendarClock;
  tint: string;
  title: string;
  value: string;
  caption?: string;
  onPress?: () => void;
}

function Tile({ icon: Icon, tint, title, value, caption, onPress }: TileProps) {
  const styles = useStyles();
  return (
    <Surface onPress={onPress} style={styles.tile} accessibilityLabel={`${title}: ${value}`}>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1A` }]}>
        <Icon size={18} color={tint} />
      </View>
      <AppText variant="small" color="textSecondary">
        {title}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {value}
      </AppText>
      {caption ? (
        <AppText variant="small" color="textMuted" numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </Surface>
  );
}

const useStyles = makeStyles((colors) => ({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { flex: 1, gap: 2 },
  familyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.headerGlass,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  owed: { gap: spacing.xs },
  owedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  owedFooter: { marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bold: { fontFamily: fontFamily.bold },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: 4 },
  tileIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  receive: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  noMargin: { marginBottom: 0 },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.headerText,
  },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.xs },
  rowPad: { paddingHorizontal: spacing.lg },
  emptyList: { padding: spacing.lg },
}));
