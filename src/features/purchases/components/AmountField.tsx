import { StyleSheet, View } from 'react-native';

import { AppText, MoneyInput, SegmentedControl } from '@/components/ui';
import { type Cents, formatBRL } from '@/domain';
import { spacing } from '@/theme';
import type { AmountMode } from '../use-purchase-form';

export interface AmountFieldProps {
  mode: AmountMode;
  onModeChange: (mode: AmountMode) => void;
  totalCents: Cents;
  installmentCents: Cents;
  installmentCount: number;
  onChangeTotal: (value: Cents) => void;
  onChangeInstallment: (value: Cents) => void;
  autoFocus?: boolean;
}

/** Purchase amount, typed as the total or as the value of each installment. */
export function AmountField({
  mode,
  onModeChange,
  totalCents,
  installmentCents,
  installmentCount,
  onChangeTotal,
  onChangeInstallment,
  autoFocus,
}: AmountFieldProps) {
  const byInstallment = mode === 'installment';
  const label = byInstallment ? 'Valor de cada parcela' : 'Valor da compra';
  return (
    <View style={styles.hero}>
      <View style={styles.stretch}>
        <SegmentedControl<AmountMode>
          options={[
            { value: 'total', label: 'Valor total' },
            { value: 'installment', label: 'Valor da parcela' },
          ]}
          value={mode}
          onChange={onModeChange}
        />
      </View>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <MoneyInput
        value={byInstallment ? installmentCents : totalCents}
        onChangeValue={byInstallment ? onChangeInstallment : onChangeTotal}
        size="hero"
        label={label}
        autoFocus={autoFocus}
      />
      {byInstallment && installmentCents > 0 ? (
        <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {installmentCount === 1
            ? 'À vista'
            : `${installmentCount}x de ${formatBRL(installmentCents)} = ${formatBRL(totalCents)} no total`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, alignSelf: 'stretch' },
  stretch: { alignSelf: 'stretch' },
});
