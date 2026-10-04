import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={10} accessibilityLabel={actionLabel}>
          <AppText variant="caption" color="primary">
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
