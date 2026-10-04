import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatBRL } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';

export interface BreakdownItem {
  id: string;
  label: string;
  leading: ReactNode;
  totalCents: number;
  share: number;
}

/** Ranked horizontal bars: label and value in text ink, the bar only carries magnitude. */
export function BreakdownBars({ items }: { items: BreakdownItem[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const max = Math.max(...items.map((item) => item.totalCents), 1);
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View
          key={item.id}
          style={styles.item}
          accessible
          accessibilityLabel={`${item.label}: ${formatBRL(item.totalCents)}, ${Math.round(item.share * 100)}%`}>
          {item.leading}
          <View style={styles.body}>
            <View style={styles.labels}>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {item.label}
              </AppText>
              <AppText variant="money">{formatBRL(item.totalCents)}</AppText>
            </View>
            <View style={styles.trackRow}>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.max(2, (item.totalCents / max) * 100)}%`, backgroundColor: colors.primary }]} />
              </View>
              <AppText variant="small" color="textSecondary" style={styles.percent}>
                {Math.round(item.share * 100)}%
              </AppText>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
  labels: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  percent: { width: 34, textAlign: 'right' },
}));
