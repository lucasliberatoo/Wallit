import { router } from 'expo-router';
import { Check, KeyRound, Plus, UsersRound } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { GradientHeader, Screen } from '@/components/layout';
import { AppText, Button, ErrorState, LoadingState, PressableScale } from '@/components/ui';
import { errorMessage, type FamilySummary } from '@/data';
import { ROLE_LABEL } from '@/domain';
import { useCurrentFamily, useFamilies } from '@/features/families/hooks';
import { colors, layout, radius, shadows, spacing } from '@/theme';

export default function FamiliesScreen() {
  const { current, select } = useCurrentFamily();
  const families = useFamilies();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, layout.maxContentWidth) - layout.screenPadding * 2;
  const tileWidth = (contentWidth - spacing.md) / 2;

  const open = (item: FamilySummary) => {
    select(item.family.id);
    router.push(`/family/${item.family.id}`);
  };

  return (
    <Screen
      withTabBar
      refreshing={families.isRefetching}
      onRefresh={() => families.refetch()}
      header={
        <GradientHeader>
          <AppText variant="h1" color="brand">
            Suas famílias
          </AppText>
          <AppText variant="body" color="brand">
            Cada família tem suas carteiras, cartões e faturas separados.
          </AppText>
        </GradientHeader>
      }>
      {families.isLoading ? (
        <LoadingState />
      ) : families.error ? (
        <ErrorState message={errorMessage(families.error)} onRetry={() => families.refetch()} />
      ) : (
        <View style={styles.grid}>
          {families.data?.map((item) => {
            const selected = item.family.id === current?.family.id;
            return (
              <PressableScale
                key={item.family.id}
                onPress={() => open(item)}
                accessibilityLabel={`${item.family.name}, ${item.memberCount} membros${selected ? ', selecionada' : ''}`}
                style={[styles.tile, { width: tileWidth, backgroundColor: item.family.color }]}>
                <View style={styles.tileTop}>
                  <UsersRound size={20} color={colors.textOnDark} />
                  {selected ? (
                    <View style={styles.check}>
                      <Check size={14} color={item.family.color} strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
                <View>
                  <AppText variant="h3" color="textOnDark" numberOfLines={2}>
                    {item.family.name}
                  </AppText>
                  <AppText variant="small" color="textOnDarkSecondary">
                    {item.memberCount} {item.memberCount === 1 ? 'membro' : 'membros'} · {ROLE_LABEL[item.me.role]}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
          <PressableScale onPress={() => router.push('/family/new')} accessibilityLabel="Criar nova família" style={[styles.tile, styles.newTile, { width: tileWidth }]}>
            <View style={styles.plus}>
              <Plus size={26} color={colors.textOnDark} strokeWidth={2.6} />
            </View>
            <AppText variant="bodyStrong" align="center">
              Criar nova família
            </AppText>
          </PressableScale>
        </View>
      )}
      <Button label="Entrar com código de convite" icon={KeyRound} variant="secondary" onPress={() => router.push('/family/join')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { height: 132, borderRadius: radius.xl, padding: spacing.lg, justifyContent: 'space-between', ...shadows.sm },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  check: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  newTile: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, shadowOpacity: 0, elevation: 0 },
  plus: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
