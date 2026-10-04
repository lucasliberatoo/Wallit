import type { LucideIcon } from 'lucide-react-native';
import { CircleAlert } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center}>
      <CircleAlert color={colors.danger} size={32} />
      <AppText variant="bodyStrong" align="center">
        {message}
      </AppText>
      {onRetry && <Button label="Tentar novamente" variant="secondary" onPress={onRetry} fullWidth={false} />}
    </View>
  );
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.iconWrap}>
        <Icon color={colors.primary} size={26} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" color="textSecondary" align="center">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} fullWidth={false} /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl, minHeight: 200 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
}));
