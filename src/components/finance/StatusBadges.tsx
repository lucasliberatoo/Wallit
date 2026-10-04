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
import { type ThemeColors, useTheme } from '@/theme';

interface StatusStyle {
  color: string;
  background: string;
  icon: LucideIcon;
}

function invoiceStatusStyle(status: InvoiceStatus, colors: ThemeColors): StatusStyle {
  switch (status) {
    case 'open':
      return { color: colors.primary, background: colors.primarySoft, icon: CircleDot };
    case 'reviewing':
      return { color: colors.warning, background: colors.warningSoft, icon: SearchCheck };
    case 'closed':
      return { color: colors.success, background: colors.successSoft, icon: Lock };
    case 'collecting':
      return { color: colors.brand, background: colors.brandSoft, icon: HandCoins };
    case 'paid':
      return { color: colors.onNeutralStrong, background: colors.neutralStrong, icon: CircleCheck };
    case 'archived':
      return { color: colors.textSecondary, background: colors.surfaceMuted, icon: Archive };
  }
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { colors } = useTheme();
  return <Badge label={INVOICE_STATUS_LABEL[status]} {...invoiceStatusStyle(status, colors)} />;
}

export const PAYMENT_STATUS_LABEL: Record<MemberPaymentStatus, string> = {
  paid: 'Pago',
  partial: 'Parcial',
  pending: 'Pendente',
  none: 'Sem gastos',
  holder: 'Titular',
};

export function paymentStatusStyle(status: MemberPaymentStatus, colors: ThemeColors): StatusStyle {
  switch (status) {
    case 'paid':
      return { color: colors.success, background: colors.successSoft, icon: CircleCheck };
    case 'partial':
      return { color: colors.warning, background: colors.warningSoft, icon: CircleDashed };
    case 'pending':
      return { color: colors.danger, background: colors.dangerSoft, icon: Clock };
    case 'none':
      return { color: colors.textSecondary, background: colors.surfaceMuted, icon: Minus };
    case 'holder':
      return { color: colors.primary, background: colors.primarySoft, icon: Crown };
  }
}

export function PaymentStatusBadge({ status }: { status: MemberPaymentStatus }) {
  const { colors } = useTheme();
  return <Badge label={PAYMENT_STATUS_LABEL[status]} {...paymentStatusStyle(status, colors)} />;
}
