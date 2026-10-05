import { Eye } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, SegmentedControl, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import type { BalancesVisibility, Family } from '@/domain';
import { makeStyles, spacing, useTheme } from '@/theme';
import { showError } from '@/utils/confirm';
import { useUpdateFamilySettings } from './hooks';

const HINT: Record<BalancesVisibility, string> = {
  everyone: 'Todos da família veem quanto cada pessoa deve e já pagou.',
  managers: 'Só você e quem é titular do cartão veem a parte de cada um. Os outros veem apenas a própria parte.',
};

/** Owner setting: who sees how much each person owes. */
export function BalancesVisibilitySetting({ family }: { family: Family }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const update = useUpdateFamilySettings();
  const value = family.balancesVisibility ?? 'everyone';

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <Eye size={20} color={colors.primary} />
        <AppText variant="h3">Quem vê quanto cada um deve</AppText>
      </View>
      <SegmentedControl
        value={value}
        onChange={(next) =>
          update.mutate(
            { familyId: family.id, changes: { balancesVisibility: next } },
            { onError: (error) => showError('Não foi possível salvar', errorMessage(error)) },
          )
        }
        options={[
          { value: 'everyone', label: 'Todos' },
          { value: 'managers', label: 'Só eu e titulares' },
        ]}
      />
      <AppText variant="caption" color="textSecondary">
        {HINT[value]}
      </AppText>
    </Surface>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
