import { View } from 'react-native';

import { makeStyles, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leading?: React.ReactNode;
}

export function Chip({ label, selected = false, onPress, leading }: ChipProps) {
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected ? styles.selected : styles.idle]}>
      <View style={styles.row}>
        {leading}
        <AppText variant="caption" color={selected ? 'onPrimary' : 'text'}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: 'center',
    borderWidth: 1,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.primaryFill, borderColor: colors.primaryFill },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
}));
