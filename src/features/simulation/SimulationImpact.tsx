import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Divider, ProgressBar, Surface } from '@/components/ui';
import type { PurchaseSimulation, SimulationMonth } from '@/data';
import { type Cents, formatBRL, formatRef } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';
import { formatShortDate } from '@/utils/dates';

function signed(value: Cents): string {
  if (value === 0) return 'sem mudança';
  return `${value > 0 ? '+' : '−'}${formatBRL(Math.abs(value))}`.replace(' ', '\u00A0');
}

/** Before/after of the next invoices for a simulated purchase or anticipation. */
export function SimulationImpact({ simulation }: { simulation: PurchaseSimulation }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { months, limit } = simulation;
  const after = (m: SimulationMonth) => m.beforeCents + m.addedCents;
  const biggest = Math.max(1, ...months.map((m) => Math.max(after(m), m.beforeCents)));
  const myPeak = months.reduce<SimulationMonth | null>(
    (peak, m) => (!peak || m.myBeforeCents + m.myAddedCents > peak.myBeforeCents + peak.myAddedCents ? m : peak),
    null,
  );
  const overLimit = limit !== null && limit.availableAfterCents < 0;

  return (
    <View style={styles.wrapper}>
      {limit ? (
        <Surface style={[styles.verdict, { backgroundColor: overLimit ? colors.dangerSoft : colors.successSoft }]}>
          {overLimit ? <CircleAlert size={22} color={colors.danger} /> : <CircleCheck size={22} color={colors.success} />}
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={overLimit ? 'danger' : 'success'}>
              {overLimit
                ? `Passa do limite em ${formatBRL(-limit.availableAfterCents)}`
                : `Cabe no limite: sobram ${formatBRL(limit.availableAfterCents)}`}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Limite de {formatBRL(limit.limitCents)} · disponível hoje {formatBRL(limit.availableBeforeCents)}
            </AppText>
          </View>
        </Surface>
      ) : null}

      {myPeak && simulation.myTotalCents !== 0 ? (
        <AppText variant="body" color="textSecondary">
          Sua parte {simulation.myTotalCents > 0 ? 'nesta compra' : 'que muda de fatura'}:{' '}
          <AppText variant="bodyStrong">{formatBRL(Math.abs(simulation.myTotalCents))}</AppText>. Sua fatura mais alta fica em{' '}
          <AppText variant="bodyStrong">{formatBRL(myPeak.myBeforeCents + myPeak.myAddedCents)}</AppText>, em {formatRef(myPeak.ref)}.
        </AppText>
      ) : null}

      <Surface style={styles.list}>
        {months.map((month, index) => {
          const total = after(month);
          const myAfter = month.myBeforeCents + month.myAddedCents;
          const up = month.addedCents > 0;
          return (
            <View key={`${month.ref.year}-${month.ref.month}`} style={styles.month}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.monthHeader}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {formatRef(month.ref, { capitalize: true })}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  vence {formatShortDate(month.dueDate)}
                </AppText>
              </View>
              <AppText variant="caption" color="textSecondary">
                Cartão: {formatBRL(month.beforeCents)} →{' '}
                <AppText variant="caption" color="text">
                  {formatBRL(total)}
                </AppText>{' '}
                <AppText variant="caption" color={up ? 'warning' : month.addedCents < 0 ? 'success' : 'textMuted'}>
                  ({signed(month.addedCents)})
                </AppText>
              </AppText>
              <ProgressBar progress={total / biggest} color={up ? colors.warning : colors.primary} height={6} />
              <AppText variant="caption" color="textSecondary">
                Sua parte: {formatBRL(month.myBeforeCents)} →{' '}
                <AppText variant="caption" color="text">
                  {formatBRL(myAfter)}
                </AppText>{' '}
                ({signed(month.myAddedCents)})
              </AppText>
            </View>
          );
        })}
      </Surface>
      <AppText variant="small" color="textMuted">
        Nada é salvo: é só uma simulação com as compras registradas até agora.
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrapper: { gap: spacing.md },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  month: { gap: spacing.xs },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
