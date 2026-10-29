import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Divider, ProgressBar, Surface } from '@/components/ui';
import type { ScenarioMonth, ScenarioResult } from '@/data';
import { type Cents, formatBRL, formatRef } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';
import { shortRef } from './scenario-draft';

export type ScenarioView = 'mine' | 'cards';

/** What leaves the pocket in the month: invoices (whole or my part) plus loan installments, minus loan money received. */
export function monthOutflow(month: ScenarioMonth, view: ScenarioView): { before: Cents; after: Cents; invoices: Cents } {
  const amounts = view === 'mine' ? month.mine : month.cards;
  return {
    before: amounts.beforeCents,
    after: amounts.afterCents + month.loanPaymentsCents - month.loanReceivedCents,
    invoices: amounts.afterCents,
  };
}

/** Months shown before "Ver todos". */
const FIRST_MONTHS = 6;

/** Month by month comparison: how things are today and with the simulations. */
export function ScenarioResultView({
  result,
  view,
  hasOperations,
}: {
  result: ScenarioResult;
  view: ScenarioView;
  hasOperations: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const rows = result.months.map((month) => ({ month, ...monthOutflow(month, view) }));
  const count = Math.max(rows.length, 1);
  const totalBefore = rows.reduce((sum, row) => sum + row.before, 0);
  const totalAfter = rows.reduce((sum, row) => sum + row.after, 0);
  const biggest = Math.max(1, ...rows.map((row) => Math.max(row.before, row.after)));
  const peakBefore = rows.reduce((peak, row) => Math.max(peak, row.before), 0);
  const peakAfter = rows.reduce((peak, row) => Math.max(peak, row.after), 0);
  const difference = totalAfter - totalBefore;
  const visible = showAll ? rows : rows.slice(0, FIRST_MONTHS);
  const period =
    result.months.length > 0 ? `${formatRef(result.months[0].ref)} a ${formatRef(result.months[result.months.length - 1].ref)}` : '';

  return (
    <View style={styles.wrapper}>
      <Surface style={styles.summary}>
        <View style={styles.compare}>
          <View style={styles.flex}>
            <AppText variant="caption" color="textSecondary">
              Hoje
            </AppText>
            <AppText variant="h2">{formatBRL(Math.round(totalBefore / count))}</AppText>
            <AppText variant="small" color="textMuted">
              por mês, em média
            </AppText>
          </View>
          {hasOperations ? (
            <View style={styles.flex}>
              <AppText variant="caption" color="textSecondary">
                Com a simulação
              </AppText>
              <AppText variant="h2" color={difference > 0 ? 'warning' : difference < 0 ? 'success' : 'text'}>
                {formatBRL(Math.round(totalAfter / count))}
              </AppText>
              <AppText variant="small" color="textMuted">
                por mês, em média
              </AppText>
            </View>
          ) : null}
        </View>
        <Divider />
        <View style={styles.facts}>
          <Fact label="Total no período" before={totalBefore} after={hasOperations ? totalAfter : null} />
          <Fact label="Mês mais pesado" before={peakBefore} after={hasOperations ? peakAfter : null} />
        </View>
        {hasOperations ? (
          <AppText variant="caption" color={difference > 0 ? 'warning' : difference < 0 ? 'success' : 'textSecondary'}>
            {difference > 0
              ? `No total você pagaria ${formatBRL(difference)} a mais.`
              : difference < 0
                ? `No total você pagaria ${formatBRL(-difference)} a menos.`
                : 'No total você pagaria o mesmo valor, só que distribuído de outro jeito.'}
          </AppText>
        ) : null}
        <AppText variant="small" color="textMuted">
          {view === 'mine' ? 'Sua parte nas faturas' : 'Faturas de todos os cartões'}
          {hasOperations ? ' mais as parcelas de empréstimo' : ''}, de {period}.
        </AppText>
      </Surface>

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

      {result.payoffs.map((payoff) =>
        payoff.movedCents === 0 ? (
          <AppText key={payoff.operation} variant="caption" color="warning">
            A quitação {payoff.operation + 1} não encontrou parcelas depois da fatura escolhida.
          </AppText>
        ) : null,
      )}

      <Surface style={styles.list}>
        <View style={styles.monthHeader}>
          <AppText variant="caption" color="textMuted" style={styles.flex}>
            Mês
          </AppText>
          <AppText variant="caption" color="textMuted">
            {hasOperations ? 'Hoje → com a simulação' : 'Valor'}
          </AppText>
        </View>
        {visible.map(({ month, before, after, invoices }) => {
          const change = after - before;
          return (
            <View key={`${month.ref.year}-${month.ref.month}`} style={styles.month}>
              <Divider />
              <View style={styles.monthHeader}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {shortRef(month.ref)}
                </AppText>
                {hasOperations ? (
                  <AppText variant="caption" color="textMuted">
                    {formatBRL(before)} →{' '}
                  </AppText>
                ) : null}
                <AppText variant="bodyStrong" color={after < 0 ? 'success' : change > 0 ? 'warning' : 'text'}>
                  {after < 0 ? `sobram ${formatBRL(-after)}` : formatBRL(after)}
                </AppText>
              </View>
              <ProgressBar progress={Math.max(after, 0) / biggest} color={change > 0 ? colors.warning : colors.primary} height={6} />
              {month.loanPaymentsCents > 0 || month.loanReceivedCents > 0 ? (
                <AppText variant="small" color="textMuted">
                  {view === 'mine' ? 'Sua parte' : 'Faturas'} {formatBRL(invoices)}
                  {month.loanPaymentsCents > 0 ? ` + empréstimo ${formatBRL(month.loanPaymentsCents)}` : ''}
                  {month.loanReceivedCents > 0 ? ` − recebido ${formatBRL(month.loanReceivedCents)}` : ''}
                </AppText>
              ) : null}
            </View>
          );
        })}
        {rows.length > FIRST_MONTHS ? (
          <Button
            label={showAll ? 'Mostrar menos' : `Ver todos os ${rows.length} meses`}
            variant="ghost"
            onPress={() => setShowAll((value) => !value)}
          />
        ) : null}
      </Surface>
      <AppText variant="small" color="textMuted">
        “Hoje” considera só as compras já registradas. Gastos futuros só entram se você simular.
      </AppText>
    </View>
  );
}

function Fact({ label, before, after }: { label: string; before: Cents; after: Cents | null }) {
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <AppText variant="small" color="textMuted">
        {label}
      </AppText>
      <AppText variant="caption">
        {formatBRL(before)}
        {after !== null ? ` → ${formatBRL(after)}` : ''}
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
  fact: { gap: 2 },
  facts: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  list: { gap: spacing.sm },
  month: { gap: spacing.xs },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
}));
