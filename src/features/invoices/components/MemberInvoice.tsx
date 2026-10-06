import { router } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PurchaseRow } from '@/components/finance';
import { AppText, Avatar, Chip, Divider, EmptyState, Surface } from '@/components/ui';
import type { InvoiceDetails, InvoiceLine } from '@/data';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { makeStyles, radius, spacing } from '@/theme';

import { type GroupBy, groupLines, memberLines, memberShareCents, sharePercentLabel } from '../group-lines';

export interface MemberInvoiceProps {
  data: InvoiceDetails;
  /** Whose invoice to show; the signed-in member when absent. */
  memberId?: string;
  onMemberChange: (memberId: string) => void;
}

/**
 * One person's invoice inside the card's invoice: only the purchases they pay
 * part of, valued at their share, so the total matches what they owe.
 */
export function MemberInvoice({ data, memberId: selectedId, onMemberChange }: MemberInvoiceProps) {
  const formatBRL = useMoneyFormatter();
  const styles = useStyles();
  const [groupBy, setGroupBy] = useState<GroupBy>('date');

  // Other people's invoices only when the family lets this user see their balances.
  const people = data.balancesRestricted
    ? []
    : data.balances.filter((b) => b.owedCents > 0 || b.memberId === data.me.id).map((b) => b.member);
  const memberId = selectedId && people.some((p) => p.id === selectedId) ? selectedId : data.me.id;
  const isMe = memberId === data.me.id;
  const member = people.find((p) => p.id === memberId) ?? data.me;
  const balance = data.balances.find((b) => b.memberId === memberId);
  const lines = useMemo(() => memberLines(data.lines, memberId), [data.lines, memberId]);
  const groups = useMemo(() => groupLines(lines, groupBy, memberId), [lines, groupBy, memberId]);
  const owedCents = balance?.owedCents ?? 0;
  const accruing = data.invoice.status === 'open' || data.invoice.status === 'reviewing';
  const subject = isMe ? 'Você paga' : `${member.displayName} paga`;

  const explain = (line: InvoiceLine) => {
    const share = memberShareCents(line, memberId);
    const { amountCents, count, number } = line.installment;
    const others = line.shares.filter((s) => s.member.id !== memberId).map((s) => s.member.displayName);
    const whole = count > 1 ? 'a parcela inteira' : 'a compra inteira';
    const part =
      share >= amountCents
        ? `${subject} ${whole}`
        : `${subject} ${sharePercentLabel(share, amountCents)} de ${formatBRL(amountCents)}${count > 1 ? ` (parcela ${number}/${count})` : ''}`;
    return others.length > 0 ? `${part} · divide com ${others.join(', ')}` : part;
  };

  return (
    <View style={styles.section}>
      {people.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
          {people.map((person) => (
            <Chip
              key={person.id}
              label={person.id === data.me.id ? 'Você' : person.displayName}
              selected={person.id === memberId}
              onPress={() => onMemberChange(person.id)}
              leading={<Avatar name={person.displayName} color={person.avatarColor} photo={person.photo} size={20} />}
            />
          ))}
        </ScrollView>
      ) : null}

      <Surface style={styles.summary}>
        <AppText variant="caption" color="textSecondary">
          {isMe ? 'Sua fatura' : `Fatura de ${member.displayName}`} · {lines.length} {lines.length === 1 ? 'compra' : 'compras'}
        </AppText>
        <AppText variant="moneyLarge" color="brand">
          {formatBRL(owedCents)}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {balance?.status === 'holder'
            ? 'Titular do cartão: essa parte já está na sua conta com o banco.'
            : balance && owedCents > 0
              ? `Pago ${formatBRL(balance.paidCents)} · ${accruing ? 'a pagar' : 'falta'} ${formatBRL(balance.pendingCents)}${
                  balance.awaitingCents > 0 ? ` · ${formatBRL(balance.awaitingCents)} aguardando confirmação` : ''
                }`
              : 'Nada a pagar nesta fatura.'}
        </AppText>
        <AppText variant="small" color="textMuted">
          Cada compra aparece só com a parte que {isMe ? 'você paga' : `${member.displayName} paga`}. A soma é o valor da fatura.
        </AppText>
      </Surface>

      <View style={styles.chips}>
        <Chip label="Por data" selected={groupBy === 'date'} onPress={() => setGroupBy('date')} />
        <Chip label="Por categoria" selected={groupBy === 'category'} onPress={() => setGroupBy('category')} />
      </View>

      {groups.length === 0 ? (
        <Surface>
          <EmptyState
            icon={ReceiptText}
            title={isMe ? 'Você não tem compras nesta fatura' : `${member.displayName} não tem compras nesta fatura`}
          />
        </Surface>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <View style={styles.groupHeader}>
              <AppText variant="overline" color="textSecondary">
                {group.title}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {formatBRL(group.totalCents)}
              </AppText>
            </View>
            <Surface padded={false} style={styles.list}>
              {group.lines.map((line, index) => (
                <View key={line.installment.id}>
                  {index > 0 && <Divider inset={56} />}
                  <PurchaseRow
                    merchant={line.purchase.merchant}
                    statementName={line.purchase.statementName}
                    amountCents={memberShareCents(line, memberId)}
                    category={line.category}
                    buyer={line.buyer}
                    payers={line.shares.map((s) => s.member)}
                    installment={{ number: line.installment.number, count: line.installment.count }}
                    attachmentCount={line.attachmentCount}
                    onPress={() => router.push(`/purchase/${line.purchase.id}`)}
                    footer={
                      <AppText variant="small" color="textMuted">
                        {explain(line)}
                      </AppText>
                    }
                  />
                </View>
              ))}
            </Surface>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  section: { gap: spacing.md },
  people: { gap: spacing.sm, paddingRight: spacing.lg },
  summary: { gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  list: { paddingHorizontal: spacing.lg, borderRadius: radius.xl },
}));
