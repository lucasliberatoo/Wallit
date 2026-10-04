import { Paperclip } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { Category, Cents, FamilyMember } from '@/domain';
import { formatBRL } from '@/domain';
import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { CategoryIcon } from './CategoryIcon';

export interface PurchaseRowProps {
  merchant: string;
  statementName?: string;
  amountCents: Cents;
  category: Category | null;
  buyer: Pick<FamilyMember, 'displayName'>;
  payers: Pick<FamilyMember, 'displayName'>[];
  installment?: { number: number; count: number };
  dateLabel?: string;
  /** Receipts attached to the purchase (shows a paperclip). */
  attachmentCount?: number;
  /** Extra content under the row (review status, actions). */
  footer?: ReactNode;
  onPress?: () => void;
}

/**
 * Always answers: what, how much, who bought, who pays, which installment.
 */
export function PurchaseRow({
  merchant,
  statementName,
  amountCents,
  category,
  buyer,
  payers,
  installment,
  dateLabel,
  attachmentCount = 0,
  footer,
  onPress,
}: PurchaseRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const payersLabel = payers.map((p) => p.displayName).join(' + ');
  const showPayers = payersLabel && payersLabel !== buyer.displayName;
  const details = [`Comprou: ${buyer.displayName}`, showPayers ? `Paga: ${payersLabel}` : null].filter(Boolean).join(' · ');

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={`${merchant}, ${formatBRL(amountCents)}, ${details}`}>
      <View style={styles.row}>
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
              {merchant}
            </AppText>
            {attachmentCount > 0 ? (
              <Paperclip size={13} color={colors.textMuted} accessibilityLabel={`${attachmentCount} anexo(s)`} />
            ) : null}
          </View>
          {statementName && statementName !== merchant ? (
            <AppText variant="small" color="textMuted" numberOfLines={1}>
              {statementName}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {details}
          </AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="money">{formatBRL(amountCents)}</AppText>
          {installment && installment.count > 1 ? (
            <View style={styles.installment}>
              <AppText variant="small" color="primary">
                {installment.number}/{installment.count}
              </AppText>
            </View>
          ) : dateLabel ? (
            <AppText variant="small" color="textMuted">
              {dateLabel}
            </AppText>
          ) : null}
        </View>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </PressableScale>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  text: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  footer: { paddingLeft: 44 + spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  right: { alignItems: 'flex-end', gap: 4 },
  installment: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
}));
