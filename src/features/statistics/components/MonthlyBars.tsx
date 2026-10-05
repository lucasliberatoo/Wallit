import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { type MonthTotal, monthName, refKey } from '@/domain';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { makeStyles, spacing, useTheme } from '@/theme';

const CHART_HEIGHT = 140;

function shortMonth(month: number): string {
  return monthName(month).slice(0, 3);
}

/**
 * One series, one hue: a bar per invoice month. Tapping (or hovering on the
 * web) a month shows its value above the chart; the last month starts selected.
 */
export function MonthlyBars({ months }: { months: MonthTotal[] }) {
  const formatBRL = useMoneyFormatter();
  const { colors } = useTheme();
  const styles = useStyles();
  const [selected, setSelected] = useState(months.length - 1);

  const max = Math.max(...months.map((m) => m.totalCents), 1);
  const current = months[selected] ?? months[months.length - 1];
  const dense = months.length > 6;

  return (
    <View style={styles.wrapper}>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <AppText variant="caption" color="textSecondary">
          {current ? `${monthName(current.ref.month)[0].toUpperCase()}${monthName(current.ref.month).slice(1)}/${current.ref.year}` : ''}
        </AppText>
        <AppText variant="h3">{current ? formatBRL(current.totalCents) : '—'}</AppText>
      </View>
      <View style={styles.plot}>
        <View style={[styles.gridline, { top: 0 }]} />
        <View style={[styles.gridline, { top: CHART_HEIGHT / 2 }]} />
        {months.map((month, index) => {
          const height = month.totalCents === 0 ? 0 : Math.max(4, (month.totalCents / max) * CHART_HEIGHT);
          const active = index === selected;
          return (
            <Pressable
              key={refKey(month.ref)}
              style={styles.column}
              onPress={() => setSelected(index)}
              onHoverIn={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityLabel={`${monthName(month.ref.month)} de ${month.ref.year}: ${formatBRL(month.totalCents)}`}
              accessibilityState={{ selected: active }}>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      width: dense ? 14 : 22,
                      backgroundColor: active ? colors.primaryFill : colors.primary,
                      opacity: active ? 1 : 0.45,
                    },
                  ]}
                />
              </View>
              <AppText variant="small" color={active ? 'text' : 'textMuted'}>
                {shortMonth(month.ref.month)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { gap: spacing.md },
  readout: { gap: 2 },
  plot: { flexDirection: 'row', alignItems: 'flex-start' },
  gridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: CHART_HEIGHT + 24 },
  barArea: {
    height: CHART_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
}));
