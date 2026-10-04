import { AppText, type AppTextProps } from '@/components/ui';
import { type Cents, formatBRL } from '@/domain';

export interface MoneyTextProps extends Omit<AppTextProps, 'children'> {
  value: Cents;
}

export function MoneyText({ value, variant = 'money', ...rest }: MoneyTextProps) {
  return (
    <AppText variant={variant} {...rest}>
      {formatBRL(value)}
    </AppText>
  );
}
