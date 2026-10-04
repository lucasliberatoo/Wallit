import { router } from 'expo-router';
import { ArrowRight, Bell, CalendarClock, ChevronDown, HandCoins, Layers, UsersRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { MoneyText, PurchaseRow } from '@/components/finance';
import { GradientHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Divider, EmptyState, ErrorState, IconButton, LoadingState, PressableScale, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { formatBRL } from '@/domain';
import { useCurrentUser } from '@/features/auth/hooks';
import { useCurrentFamily } from '@/features/families/hooks';
import { useHomeSummary } from '@/features/home/hooks';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { formatDayMonth, formatLongDate } from '@/utils/dates';

export default function HomeScreen() {
  const user = useCurrentUser();
  const { current, isLoading: loadingFamilies } = useCurrentFamily();
  const home = useHomeSummary(current?.family.id);
  const firstName = user?.name.split(' ')[0] ?? '';

  const header = (
    <GradientHeader overlap={current && home.data ? <OwedCard summary={home.data} /> : undefined}>
      <View style={styles.topRow}>
        <Avatar name={user?.name ?? '?'} color={user?.avatarColor ?? colors.primary} size={40} />
        <View style={styles.greeting}>
          <AppText variant="h2" color="brand">
            Olá, {firstName}!
          </AppText>
          {current ? (
            <PressableScale onPress={() => router.navigate('/families')} accessibilityLabel={`Família atual: ${current.family.name}. Trocar família`} style={styles.familyPill}>
              <AppText variant="caption" color="brand" numberOfLines={1}>
                {current.family.name}
              </AppText>
              <ChevronDown size={14} color={colors.brand} />
            </PressableScale>
          ) : null}
        </View>
        <IconButton icon={Bell} tone="glass" accessibilityLabel="Atividades recentes" onPress={() => router.push('/history?tab=activity')} />
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
              title="Parcelas ativas"
              value={`${home.data.activeInstallments.count} ${home.data.activeInstallments.count === 1 ? 'compra' : 'compras'}`}
              caption={`${formatBRL(home.data.activeInstallments.remainingCents)} a vencer`}
              onPress={() => router.push('/history?installments=1')}
            />
          </View>

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

          <View>
            <SectionHeader title="Últimas compras" actionLabel="Ver histórico" onAction={() => router.push('/history')} />
            <Surface padded={false} style={styles.list}>
              {home.data.recentPurchases.length === 0 ? (
                <AppText variant="body" color="textSecondary" style={styles.emptyList}>
                  Nenhuma compra ainda. Toque no + para registrar a primeira.
                </AppText>
              ) : (
                home.data.recentPurchases.map((item, index) => (
                  <View key={item.purchase.id}>
                    {index > 0 && <Divider inset={spacing.lg + 56} />}
                    <View style={styles.rowPad}>
                      <PurchaseRow
                        merchant={item.purchase.merchant}
                        statementName={item.purchase.statementName}
                        amountCents={item.purchase.totalCents}
                        category={item.category}
                        buyer={item.buyer}
                        payers={item.payers}
                        installment={item.purchase.installmentCount > 1 ? { number: 1, count: item.purchase.installmentCount } : undefined}
                        dateLabel={formatDayMonth(item.purchase.date)}
                        onPress={() => router.push(`/purchase/${item.purchase.id}`)}
                      />
                    </View>
                  </View>
                ))
              )}
            </Surface>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function OwedCard({ summary }: { summary: NonNullable<ReturnType<typeof useHomeSummary>['data']> }) {
  const settled = summary.owedCents === 0;
  return (
    <Surface elevation="md" style={styles.owed}>
      <AppText variant="caption" color="textSecondary">
        {settled ? 'Você está em dia' : 'Você deve'}
      </AppText>
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

interface TileProps {
  icon: typeof CalendarClock;
  tint: string;
  title: string;
  value: string;
  caption?: string;
  onPress?: () => void;
}

function Tile({ icon: Icon, tint, title, value, caption, onPress }: TileProps) {
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

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { flex: 1, gap: 2 },
  familyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  owed: { gap: spacing.xs },
  owedFooter: { marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bold: { fontFamily: fontFamily.bold },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: 4 },
  tileIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  receive: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  list: { paddingVertical: spacing.xs },
  rowPad: { paddingHorizontal: spacing.lg },
  emptyList: { padding: spacing.lg },
});
