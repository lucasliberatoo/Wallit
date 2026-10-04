import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton } from '@/components/ui';
import { layout, makeStyles, spacing, useTheme } from '@/theme';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  tone?: 'light' | 'transparent';
}

/** Header for stack screens: back button, title and optional action. */
export function PageHeader({ title, subtitle, right, onBack, tone = 'light' }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const styles = useStyles();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.wrapper, tone === 'light' && styles.light, { paddingTop: insets.top + spacing.sm }]}>
      {tone === 'light' ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      <View style={styles.row}>
        <IconButton icon={ArrowLeft} onPress={back} accessibilityLabel="Voltar" tone={tone === 'light' ? 'light' : 'glass'} />
        <View style={styles.titles}>
          <AppText variant="h3" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  light: { backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    maxWidth: layout.maxContentWidth + spacing.xxl,
    alignSelf: 'center',
  },
  titles: { flex: 1, alignItems: 'center' },
  right: { minWidth: 44, alignItems: 'flex-end' },
}));
