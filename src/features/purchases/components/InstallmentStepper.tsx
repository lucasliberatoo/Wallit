import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { type Cents, formatBRL, MAX_INSTALLMENTS } from '@/domain';
import { colors, radius, spacing } from '@/theme';

export interface InstallmentStepperProps {
  count: number;
  installmentValue: Cents;
  onChange: (count: number) => void;
}

export function InstallmentStepper({ count, installmentValue, onChange }: InstallmentStepperProps) {
  return (
    <View style={styles.row}>
      <IconButton icon={Minus} accessibilityLabel="Menos parcelas" onPress={() => onChange(count - 1)} />
      <View style={styles.center} accessibilityLiveRegion="polite">
        <AppText variant="h3">{count === 1 ? 'À vista' : `${count}x`}</AppText>
        {count > 1 && installmentValue > 0 ? (
          <AppText variant="caption" color="textSecondary">
            de {formatBRL(installmentValue)}
          </AppText>
        ) : null}
      </View>
      <IconButton icon={Plus} accessibilityLabel="Mais parcelas" onPress={() => onChange(Math.min(count + 1, MAX_INSTALLMENTS))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.xs },
  center: { flex: 1, alignItems: 'center' },
});
