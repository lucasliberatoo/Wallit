import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}

export function ListRow({ title, subtitle, leading, trailing, onPress, showChevron = Boolean(onPress) }: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {leading}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {showChevron && <ChevronRight size={18} color={colors.textMuted} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 56 },
  text: { flex: 1, gap: 2 },
});
