import { CircleAlert, CircleCheck, Clock } from 'lucide-react-native';

import { Badge } from '@/components/ui';
import type { LineReview } from '@/data';
import { useTheme } from '@/theme';

/** Where one purchase stands in the review, always icon + text. */
export function ReviewBadge({ review }: { review: LineReview }) {
  const { colors } = useTheme();
  if (review.status === 'disputed') {
    return <Badge label="Contestada" icon={CircleAlert} color={colors.danger} background={colors.dangerSoft} />;
  }
  if (review.status === 'confirmed') {
    return <Badge label="Conferida" icon={CircleCheck} color={colors.success} background={colors.successSoft} />;
  }
  const label = review.awaitingMe ? 'Falta você conferir' : `Aguardando ${review.pendingMembers.map((m) => m.displayName).join(', ')}`;
  return <Badge label={label} icon={Clock} color={colors.warning} background={colors.warningSoft} />;
}
