import { CircleDot, HandCoins } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PaymentStatusBadge, paymentStatusStyle } from '@/components/finance';
import { AppText, Avatar, Badge, Button, ProgressBar } from '@/components/ui';
import type { MemberBalanceView } from '@/data';

import { useMoneyFormatter } from '@/lib/money-visibility';
import { spacing, useTheme } from '@/theme';

export interface MemberBalanceRowProps {
  balance: MemberBalanceView;
  isMe: boolean;
  canRegister: boolean;
  /** While the invoice is still open, unpaid amounts are not "late" yet. */
  invoiceOpen: boolean;
  onRegister: () => void;
}

export function MemberBalanceRow({ balance, isMe, canRegister, invoiceOpen, onRegister }: MemberBalanceRowProps) {
  const formatBRL = useMoneyFormatter();
  const { colors } = useTheme();
  const { member, owedCents, paidCents, pendingCents, awaitingCents, status } = balance;
  const toRegisterCents = pendingCents - awaitingCents;
  const progress = owedCents === 0 ? 0 : paidCents / owedCents;
  const accruing = invoiceOpen && status === 'pending';
  const ring = accruing ? colors.borderStrong : paymentStatusStyle(status, colors).color;
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={44} ringColor={ring} />
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
            <View style={styles.flex}>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                Pago {formatBRL(paidCents)}
              </AppText>
              {awaitingCents > 0 ? (
                <AppText variant="small" color="warning" numberOfLines={1}>
                  {formatBRL(awaitingCents)} aguardando confirmação
                </AppText>
              ) : null}
            </View>
            {canRegister && toRegisterCents > 0 ? (
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
