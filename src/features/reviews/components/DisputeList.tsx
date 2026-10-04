import { CircleAlert, CircleCheck, MessageSquareReply } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Avatar, Button } from '@/components/ui';
import type { DisputeView } from '@/data';
import { DISPUTE_REASON_LABEL } from '@/domain';
import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/dates';

export interface DisputeListProps {
  disputes: DisputeView[];
  /** Shows "Responder" on open disputes. */
  canResolve: boolean;
  onResolve: (dispute: DisputeView) => void;
}

/** Disputes about one purchase, with the holder's answers. */
export function DisputeList({ disputes, canResolve, onResolve }: DisputeListProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {disputes.map(({ review, member }) => {
        const open = review.status === 'disputed';
        return (
          <View key={review.id} style={[styles.item, open ? styles.open : styles.closed]}>
            <View style={styles.row}>
              <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={28} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  {member.displayName}: {review.reason ? DISPUTE_REASON_LABEL[review.reason] : 'Contestou'}
                </AppText>
                <AppText variant="small" color="textMuted">
                  {formatDateTime(review.createdAt)}
                </AppText>
              </View>
              {open ? <CircleAlert size={18} color={colors.danger} /> : <CircleCheck size={18} color={colors.success} />}
            </View>
            {review.note ? <AppText variant="body">“{review.note}”</AppText> : null}
            {review.resolutionNote ? (
              <View style={styles.answer}>
                <AppText variant="caption" color="textSecondary">
                  Resposta
                </AppText>
                <AppText variant="body">{review.resolutionNote}</AppText>
              </View>
            ) : null}
            {open && canResolve ? (
              <Button label="Responder" icon={MessageSquareReply} variant="secondary" onPress={() => onResolve({ review, member })} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: spacing.sm },
  item: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  open: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  closed: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 1 },
  answer: { gap: 2, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.success },
}));
