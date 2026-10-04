import { CircleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export function FormError({ message }: { message?: string | null }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (!message) return null;
  return (
    <View style={styles.box} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <CircleAlert size={16} color={colors.danger} />
      <AppText variant="caption" color="danger" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
}));
