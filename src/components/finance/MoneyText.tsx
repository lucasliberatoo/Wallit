import { AppText, type AppTextProps } from '@/components/ui';
import { type Cents } from '@/domain';
import { useMoneyFormatter } from '@/lib/money-visibility';

export interface MoneyTextProps extends Omit<AppTextProps, 'children'> {
  value: Cents;
}

export function MoneyText({ value, variant = 'money', ...rest }: MoneyTextProps) {
  const formatBRL = useMoneyFormatter();
  return (
    <AppText variant={variant} {...rest}>
      {formatBRL(value)}
    </AppText>
  );
}
