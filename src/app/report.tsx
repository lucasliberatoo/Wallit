import { FileSpreadsheet, FileText, MessageCircle, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { MoneyText } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Button, Chip, Divider, EmptyState, ErrorState, LoadingState, Surface } from '@/components/ui';
import { errorMessage, type MonthlyReport } from '@/data';
import { addMonths, formatRef, type InvoiceRef } from '@/domain';
import { useCurrentFamily } from '@/features/families/hooks';
import { useMonthlyReport } from '@/features/reports/hooks';
import { shareReportCsv, shareReportPdf, shareReportText } from '@/features/reports/share-report';
import { useMoneyFormatter } from '@/lib/money-visibility';
import { makeStyles, spacing } from '@/theme';
import { showError } from '@/utils/confirm';
import { formatDate } from '@/utils/dates';

function currentRef(): InvoiceRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Next month first (open invoices), then the last five. */
function monthOptions(): InvoiceRef[] {
  const now = currentRef();
  return Array.from({ length: 7 }, (_, index) => addMonths(now, 1 - index));
}

export default function ReportScreen() {
  const styles = useStyles();
  const { current } = useCurrentFamily();
  const months = useMemo(() => monthOptions(), []);
  const [ref, setRef] = useState<InvoiceRef>(months[1]);
  const report = useMonthlyReport(current?.family.id, ref);
  const [busy, setBusy] = useState<'pdf' | 'csv' | 'text' | null>(null);

  const run = (kind: 'pdf' | 'csv' | 'text', action: (r: MonthlyReport) => Promise<void>) => async () => {
    if (!report.data) return;
    setBusy(kind);
    try {
      await action(report.data);
    } catch (error) {
      showError('Não foi possível gerar', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const data = report.data;
  const empty = data && data.invoices.length === 0;

  return (
    <>
      <PageHeader title="Relatório do mês" subtitle={current?.family.name} />
      <Screen
        refreshing={report.isRefetching}
        onRefresh={() => report.refetch()}
        footer={
          data && !empty ? (
            <View style={styles.actions}>
              <View style={styles.row}>
                <Button
                  label="PDF"
                  icon={FileText}
                  variant="secondary"
                  fullWidth={false}
                  style={styles.flex}
                  loading={busy === 'pdf'}
                  disabled={busy !== null}
                  onPress={run('pdf', shareReportPdf)}
                />
                <Button
                  label="Planilha"
                  icon={FileSpreadsheet}
                  variant="secondary"
                  fullWidth={false}
                  style={styles.flex}
                  loading={busy === 'csv'}
                  disabled={busy !== null}
                  onPress={run('csv', shareReportCsv)}
                />
              </View>
              <Button
                label="Mandar resumo no WhatsApp"
                icon={MessageCircle}
                loading={busy === 'text'}
                disabled={busy !== null}
                onPress={run('text', shareReportText)}
              />
            </View>
          ) : undefined
        }>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {months.map((month) => (
            <Chip
              key={`${month.year}-${month.month}`}
              label={formatRef(month, { capitalize: true })}
              selected={month.year === ref.year && month.month === ref.month}
              onPress={() => setRef(month)}
            />
          ))}
        </ScrollView>

        {report.isLoading ? (
          <LoadingState />
        ) : report.error ? (
          <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
        ) : !data || empty ? (
          <Surface>
            <EmptyState icon={ReceiptText} title="Nenhuma fatura neste mês" description="Escolha outro mês acima." />
          </Surface>
        ) : (
          <ReportBody report={data} />
        )}
      </Screen>
    </>
  );
}

function ReportBody({ report }: { report: MonthlyReport }) {
  const formatBRL = useMoneyFormatter();
  const styles = useStyles();
  return (
    <>
      <View style={styles.row}>
        <Surface style={styles.total}>
          <AppText variant="small" color="textSecondary">
            Gasto do mês
          </AppText>
          <MoneyText value={report.totals.spentCents} />
        </Surface>
        <Surface style={styles.total}>
          <AppText variant="small" color="textSecondary">
            Falta pagar
          </AppText>
          <MoneyText value={report.totals.pendingCents} color={report.totals.pendingCents > 0 ? 'danger' : 'success'} />
        </Surface>
      </View>

      <View style={styles.section}>
        <AppText variant="overline" color="textSecondary">
          {report.restricted ? 'Sua parte' : 'Por pessoa'}
        </AppText>
        <Surface padded={false} style={styles.list}>
          {report.people.map((person, index) => (
            <View key={person.member.id}>
              {index > 0 ? <Divider inset={48} /> : null}
              <View style={styles.person}>
                <Avatar name={person.member.displayName} color={person.member.avatarColor} photo={person.member.photo} size={36} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{person.member.displayName}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    Gastou {formatBRL(person.spentCents)} · pagou {formatBRL(person.paidCents)}
                  </AppText>
                  {person.holderOf.length > 0 ? (
                    <AppText variant="small" color="textMuted">
                      Titular: {person.holderOf.join(', ')}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.right}>
                  <AppText variant="small" color="textSecondary">
                    {person.pendingCents > 0 ? 'Falta' : 'Situação'}
                  </AppText>
                  <AppText variant="bodyStrong" color={person.pendingCents > 0 ? 'danger' : 'success'}>
                    {person.pendingCents > 0 ? formatBRL(person.pendingCents) : 'Em dia'}
                  </AppText>
                </View>
              </View>
            </View>
          ))}
        </Surface>
        {report.restricted ? (
          <AppText variant="small" color="textMuted">
            O dono da família deixou visível só a parte de cada um.
          </AppText>
        ) : null}
      </View>

      <View style={styles.section}>
        <AppText variant="overline" color="textSecondary">
          Faturas
        </AppText>
        <Surface padded={false} style={styles.list}>
          {report.invoices.map((invoice, index) => (
            <View key={invoice.invoiceId}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.person}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{invoice.cardName}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    Vence {formatDate(invoice.dueDate)} · titular {invoice.holderName}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{formatBRL(invoice.totalCents)}</AppText>
              </View>
            </View>
          ))}
        </Surface>
        <AppText variant="small" color="textMuted">
          {report.lines.length} {report.lines.length === 1 ? 'compra entra' : 'compras entram'} no PDF e na planilha.
        </AppText>
      </View>
    </>
  );
}

const useStyles = makeStyles(() => ({
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  total: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  right: { alignItems: 'flex-end' },
  actions: { gap: spacing.sm },
}));

