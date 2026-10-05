import { ChartColumn, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { CategoryIcon } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Chip, EmptyState, ErrorState, LoadingState, SectionHeader, Surface } from '@/components/ui';
import { errorMessage, type StatisticsFilters } from '@/data';
import { addMonths, formatRef, type InvoiceRef } from '@/domain';
import { useCurrentFamily } from '@/features/families/hooks';
import { BreakdownBars } from '@/features/statistics/components/BreakdownBars';
import { MonthlyBars } from '@/features/statistics/components/MonthlyBars';
import { useStatistics } from '@/features/statistics/hooks';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { cardThemes, makeStyles, spacing, useTheme } from '@/theme';

const PERIODS = [3, 6, 12] as const;

function currentRef(): InvoiceRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function StatisticsScreen() {
  const formatBRL = useMoneyFormatter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { current } = useCurrentFamily();
  const familyId = current?.family.id;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(6);
  const [cardId, setCardId] = useState<string | undefined>();
  const [memberId, setMemberId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const filters = useMemo<StatisticsFilters>(() => {
    const to = currentRef();
    return { from: addMonths(to, -(period - 1)), to, cardId, memberId, categoryId };
  }, [period, cardId, memberId, categoryId]);
  const stats = useStatistics(familyId, filters);
  const data = stats.data;

  const categoryById = new Map(data?.categories.map((c) => [c.id, c]));
  const memberById = new Map(data?.members.map((m) => [m.id, m]));
  const cardById = new Map(data?.cards.map((c) => [c.id, c]));
  const change = data?.lastMonthChange ?? null;

  return (
    <>
      <PageHeader title="Estatísticas" subtitle={current?.family.name} />
      <Screen refreshing={stats.isRefetching && !stats.isPlaceholderData} onRefresh={() => stats.refetch()}>
        <View style={styles.filters}>
          <View style={styles.row}>
            {PERIODS.map((months) => (
              <Chip key={months} label={`${months} meses`} selected={period === months} onPress={() => setPeriod(months)} />
            ))}
          </View>
          {data && data.cards.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="Todos os cartões" selected={!cardId} onPress={() => setCardId(undefined)} />
              {data.cards.map((card) => (
                <Chip key={card.id} label={card.name} selected={cardId === card.id} onPress={() => setCardId(card.id)} />
              ))}
            </ScrollView>
          ) : null}
          {data ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="Todas as pessoas" selected={!memberId} onPress={() => setMemberId(undefined)} />
              {data.members
                .filter((m) => m.status === 'active')
                .map((member) => (
                  <Chip
                    key={member.id}
                    label={member.displayName}
                    selected={memberId === member.id}
                    onPress={() => setMemberId(member.id)}
                  />
                ))}
            </ScrollView>
          ) : null}
          {data ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="Todas as categorias" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
              {data.categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={categoryId === category.id}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        {stats.isLoading ? (
          <LoadingState />
        ) : stats.error || !data ? (
          <ErrorState message={errorMessage(stats.error)} onRetry={() => stats.refetch()} />
        ) : data.totalCents === 0 ? (
          <Surface>
            <EmptyState icon={ChartColumn} title="Sem gastos no período" description="Mude o período ou os filtros." />
          </Surface>
        ) : (
          <>
            <View style={styles.kpis}>
              <Kpi
                label={`Total de ${formatRef(filters.from)} a ${formatRef(filters.to)}`}
                value={formatBRL(data.totalCents)}
                caption={`${data.purchaseCount} ${data.purchaseCount === 1 ? 'compra' : 'compras'}`}
              />
              <Kpi label="Média por mês" value={formatBRL(data.averageMonthCents)} />
              <Kpi
                label="Último mês"
                value={change === null ? '—' : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`}
                caption="vs. mês anterior"
                icon={change === null || change === 0 ? undefined : change > 0 ? TrendingUp : TrendingDown}
              />
              <Kpi label="Parcelas a vencer" value={formatBRL(data.futureInstallmentsCents)} caption="depois deste mês" />
            </View>

            <View>
              <SectionHeader title="Gastos por mês" />
              <Surface>
                <MonthlyBars key={data.months.length} months={data.months} />
              </Surface>
            </View>

            {!categoryId ? (
              <View>
                <SectionHeader title="Por categoria" />
                <Surface>
                  <BreakdownBars
                    items={data.byCategory.map((item) => {
                      const category = categoryById.get(item.id);
                      return {
                        ...item,
                        label: category?.name ?? 'Sem categoria',
                        leading: <CategoryIcon icon={category?.icon} color={category?.color} size={36} />,
                      };
                    })}
                  />
                </Surface>
              </View>
            ) : null}

            {!memberId ? (
              <View>
                <SectionHeader title="Por pessoa" />
                <Surface>
                  <BreakdownBars
                    items={data.byMember.map((item) => {
                      const member = memberById.get(item.id);
                      return {
                        ...item,
                        label: member?.displayName ?? 'Alguém',
                        leading: (
                          <Avatar
                            name={member?.displayName ?? '?'}
                            color={member?.avatarColor ?? colors.primary}
                            photo={member?.photo}
                            size={36}
                          />
                        ),
                      };
                    })}
                  />
                </Surface>
              </View>
            ) : null}

            {!cardId && data.byCard.length > 1 ? (
              <View>
                <SectionHeader title="Por cartão" />
                <Surface>
                  <BreakdownBars
                    items={data.byCard.map((item) => {
                      const card = cardById.get(item.id);
                      const theme = card ? cardThemes[card.theme] : undefined;
                      return {
                        ...item,
                        label: card?.name ?? 'Cartão',
                        leading: <View style={[styles.cardChip, { backgroundColor: theme?.colors[0] ?? colors.primary }]} />,
                      };
                    })}
                  />
                </Surface>
              </View>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

function Kpi({ label, value, caption, icon: Icon }: { label: string; value: string; caption?: string; icon?: typeof TrendingUp }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Surface style={styles.kpi}>
      <AppText variant="small" color="textSecondary" numberOfLines={2}>
        {label}
      </AppText>
      <View style={styles.kpiValue}>
        {Icon ? <Icon size={16} color={colors.textSecondary} /> : null}
        <AppText variant="money" numberOfLines={1}>
          {value}
        </AppText>
      </View>
      {caption ? (
        <AppText variant="small" color="textMuted" numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </Surface>
  );
}

const useStyles = makeStyles(() => ({
  filters: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { flexBasis: '46%', flexGrow: 1, gap: 4 },
  kpiValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardChip: { width: 36, height: 24, borderRadius: 4 },
}));
