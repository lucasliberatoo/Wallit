import { CircleDot, HandCoins } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PaymentStatusBadge, PAYMENT_STATUS } from '@/components/finance';
import { AppText, Avatar, Badge, Button, ProgressBar } from '@/components/ui';
import type { MemberBalanceView } from '@/data';
import { formatBRL } from '@/domain';
import { colors, spacing } from '@/theme';

export interface MemberBalanceRowProps {
  balance: MemberBalanceView;
  isMe: boolean;
  canRegister: boolean;
  /** While the invoice is still open, unpaid amounts are not "late" yet. */
  invoiceOpen: boolean;
  onRegister: () => void;
}

export function MemberBalanceRow({ balance, isMe, canRegister, invoiceOpen, onRegister }: MemberBalanceRowProps) {
  const { member, owedCents, paidCents, pendingCents, status } = balance;
  const progress = owedCents === 0 ? 0 : paidCents / owedCents;
  const accruing = invoiceOpen && status === 'pending';
  const ring = accruing ? colors.borderStrong : PAYMENT_STATUS[status].color;
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Avatar name={member.displayName} color={member.avatarColor} size={44} ringColor={ring} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{isMe ? `${member.displayName} (você)` : member.displayName}</AppText>
          {accruing ? (
            <Badge label="Fatura em aberto" color={colors.textSecondary} background={colors.surfaceMuted} icon={CircleDot} />
          ) : (
            <PaymentStatusBadge status={status} />
          )}
        </View>
        <View style={styles.amounts}>
          <AppText variant="money">{formatBRL(owedCents)}</AppText>
          {status === 'partial' ? (
            <AppText variant="small" color="warning">
              falta {formatBRL(pendingCents)}
            </AppText>
          ) : null}
        </View>
      </View>
      {status === 'partial' || status === 'pending' ? (
        <View style={styles.bottom}>
          <ProgressBar progress={progress} height={6} />
          <View style={styles.actionsRow}>
            <AppText variant="caption" color="textSecondary" style={styles.flex} numberOfLines={1}>
              Pago {formatBRL(paidCents)}
            </AppText>
            {canRegister ? (
              <Button
                label={isMe ? 'Informar' : 'Registrar'}
                icon={HandCoins}
                variant="secondary"
                fullWidth={false}
                onPress={onRegister}
                style={styles.button}
                accessibilityHint={`Registrar pagamento de ${member.displayName}`}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 4 },
  amounts: { alignItems: 'flex-end', gap: 2 },
  bottom: { gap: spacing.sm, paddingLeft: 44 + spacing.md },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: { height: 36, paddingHorizontal: spacing.md },
});
