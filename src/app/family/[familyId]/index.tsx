import { router, useLocalSearchParams } from 'expo-router';
import { History, LogOut, Plus, Shapes, UserPlus, WalletCards } from 'lucide-react-native';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { MemberChip, WalletFolder } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, EmptyState, ErrorState, ListRow, LoadingState, PressableScale, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { can, ROLE_LABEL, sumCents } from '@/domain';
import { useFamily, useLeaveFamily, useMembers } from '@/features/families/hooks';
import { useWallets } from '@/features/wallets/hooks';
import { colors, spacing } from '@/theme';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function FamilyScreen() {
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const family = useFamily(familyId);
  const members = useMembers(familyId);
  const wallets = useWallets(familyId);
  const leave = useLeaveFamily();

  if (family.isLoading) return <LoadingState />;
  if (family.error || !family.data) return <ErrorState message={errorMessage(family.error)} onRetry={() => family.refetch()} />;

  const { me } = family.data;
  const canManage = can(me.role, 'member.manage');
  const canCreateWallet = can(me.role, 'wallet.create');

  return (
    <>
      <PageHeader title={family.data.family.name} subtitle={`Você é ${ROLE_LABEL[me.role].toLowerCase()}`} />
      <Screen refreshing={wallets.isRefetching} onRefresh={() => Promise.all([wallets.refetch(), members.refetch()])}>
        <View>
          <SectionHeader title="Membros" actionLabel={canManage ? 'Gerenciar' : 'Ver todos'} onAction={() => router.push(`/family/${familyId}/members`)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.members}>
            {members.data?.map((member) => (
              <MemberChip key={member.id} member={member} caption={member.nickname ?? ROLE_LABEL[member.role]} isMe={member.id === me.id} />
            ))}
            {canManage ? (
              <View style={styles.addMember}>
                <PressableScale onPress={() => router.push(`/family/${familyId}/members`)} accessibilityLabel="Adicionar membro" style={styles.addButton}>
                  <UserPlus size={22} color={colors.primary} />
                </PressableScale>
                <AppText variant="caption" color="textSecondary">
                  Adicionar
                </AppText>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Carteiras" />
          {wallets.isLoading ? (
            <LoadingState />
          ) : wallets.data?.length === 0 ? (
            <Surface>
              <EmptyState
                icon={WalletCards}
                title="Nenhuma carteira ainda"
                description="Carteiras agrupam cartões, como “Carteira da Família”."
                actionLabel={canCreateWallet ? 'Criar carteira' : undefined}
                onAction={() => router.push(`/wallet/new?familyId=${familyId}`)}
              />
            </Surface>
          ) : (
            wallets.data?.map(({ wallet, cards }) => (
              <WalletFolder
                key={wallet.id}
                name={wallet.name}
                cards={cards.map((c) => c.card)}
                totalCents={sumCents(cards.map((c) => c.totals.totalCents))}
                onPress={() => router.push(`/wallet/${wallet.id}`)}
              />
            ))
          )}
          {canCreateWallet && wallets.data && wallets.data.length > 0 ? (
            <Button label="Nova carteira" icon={Plus} variant="ghost" onPress={() => router.push(`/wallet/new?familyId=${familyId}`)} />
          ) : null}
        </View>

        <Surface padded={false} style={styles.menu}>
          <ListRow title="Categorias" subtitle="Personalize ícones e cores" leading={<Shapes size={20} color={colors.primary} />} onPress={() => router.push('/categories')} />
          <Divider inset={spacing.lg + 32} />
          <ListRow title="Histórico" subtitle="Compras, faturas e alterações" leading={<History size={20} color={colors.primary} />} onPress={() => router.push('/history')} />
          <Divider inset={spacing.lg + 32} />
          <ListRow
            title="Sair da família"
            leading={<LogOut size={20} color={colors.danger} />}
            onPress={() =>
              confirm('Sair da família?', 'Você perde o acesso às faturas desta família. O histórico é mantido.', () =>
                leave.mutate(familyId, {
                  onSuccess: () => router.replace('/families'),
                  onError: (error) => Alert.alert('Não foi possível sair', errorMessage(error)),
                }),
              )
            }
          />
        </Surface>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  members: { gap: spacing.sm, paddingRight: spacing.lg },
  addMember: { alignItems: 'center', width: 72, gap: spacing.xxs },
  addButton: { width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  section: { gap: spacing.md },
  menu: { paddingHorizontal: spacing.lg },
});
