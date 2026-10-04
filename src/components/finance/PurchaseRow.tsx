import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { Category, Cents, FamilyMember } from '@/domain';
import { formatBRL } from '@/domain';
import { colors, radius, spacing } from '@/theme';
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
  onPress?: () => void;
}

/**
 * Always answers: what, how much, who bought, who pays, which installment.
 */
export function PurchaseRow({ merchant, statementName, amountCents, category, buyer, payers, installment, dateLabel, onPress }: PurchaseRowProps) {
  const payersLabel = payers.map((p) => p.displayName).join(' + ');
  const showPayers = payersLabel && payersLabel !== buyer.displayName;
  const details = [`Comprou: ${buyer.displayName}`, showPayers ? `Paga: ${payersLabel}` : null].filter(Boolean).join(' · ');

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={`${merchant}, ${formatBRL(amountCents)}, ${details}`}>
      <View style={styles.row}>
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {merchant}
          </AppText>
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  text: { flex: 1, gap: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  installment: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
