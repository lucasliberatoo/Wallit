import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  Crown,
  HandCoins,
  Lock,
  type LucideIcon,
  Minus,
  SearchCheck,
} from 'lucide-react-native';

import { Badge } from '@/components/ui';
import { INVOICE_STATUS_LABEL, type InvoiceStatus, type MemberPaymentStatus } from '@/domain';
import { colors, palette } from '@/theme';

const invoiceStyles: Record<InvoiceStatus, { color: string; background: string; icon: LucideIcon }> = {
  open: { color: colors.primary, background: colors.primarySoft, icon: CircleDot },
  reviewing: { color: colors.warning, background: colors.warningSoft, icon: SearchCheck },
  closed: { color: colors.success, background: colors.successSoft, icon: Lock },
  collecting: { color: palette.navy700, background: palette.blue50, icon: HandCoins },
  paid: { color: colors.textOnDark, background: palette.gray700, icon: CircleCheck },
  archived: { color: colors.textSecondary, background: colors.surfaceMuted, icon: Archive },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const style = invoiceStyles[status];
  return <Badge label={INVOICE_STATUS_LABEL[status]} {...style} />;
}

export const PAYMENT_STATUS: Record<MemberPaymentStatus, { label: string; color: string; background: string; icon: LucideIcon }> = {
  paid: { label: 'Pago', color: colors.success, background: colors.successSoft, icon: CircleCheck },
  partial: { label: 'Parcial', color: colors.warning, background: colors.warningSoft, icon: CircleDashed },
  pending: { label: 'Pendente', color: colors.danger, background: colors.dangerSoft, icon: Clock },
  none: { label: 'Sem gastos', color: colors.textSecondary, background: colors.surfaceMuted, icon: Minus },
  holder: { label: 'Titular', color: palette.navy700, background: palette.yellow100, icon: Crown },
};

export function PaymentStatusBadge({ status }: { status: MemberPaymentStatus }) {
  const { label, ...style } = PAYMENT_STATUS[status];
  return <Badge label={label} {...style} />;
}
