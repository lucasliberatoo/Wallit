import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { House, type LucideIcon, Plus, ReceiptText, UserRound, UsersRound } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, PressableScale } from '@/components/ui';
import { layout, makeStyles, radius, spacing, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Início', icon: House },
  families: { label: 'Famílias', icon: UsersRound },
  invoices: { label: 'Faturas', icon: ReceiptText },
  profile: { label: 'Perfil', icon: UserRound },
};

/** Bottom navigation with a highlighted central "+" that opens "Nova compra". */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, gradients } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          if (route.name === 'add') {
            return (
              <View key={route.key} style={styles.item}>
                <PressableScale
                  haptic
                  scaleTo={0.9}
                  onPress={() => router.push('/purchase/new')}
                  accessibilityLabel="Nova compra"
                  style={styles.fabShadow}>
                  <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
                    <Plus size={28} color={colors.textOnAccent} strokeWidth={2.8} />
                  </LinearGradient>
                </PressableScale>
              </View>
            );
          }
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const Icon = tab.icon;
          return (
            <PressableScale
              key={route.key}
              style={styles.item}
              scaleTo={0.92}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}>
              <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                <Icon size={22} color={focused ? colors.primary : colors.textMuted} strokeWidth={focused ? 2.5 : 2} />
              </View>
              <AppText variant="small" color={focused ? 'primary' : 'textMuted'}>
                {tab.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors, { shadows }) => ({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.tabBarHeight,
    backgroundColor: colors.tabBar,
    borderRadius: radius.xl,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...shadows.lg,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconPill: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
  iconPillActive: { backgroundColor: colors.primarySoft },
  fabShadow: { marginTop: -spacing.xxxl, borderRadius: radius.pill, ...shadows.lg },
  fab: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.tabBar,
  },
}));
