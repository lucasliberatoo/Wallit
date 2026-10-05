import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PurchaseRow } from '@/components/finance';
import { AppText, Chip, Divider, LoadingState, SectionHeader, Surface } from '@/components/ui';
import type { HistoryFilters } from '@/data';
import { usePurchaseSearch } from '@/features/purchases/hooks';
import { type HomePurchaseScope, usePreferencesStore } from '@/stores/preferences-store';
import { layout, makeStyles, spacing } from '@/theme';
import { formatDayMonth } from '@/utils/dates';

const SCOPES: { value: HomePurchaseScope; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Minhas' },
  { value: 'bought', label: 'Que eu comprei' },
  { value: 'installments', label: 'Parceladas' },
];

const EMPTY: Record<HomePurchaseScope, string> = {
  all: 'Nenhuma compra ainda. Toque no + para registrar a primeira.',
  mine: 'Nenhuma compra em que você paga uma parte.',
  bought: 'Você ainda não registrou compras feitas por você.',
  installments: 'Nenhuma compra parcelada.',
};

const LIMIT = 5;

function filtersFor(scope: HomePurchaseScope, meId: string): HistoryFilters {
  switch (scope) {
    case 'all':
      return {};
    case 'mine':
      return { memberId: meId };
    case 'bought':
      return { buyerMemberId: meId };
    case 'installments':
      return { onlyInstallments: true };
  }
}

/** "Últimas compras" with quick filters; the choice is remembered on this device. */
export function RecentPurchases({ familyId, meId }: { familyId: string; meId: string }) {
  const styles = useStyles();
  const scope = usePreferencesStore((state) => state.homeScope);
  const setScope = usePreferencesStore((state) => state.setHomeScope);
  const purchases = usePurchaseSearch(familyId, filtersFor(scope, meId));
  const items = (purchases.data ?? []).slice(0, LIMIT);

  return (
    <View>
      <SectionHeader title="Últimas compras" actionLabel="Ver histórico" onAction={() => router.push('/history')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
        {SCOPES.map((option) => (
          <Chip key={option.value} label={option.label} selected={scope === option.value} onPress={() => setScope(option.value)} />
        ))}
      </ScrollView>
      <Surface padded={false} style={styles.list}>
        {purchases.isLoading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <AppText variant="body" color="textSecondary" style={styles.empty}>
            {EMPTY[scope]}
          </AppText>
        ) : (
          items.map((item, index) => (
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
                  dateLabel={
                    item.purchase.installmentCount > 1
                      ? `${formatDayMonth(item.purchase.date)} · ${item.purchase.installmentCount}x`
                      : formatDayMonth(item.purchase.date)
                  }
                  onPress={() => router.push(`/purchase/${item.purchase.id}`)}
                />
              </View>
            </View>
          ))
        )}
      </Surface>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  chipsWrap: { marginBottom: spacing.sm, marginHorizontal: -layout.screenPadding },
  chips: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  list: { paddingVertical: spacing.xs },
  rowPad: { paddingHorizontal: spacing.lg },
  empty: { padding: spacing.lg },
}));
