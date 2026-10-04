import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/theme';
import { AppText } from './AppText';

export interface BadgeProps {
  label: string;
  color: string;
  background: string;
  icon?: LucideIcon;
}

/** Status pill: always icon + text, never color alone (accessibility). */
export function Badge({ label, color, background, icon: Icon }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {Icon && <Icon size={12} color={color} strokeWidth={2.6} />}
      <AppText variant="small" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
