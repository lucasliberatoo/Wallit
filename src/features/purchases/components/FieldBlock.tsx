import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { spacing } from '@/theme';

/** Label + content block used to keep the purchase form compact and scannable. */
export function FieldBlock({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <AppText variant="overline" color="textSecondary">
          {label}
        </AppText>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
