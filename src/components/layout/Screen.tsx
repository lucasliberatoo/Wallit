import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

export interface ScreenProps extends ScrollViewProps {
  /** Extra space at the bottom so content clears the tab bar. */
  withTabBar?: boolean;
  padded?: boolean;
  header?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
}

/** Scrollable page with brand background, safe areas and pull-to-refresh. */
export function Screen({
  children,
  withTabBar = false,
  padded = true,
  header,
  refreshing = false,
  onRefresh,
  footer,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = (withTabBar ? layout.tabBarHeight + spacing.xxl : spacing.xxl) + insets.bottom;

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        contentContainerStyle={[{ paddingBottom: bottom }, contentContainerStyle]}
        {...rest}>
        {header}
        <View style={[styles.content, padded && styles.padded]}>{children}</View>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: spacing.xxl },
  padded: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
