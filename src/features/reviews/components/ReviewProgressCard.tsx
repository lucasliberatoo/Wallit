import { SearchCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Button, ProgressBar, Surface } from '@/components/ui';
import type { ReviewProgress } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';

export interface ReviewProgressCardProps {
  progress: ReviewProgress;
  /** Purchases the signed-in user still has to answer. */
  awaitingMeCount: number;
  onConfirmAll: () => void;
  confirmingAll: boolean;
}

export function ReviewProgressCard({ progress, awaitingMeCount, onConfirmAll, confirmingAll }: ReviewProgressCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const parts = [
    `${progress.confirmed} de ${progress.total} conferidas`,
    progress.disputed > 0 ? `${progress.disputed} ${progress.disputed === 1 ? 'contestada' : 'contestadas'}` : null,
  ].filter(Boolean);

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <SearchCheck size={18} color={colors.warning} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Conferência da fatura</AppText>
          <AppText variant="caption" color="textSecondary">
            {parts.join(' · ')}
          </AppText>
        </View>
      </View>
      <ProgressBar progress={progress.progress} color={colors.success} height={6} />
      {awaitingMeCount > 0 ? (
        <>
          <AppText variant="caption" color="textSecondary">
            {awaitingMeCount === 1
              ? 'Você ainda precisa conferir 1 compra. Confirme se reconhece ou conteste.'
              : `Você ainda precisa conferir ${awaitingMeCount} compras. Confirme as que reconhece ou conteste alguma.`}
          </AppText>
          {awaitingMeCount > 1 ? (
            <Button label={`Reconheço todas (${awaitingMeCount})`} variant="secondary" onPress={onConfirmAll} loading={confirmingAll} />
          ) : null}
        </>
      ) : (
        <AppText variant="caption" color="textSecondary">
          Você já conferiu todas as suas compras.
        </AppText>
      )}
    </Surface>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSoft,
  },
  flex: { flex: 1, gap: 2 },
}));
