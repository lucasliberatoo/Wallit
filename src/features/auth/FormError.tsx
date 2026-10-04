import { CircleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export function FormError({ message }: { message?: string | null }) {
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

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  text: { flex: 1 },
});
