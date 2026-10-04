import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import type { FamilyMember, MemberPaymentStatus } from '@/domain';
import { spacing } from '@/theme';
import { PAYMENT_STATUS } from './StatusBadges';

export interface MemberChipProps {
  member: Pick<FamilyMember, 'displayName' | 'avatarColor' | 'nickname'>;
  status?: MemberPaymentStatus;
  caption?: string;
  isMe?: boolean;
}

/** Avatar with a status ring (prototype idea) plus name and caption. */
export function MemberChip({ member, status, caption, isMe }: MemberChipProps) {
  const ring = status ? PAYMENT_STATUS[status].color : undefined;
  return (
    <View style={styles.item} accessible accessibilityLabel={`${member.displayName}${status ? `, ${PAYMENT_STATUS[status].label}` : ''}`}>
      <Avatar name={member.displayName} color={member.avatarColor} size={56} ringColor={ring} />
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
