import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Divider, ProgressBar, SegmentedControl, Surface } from '@/components/ui';
import type { ScenarioMonth, ScenarioResult } from '@/data';
import { type Cents, formatBRL, formatRef } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';

export type ScenarioView = 'mine' | 'cards';

function signed(value: Cents): string {
  if (value === 0) return 'igual';
  return `${value > 0 ? '+' : '−'}${formatBRL(Math.abs(value))}`.replace(' ', ' ');
}

/** What leaves the pocket in the month: invoices (whole or my part) plus loan installments, minus loan money received. */
export function monthOutflow(month: ScenarioMonth, view: ScenarioView): { before: Cents; after: Cents; invoices: Cents } {
  const amounts = view === 'mine' ? month.mine : month.cards;
  return {
    before: amounts.beforeCents,
    after: amounts.afterCents + month.loanPaymentsCents - month.loanReceivedCents,
    invoices: amounts.afterCents,
  };
}

/** Month by month comparison: how things are today and with the simulations. */
export function ScenarioResultView({
  result,
  view,
  onViewChange,
  hasOperations,
}: {
  result: ScenarioResult;
  view: ScenarioView;
  onViewChange: (view: ScenarioView) => void;
  hasOperations: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const rows = result.months.map((month) => ({ month, ...monthOutflow(month, view) }));
  const totalBefore = rows.reduce((sum, row) => sum + row.before, 0);
  const totalAfter = rows.reduce((sum, row) => sum + row.after, 0);
  const biggest = Math.max(1, ...rows.map((row) => Math.max(row.before, row.after)));
  const peakBefore = rows.reduce((peak, row) => Math.max(peak, row.before), 0);
  const peakAfter = rows.reduce((peak, row) => Math.max(peak, row.after), 0);
  const difference = totalAfter - totalBefore;

  return (
    <View style={styles.wrapper}>
      <SegmentedControl<ScenarioView>
        options={[
          { value: 'mine', label: 'Só a minha parte' },
          { value: 'cards', label: 'Cartão inteiro' },
        ]}
        value={view}
        onChange={onViewChange}
      />

      {result.limits.map((limit) => {
        const over = limit.availableAfterCents < 0;
        return (
          <Surface key={limit.card.id} style={[styles.verdict, { backgroundColor: over ? colors.dangerSoft : colors.successSoft }]}>
            {over ? <CircleAlert size={22} color={colors.danger} /> : <CircleCheck size={22} color={colors.success} />}
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={over ? 'danger' : 'success'}>
                {over
                  ? `${limit.card.name}: passa do limite em ${formatBRL(-limit.availableAfterCents)}`
                  : `${limit.card.name}: cabe no limite, sobram ${formatBRL(limit.availableAfterCents)}`}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Disponível hoje {formatBRL(limit.availableBeforeCents)}
              </AppText>
            </View>
          </Surface>
        );
      })}

      <Surface style={styles.summary}>
        <AppText variant="caption" color="textSecondary">
          {view === 'mine' ? 'Você paga no período' : 'Faturas dos cartões no período'}
          {result.months.length > 0
            ? ` (${formatRef(result.months[0].ref)} a ${formatRef(result.months[result.months.length - 1].ref)})`
            : ''}
        </AppText>
        <View style={styles.compare}>
          <View style={styles.flex}>
            <AppText variant="caption" color="textMuted">
              Hoje
            </AppText>
            <AppText variant="h3">{formatBRL(totalBefore)}</AppText>
            <AppText variant="small" color="textMuted">
              maior mês {formatBRL(peakBefore)}
            </AppText>
          </View>
          {hasOperations ? (
            <View style={styles.flex}>
              <AppText variant="caption" color="textMuted">
                Com a simulação
              </AppText>
              <AppText variant="h3" color={difference > 0 ? 'warning' : difference < 0 ? 'success' : 'text'}>
                {formatBRL(totalAfter)}
              </AppText>
              <AppText variant="small" color="textMuted">
                maior mês {formatBRL(peakAfter)}
              </AppText>
            </View>
          ) : null}
        </View>
        {hasOperations && difference !== 0 ? (
          <AppText variant="caption" color={difference > 0 ? 'warning' : 'success'}>
            {difference > 0
              ? `Você pagaria ${formatBRL(difference)} a mais no total.`
              : `Você pagaria ${formatBRL(-difference)} a menos no total.`}
          </AppText>
        ) : null}
      </Surface>

      <Surface style={styles.list}>
        {rows.map(({ month, before, after, invoices }, index) => {
          const change = after - before;
          return (
            <View key={`${month.ref.year}-${month.ref.month}`} style={styles.month}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.monthHeader}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {formatRef(month.ref, { capitalize: true })}
                </AppText>
                <AppText variant="caption" color={change > 0 ? 'warning' : change < 0 ? 'success' : 'textMuted'}>
                  {signed(change)}
                </AppText>
              </View>
              <AppText variant="caption" color="textSecondary">
                {formatBRL(before)} hoje →{' '}
                <AppText variant="caption" color={after < 0 ? 'success' : 'text'}>
                  {after < 0 ? `sobram ${formatBRL(-after)}` : formatBRL(after)}
                </AppText>
              </AppText>
              <ProgressBar progress={Math.max(after, 0) / biggest} color={change > 0 ? colors.warning : colors.primary} height={6} />
              {month.loanPaymentsCents > 0 || month.loanReceivedCents > 0 ? (
                <View style={styles.breakdown}>
                  <AppText variant="small" color="textMuted">
                    {view === 'mine' ? 'Sua parte nas faturas' : 'Faturas'}: {formatBRL(invoices)}
                  </AppText>
                  {month.loanPaymentsCents > 0 ? (
                    <AppText variant="small" color="textMuted">
                      Parcelas de empréstimo: {formatBRL(month.loanPaymentsCents)}
                    </AppText>
                  ) : null}
                  {month.loanReceivedCents > 0 ? (
                    <AppText variant="small" color="success">
                      Dinheiro do empréstimo: −{formatBRL(month.loanReceivedCents)}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Surface>
      <AppText variant="small" color="textMuted">
        “Hoje” considera só as compras já registradas. Compras que você ainda vai fazer não entram, a não ser que você as simule. Um valor
        negativo num mês quer dizer que sobra dinheiro do empréstimo.
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrapper: { gap: spacing.md },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  summary: { gap: spacing.sm },
  compare: { flexDirection: 'row', gap: spacing.md },
  list: { gap: spacing.sm },
  month: { gap: spacing.xs },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdown: { gap: 2 },
}));
