import { CalendarClock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, ProgressBar, Surface } from '@/components/ui';
import { formatBRL, type InvoiceStatus, type InvoiceTotals } from '@/domain';
import { colors, spacing } from '@/theme';
import { formatShortDate } from '@/utils/dates';
import { InvoiceStatusBadge } from './StatusBadges';

export interface InvoiceSummaryCardProps {
  title: string;
  totals: InvoiceTotals;
  dueDate: string;
  status: InvoiceStatus;
  holderName: string;
  pendingLabel?: string;
}

/** Rule 13: total, received and pending, always together. */
export function InvoiceSummaryCard({ title, totals, dueDate, status, holderName, pendingLabel = 'Falta receber' }: InvoiceSummaryCardProps) {
  const accruing = status === 'open' || status === 'reviewing';
  return (
    <Surface elevation="md" style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="caption" color="textSecondary">
          {title}
        </AppText>
        <InvoiceStatusBadge status={status} />
      </View>
      <AppText variant="moneyLarge" color="brand">
        {formatBRL(totals.totalCents)}
      </AppText>
      <View style={styles.due}>
        <CalendarClock size={14} color={colors.textSecondary} />
        <AppText variant="caption" color="textSecondary">
          Vence em {formatShortDate(dueDate)} · Titular: {holderName}
        </AppText>
      </View>

      <ProgressBar progress={totals.progress} />
      <View style={styles.stats}>
        <Stat label="Recebido" value={formatBRL(totals.receivedCents)} color={colors.success} />
        <Stat label={pendingLabel} value={formatBRL(totals.pendingCents)} color={totals.pendingCents > 0 && !accruing ? colors.danger : colors.text} />
        <Stat label="Parte da titular" value={formatBRL(totals.holderShareCents)} color={colors.text} />
      </View>
    </Surface>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="small" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  due: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
});
