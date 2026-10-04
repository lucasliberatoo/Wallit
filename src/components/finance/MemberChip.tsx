import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import type { FamilyMember, MemberPaymentStatus } from '@/domain';
import { spacing, useTheme } from '@/theme';
import { PAYMENT_STATUS_LABEL, paymentStatusStyle } from './StatusBadges';

export interface MemberChipProps {
  member: Pick<FamilyMember, 'displayName' | 'avatarColor' | 'nickname' | 'photo'>;
  status?: MemberPaymentStatus;
  caption?: string;
  isMe?: boolean;
}

/** Avatar with a status ring (prototype idea) plus name and caption. */
export function MemberChip({ member, status, caption, isMe }: MemberChipProps) {
  const { colors } = useTheme();
  const ring = status ? paymentStatusStyle(status, colors).color : undefined;
  return (
    <View style={styles.item} accessible accessibilityLabel={`${member.displayName}${status ? `, ${PAYMENT_STATUS_LABEL[status]}` : ''}`}>
      <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={56} ringColor={ring} />
      <AppText variant="caption" numberOfLines={1}>
        {isMe ? 'Você' : member.displayName}
      </AppText>
      {caption ? (
        <AppText variant="small" color="textSecondary" numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', width: 72, gap: spacing.xxs },
});
