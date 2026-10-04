import { MoonStar } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, SegmentedControl, Surface } from '@/components/ui';
import { makeStyles, spacing, type ThemePreference, useTheme } from '@/theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

/** Perfil > Aparência: follow the phone, or force light/dark. */
export function AppearanceSetting() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useStyles();
  return (
    <Surface style={styles.card}>
      <View style={styles.title}>
        <MoonStar size={20} color={colors.primary} />
        <AppText variant="h3">Aparência</AppText>
      </View>
      <SegmentedControl options={OPTIONS} value={preference} onChange={setPreference} />
      <AppText variant="caption" color="textSecondary">
        {preference === 'system' ? 'Segue o modo claro ou escuro do seu aparelho.' : 'Vale só para este aparelho.'}
      </AppText>
    </Surface>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
