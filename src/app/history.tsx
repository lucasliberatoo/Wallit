import { router, useLocalSearchParams } from 'expo-router';
import { History as HistoryIcon, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PurchaseRow } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Chip, Divider, EmptyState, LoadingState, SegmentedControl, Surface, TextField } from '@/components/ui';
import type { HistoryFilters } from '@/data';
import { addMonths, formatBRL, monthName, sumCents } from '@/domain';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { useActivity } from '@/features/home/hooks';
import { usePurchaseSearch } from '@/features/purchases/hooks';
import { colors, radius, spacing } from '@/theme';
import { formatDateTime, formatDayMonth, todayISO } from '@/utils/dates';

type Tab = 'purchases' | 'activity';

function lastMonths(count: number) {
  const [year, month] = todayISO().split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const ref = addMonths({ year, month }, -index);
    const key = `${ref.year}-${String(ref.month).padStart(2, '0')}`;
    return { key, label: `${monthName(ref.month).slice(0, 3)}/${String(ref.year).slice(2)}`, from: `${key}-01`, to: `${key}-31` };
  });
}

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ tab?: Tab; installments?: string }>();
  const { current } = useCurrentFamily();
  const familyId = current?.family.id;
  const [tab, setTab] = useState<Tab>(params.tab === 'activity' ? 'activity' : 'purchases');
  const [search, setSearch] = useState('');
  const [cardId, setCardId] = useState<string>();
  const [memberId, setMemberId] = useState<string>();
  const [categoryId, setCategoryId] = useState<string>();
  const [month, setMonth] = useState<string>();
  const [onlyInstallments, setOnlyInstallments] = useState(params.installments === '1');
  const months = useMemo(() => lastMonths(6), []);
  const period = months.find((m) => m.key === month);

  const filters: HistoryFilters = { search: search || undefined, cardId, memberId, categoryId, from: period?.from, to: period?.to };
  const purchases = usePurchaseSearch(familyId, filters);
  const cards = useFamilyCards(familyId);
  const members = useMembers(familyId);
  const categories = useCategories(familyId);
  const activity = useActivity(tab === 'activity' ? familyId : undefined);

  const results = (purchases.data ?? []).filter((item) => !onlyInstallments || item.purchase.installmentCount > 1);
  const toggle = <T,>(value: T | undefined, next: T, set: (v: T | undefined) => void) => set(value === next ? undefined : next);

  return (
    <>
      <PageHeader title="Histórico" subtitle={current?.family.name} />
      <Screen>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'purchases', label: 'Compras' },
            { value: 'activity', label: 'Atividade' },
          ]}
        />

        {tab === 'purchases' ? (
          <View style={styles.section}>
            <TextField label="Buscar" placeholder="Estabelecimento, nome na fatura ou observação" value={search} onChangeText={setSearch} trailing={<Search size={18} color={colors.textMuted} />} />
            <FilterRow label="Período">
              {months.map((m) => (
                <Chip key={m.key} label={m.label} selected={month === m.key} onPress={() => toggle(month, m.key, setMonth)} />
              ))}
            </FilterRow>
            <FilterRow label="Cartão">
              {cards.data?.map(({ card }) => (
                <Chip key={card.id} label={card.name} selected={cardId === card.id} onPress={() => toggle(cardId, card.id, setCardId)} />
              ))}
              <Chip label="Só parceladas" selected={onlyInstallments} onPress={() => setOnlyInstallments((v) => !v)} />
            </FilterRow>
            <FilterRow label="Pessoa">
              {members.data?.map((member) => (
                <Chip key={member.id} label={member.displayName} selected={memberId === member.id} onPress={() => toggle(memberId, member.id, setMemberId)} />
              ))}
            </FilterRow>
            <FilterRow label="Categoria">
              {categories.data?.map((category) => (
                <Chip key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => toggle(categoryId, category.id, setCategoryId)} />
              ))}
            </FilterRow>

            {purchases.isLoading ? (
              <LoadingState />
            ) : results.length === 0 ? (
              <Surface>
                <EmptyState icon={Search} title="Nenhuma compra encontrada" description="Tente outros filtros." />
              </Surface>
            ) : (
              <>
                <AppText variant="caption" color="textSecondary">
                  {results.length} {results.length === 1 ? 'compra' : 'compras'} · {formatBRL(sumCents(results.map((r) => r.purchase.totalCents)))}
                </AppText>
                <Surface padded={false} style={styles.list}>
                  {results.map((item, index) => (
                    <View key={item.purchase.id}>
                      {index > 0 && <Divider inset={56} />}
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
                  ))}
                </Surface>
              </>
            )}
          </View>
        ) : activity.isLoading ? (
          <LoadingState />
        ) : (
          <Surface style={styles.activity}>
            {activity.data?.length === 0 ? <EmptyState icon={HistoryIcon} title="Nada por aqui ainda" /> : null}
            {activity.data?.map((log) => (
              <View key={log.id} style={styles.log}>
                <View style={styles.dot} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{log.summary}</AppText>
                  {log.changes.map((change) => (
                    <AppText key={change.field} variant="caption" color="textSecondary">
                      {change.field}: {change.from ?? '—'} → {change.to ?? '—'}
                    </AppText>
                  ))}
                  <AppText variant="small" color="textMuted">
                    {log.actorName} · {formatDateTime(log.at)}
                  </AppText>
                </View>
              </View>
            ))}
          </Surface>
        )}
      </Screen>
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filter}>
      <AppText variant="overline" color="textSecondary">
        {label}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  filter: { gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  list: { paddingHorizontal: spacing.lg },
  activity: { gap: spacing.lg },
  log: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary, marginTop: 6 },
  flex: { flex: 1, gap: 2 },
});
