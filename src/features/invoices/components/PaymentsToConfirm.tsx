import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Avatar, Button, Divider, SectionHeader, Surface } from '@/components/ui';
import type { PaymentView } from '@/data';

import { useMoneyFormatter } from '@/lib/money-visibility';
import { makeStyles, spacing } from '@/theme';
import { formatDateTime } from '@/utils/dates';

export interface PaymentsToConfirmProps {
  payments: PaymentView[];
  busyId: string | null;
  onConfirm: (payment: PaymentView) => void;
  onReject: (payment: PaymentView) => void;
}

/** Payments members said they made, waiting for the holder to check the bank. */
export function PaymentsToConfirm({ payments, busyId, onConfirm, onReject }: PaymentsToConfirmProps) {
  const formatBRL = useMoneyFormatter();
  const styles = useStyles();
  return (
    <View>
      <SectionHeader title="Pagamentos para confirmar" />
      <Surface padded={false} style={styles.list}>
        {payments.map((payment, index) => (
          <View key={payment.id}>
            {index > 0 && <Divider />}
            <View style={styles.item}>
              <View style={styles.row}>
                <Avatar name={payment.member.displayName} color={payment.member.avatarColor} photo={payment.member.photo} size={36} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{payment.member.displayName} disse que pagou</AppText>
                  <AppText variant="small" color="textMuted">
                    {formatDateTime(payment.paidAt)}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </AppText>
                </View>
                <AppText variant="money">{formatBRL(payment.amountCents)}</AppText>
              </View>
              <View style={styles.actions}>
                <Button
                  label="Não recebi"
                  icon={X}
                  variant="danger"
                  fullWidth={false}
                  style={styles.button}
                  disabled={busyId !== null}
                  onPress={() => onReject(payment)}
                />
                <Button
                  label="Recebi"
                  icon={Check}
                  fullWidth={false}
                  style={styles.button}
                  loading={busyId === payment.id}
                  disabled={busyId !== null && busyId !== payment.id}
                  onPress={() => onConfirm(payment)}
                />
              </View>
            </View>
          </View>
        ))}
      </Surface>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  list: { paddingHorizontal: spacing.lg },
  item: { paddingVertical: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  button: { flex: 1, height: 40 },
}));
