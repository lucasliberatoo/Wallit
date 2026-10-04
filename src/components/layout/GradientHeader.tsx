import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gradients, layout, spacing } from '@/theme';

export interface GradientHeaderProps {
  children: React.ReactNode;
  variant?: keyof typeof gradients;
  /** Content that overlaps the bottom edge (e.g. a summary card). */
  overlap?: React.ReactNode;
}

/** Brand header with yellow-orange (or blue) gradient and rounded bottom. */
export function GradientHeader({ children, variant = 'sunrise', overlap }: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <LinearGradient
        colors={gradients[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing.lg, paddingBottom: overlap ? spacing.huge + spacing.xxl : spacing.xxl }]}>
        <View style={styles.inner}>{children}</View>
      </LinearGradient>
      {overlap ? <View style={styles.overlap}>{overlap}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: layout.screenPadding,
    borderBottomLeftRadius: layout.headerCurve,
    borderBottomRightRadius: layout.headerCurve,
  },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: spacing.lg },
  overlap: {
    marginTop: -(spacing.huge + spacing.md),
    paddingHorizontal: layout.screenPadding,
    width: '100%',
    maxWidth: layout.maxContentWidth + layout.screenPadding * 2,
    alignSelf: 'center',
  },
});
