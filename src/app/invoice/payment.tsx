import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Button, Chip, LoadingState, MoneyInput, Surface, TextField } from '@/components/ui';
import { errorMessage, type InvoiceDetails, type MemberBalanceView } from '@/data';
import { formatBRL, formatRef, validatePayment } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useInvoice, useRegisterPayment } from '@/features/invoices/hooks';
import { spacing } from '@/theme';

export default function RegisterPaymentScreen() {
  const { invoiceId, memberId } = useLocalSearchParams<{ invoiceId: string; memberId: string }>();
  const invoice = useInvoice(invoiceId);
  const balance = invoice.data?.balances.find((b) => b.memberId === memberId);

  if (invoice.isLoading || !invoice.data || !balance) return <LoadingState />;
  return <PaymentForm invoice={invoice.data} balance={balance} />;
}

function PaymentForm({ invoice, balance }: { invoice: InvoiceDetails; balance: MemberBalanceView }) {
  const register = useRegisterPayment();
  const invoiceId = invoice.invoice.id;
  const memberId = balance.memberId;
  const open = balance.pendingCents - balance.awaitingCents;
  const [amount, setAmount] = useState(open);
  const [note, setNote] = useState('');
  // The holder (or an owner) records money already received; a member only tells the holder they paid.
  const confirmsNow = invoice.canManage;
  const isMe = memberId === invoice.me.id;

  const error = validatePayment({
    owedCents: balance.owedCents,
    alreadyPaidCents: balance.paidCents,
    awaitingCents: balance.awaitingCents,
    amountCents: amount,
  });
  const remaining = open - amount;
  const hint =
    error === 'nothing_owed'
      ? 'Não há nada em aberto: os pagamentos já informados aguardam confirmação.'
      : error === 'exceeds_pending'
        ? `O valor passa do que falta (${formatBRL(open)}).`
        : error
          ? 'Informe um valor.'
          : remaining > 0
            ? `Pagamento parcial: ainda faltará ${formatBRL(remaining)}.`
            : 'Quita a parte desta fatura.';

  return (
    <>
      <PageHeader
        title={confirmsNow ? 'Registrar pagamento' : 'Avisar pagamento'}
        subtitle={`Fatura ${formatRef(invoice.invoice.ref, { capitalize: true })}`}
      />
      <Screen
        footer={
          <Button
            label={confirmsNow ? 'Confirmar pagamento' : `Avisar ${invoice.holder.displayName}`}
            icon={CircleCheck}
            size="lg"
            disabled={Boolean(error)}
            loading={register.isPending}
            onPress={() =>
              register.mutate({ invoiceId, memberId, amountCents: amount, note: note || undefined }, { onSuccess: () => router.back() })
            }
          />
        }>
        <Surface style={styles.who}>
          <Avatar name={balance.member.displayName} color={balance.member.avatarColor} photo={balance.member.photo} size={48} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{balance.member.displayName}</AppText>
            <AppText variant="caption" color="textSecondary">
              Deve {formatBRL(balance.owedCents)} · já pagou {formatBRL(balance.paidCents)}
            </AppText>
            {balance.awaitingCents > 0 ? (
              <AppText variant="small" color="warning">
                {formatBRL(balance.awaitingCents)} aguardando confirmação
              </AppText>
            ) : null}
          </View>
        </Surface>

        <View style={styles.amount}>
          <AppText variant="caption" color="textSecondary">
            {confirmsNow ? 'Valor recebido por PIX' : isMe ? 'Quanto você enviou por PIX' : 'Valor enviado por PIX'}
          </AppText>
          <MoneyInput value={amount} onChangeValue={setAmount} size="hero" label="Valor do pagamento" autoFocus />
          <AppText variant="caption" color={error ? 'danger' : remaining > 0 ? 'warning' : 'success'} accessibilityLiveRegion="polite">
            {hint}
          </AppText>
        </View>

        <View style={styles.quick}>
          <Chip label="Valor total" selected={amount === open} onPress={() => setAmount(open)} />
          <Chip label="Metade" selected={amount === Math.round(open / 2)} onPress={() => setAmount(Math.round(open / 2))} />
        </View>

        <TextField
          label="Observação (opcional)"
          placeholder="Ex.: PIX enviado dia 05"
          value={note}
          onChangeText={setNote}
          maxLength={120}
        />
        <FormError message={register.error ? errorMessage(register.error) : null} />
        <AppText variant="small" color="textMuted">
          {confirmsNow
            ? 'O Wallit não movimenta dinheiro. Ele apenas registra o PIX recebido.'
            : `O Wallit não movimenta dinheiro. ${invoice.holder.displayName} recebe um aviso e confirma quando o PIX cair.`}
        </AppText>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  amount: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  quick: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
});
