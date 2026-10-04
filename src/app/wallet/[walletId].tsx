import { router, useLocalSearchParams } from 'expo-router';
import { CreditCard, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { CreditCardView, InvoiceStatusBadge } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, EmptyState, ErrorState, ListRow, LoadingState, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { formatBRL, sumCents } from '@/domain';
import { useWallet } from '@/features/wallets/hooks';
import { cardThemes, makeStyles, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/dates';

export default function WalletScreen() {
  const styles = useStyles();
  const { walletId } = useLocalSearchParams<{ walletId: string }>();
  const wallet = useWallet(walletId);

  if (wallet.isLoading) return <LoadingState />;
  if (wallet.error || !wallet.data) return <ErrorState message={errorMessage(wallet.error)} onRetry={() => wallet.refetch()} />;

  const { cards } = wallet.data;
  const total = sumCents(cards.map((c) => c.totals.totalCents));

  return (
    <>
      <PageHeader title={wallet.data.wallet.name} subtitle={`${formatBRL(total)} nas faturas atuais`} />
      <Screen padded={false} refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()}>
        {cards.length === 0 ? (
          <View style={styles.padded}>
            <Surface>
              <EmptyState
                icon={CreditCard}
                title="Nenhum cartão nesta carteira"
                description="Cadastre o cartão compartilhado. Nunca pedimos número, CVV ou senha."
                actionLabel="Adicionar cartão"
                onAction={() => router.push(`/card/new?walletId=${walletId}`)}
              />
            </Surface>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={292}
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}>
              {cards.map(({ card, holder, totals }) => (
                <CreditCardView
                  key={card.id}
                  card={card}
                  holderName={holder.displayName}
                  amountCents={totals.totalCents}
                  onPress={() => router.push(`/card/${card.id}`)}
                />
              ))}
            </ScrollView>

            <View style={styles.padded}>
              <SectionHeader title="Cartões" />
              <Surface padded={false} style={styles.list}>
                {cards.map(({ card, holder, totals, currentInvoice }, index) => (
                  <View key={card.id}>
                    {index > 0 && <Divider inset={spacing.lg + 48} />}
                    <ListRow
                      title={card.name}
                      subtitle={`${formatBRL(totals.totalCents)} na fatura · Titular: ${holder.displayName}${currentInvoice ? ` · vence ${formatShortDate(currentInvoice.dueDate)}` : ''}`}
                      leading={<View style={[styles.swatch, { backgroundColor: cardThemes[card.theme].colors[0] }]} />}
                      trailing={currentInvoice ? <InvoiceStatusBadge status={currentInvoice.status} /> : null}
                      onPress={() => router.push(`/card/${card.id}`)}
                    />
                  </View>
                ))}
              </Surface>
            </View>
          </>
        )}
        <View style={styles.padded}>
          <Button label="Adicionar cartão" icon={Plus} variant="secondary" onPress={() => router.push(`/card/new?walletId=${walletId}`)} />
          <AppText variant="small" color="textMuted" align="center" style={styles.note}>
            O Wallit não guarda número, CVV ou senha do cartão.
          </AppText>
        </View>
      </Screen>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  carousel: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md },
  padded: { paddingHorizontal: spacing.xl, gap: spacing.md },
  list: { paddingHorizontal: spacing.lg },
  swatch: { width: 36, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  note: { marginTop: spacing.sm },
}));
