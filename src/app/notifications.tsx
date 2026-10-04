import { type Href, router } from 'expo-router';
import {
  BellOff,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  HandCoins,
  type LucideIcon,
  SearchCheck,
  Settings,
  ShoppingBag,
} from 'lucide-react-native';
import { View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, EmptyState, ErrorState, IconButton, LoadingState, PressableScale, Surface } from '@/components/ui';
import { errorMessage, type NotificationView } from '@/data';
import type { NotificationType } from '@/domain';
import { useFamilies } from '@/features/families/hooks';
import { useMarkNotificationsRead, useNotifications } from '@/features/notifications/hooks';
import { makeStyles, radius, spacing, type ThemeColors, useTheme } from '@/theme';
import { formatRelative } from '@/utils/dates';

function typeStyle(type: NotificationType, colors: ThemeColors): { icon: LucideIcon; color: string; background: string } {
  switch (type) {
    case 'review_started':
      return { icon: SearchCheck, color: colors.warning, background: colors.warningSoft };
    case 'dispute_opened':
      return { icon: CircleAlert, color: colors.danger, background: colors.dangerSoft };
    case 'dispute_resolved':
    case 'payment_confirmed':
      return { icon: CircleCheck, color: colors.success, background: colors.successSoft };
    case 'payment_rejected':
      return { icon: CircleX, color: colors.danger, background: colors.dangerSoft };
    case 'amount_defined':
    case 'payment_registered':
      return { icon: HandCoins, color: colors.primary, background: colors.primarySoft };
    case 'purchase_added':
      return { icon: ShoppingBag, color: colors.primary, background: colors.primarySoft };
    case 'due_reminder':
      return { icon: CalendarClock, color: colors.warning, background: colors.warningSoft };
  }
}

export default function NotificationsScreen() {
  const styles = useStyles();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const families = useFamilies();
  const showFamily = (families.data?.length ?? 0) > 1;
  const unread = notifications.data?.filter((n) => !n.readAt) ?? [];

  const open = (notification: NotificationView) => {
    if (!notification.readAt) markRead.mutate([notification.id]);
    if (notification.link) router.push(notification.link as Href);
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        right={
          <IconButton icon={Settings} accessibilityLabel="Configurar notificações" onPress={() => router.push('/settings/notifications')} />
        }
      />
      <Screen refreshing={notifications.isRefetching} onRefresh={() => notifications.refetch()}>
        {notifications.isLoading ? (
          <LoadingState />
        ) : notifications.error ? (
          <ErrorState message={errorMessage(notifications.error)} onRetry={() => notifications.refetch()} />
        ) : !notifications.data?.length ? (
          <Surface>
            <EmptyState icon={BellOff} title="Nada por aqui" description="Avisos de conferência, pagamentos e vencimentos aparecem aqui." />
          </Surface>
        ) : (
          <>
            {unread.length > 0 ? (
              <Button
                label="Marcar todas como lidas"
                icon={CheckCheck}
                variant="ghost"
                loading={markRead.isPending}
                onPress={() => markRead.mutate(undefined)}
              />
            ) : null}
            <Surface padded={false} style={styles.list}>
              {notifications.data.map((notification, index) => (
                <View key={notification.id}>
                  {index > 0 && <Divider />}
                  <NotificationRow notification={notification} showFamily={showFamily} onPress={() => open(notification)} />
                </View>
              ))}
            </Surface>
          </>
        )}
      </Screen>
    </>
  );
}

function NotificationRow({
  notification,
  showFamily,
  onPress,
}: {
  notification: NotificationView;
  showFamily: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { icon: Icon, color, background } = typeStyle(notification.type, colors);
  const unread = !notification.readAt;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${unread ? 'Nova: ' : ''}${notification.title}. ${notification.body}`}>
      <View style={[styles.row, unread && styles.unreadRow]}>
        <View style={[styles.icon, { backgroundColor: background }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={styles.text}>
          <AppText variant={unread ? 'bodyStrong' : 'body'}>{notification.title}</AppText>
          <AppText variant="caption" color="textSecondary">
            {notification.body}
          </AppText>
          <AppText variant="small" color="textMuted">
            {formatRelative(notification.createdAt)}
            {showFamily && notification.familyName ? ` · ${notification.familyName}` : ''}
          </AppText>
        </View>
        {unread ? <View style={styles.dot} accessibilityLabel="Não lida" /> : null}
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { overflow: 'hidden', borderRadius: radius.xl },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'flex-start' },
  unreadRow: { backgroundColor: colors.highlightSoft },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
}));
