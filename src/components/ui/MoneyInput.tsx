import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { type Cents, formatBRL, parseMoneyInput } from '@/domain';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export interface MoneyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: Cents;
  onChangeValue: (value: Cents) => void;
  size?: 'hero' | 'inline';
  label?: string;
}

/** Bank-style money input: digits fill from the right (R$ 0,01 -> R$ 0,12 -> R$ 1,20). */
export function MoneyInput({ value, onChangeValue, size = 'inline', label = 'Valor', style, ...rest }: MoneyInputProps) {
  const hero = size === 'hero';
  return (
    <View style={[styles.row, !hero && styles.inline]}>
      <AppText variant={hero ? 'h2' : 'caption'} color={hero ? 'textSecondary' : 'textMuted'}>
        R$
      </AppText>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        inputMode="numeric"
        value={formatBRL(value, { symbol: false })}
        onChangeText={(text) => onChangeValue(parseMoneyInput(text))}
        selectionColor={colors.primary}
        style={[hero ? styles.hero : styles.inlineInput, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  inline: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    minWidth: 110,
  },
  hero: {
    fontFamily: fontFamily.extrabold,
    fontSize: 44,
    letterSpacing: -1,
    color: colors.brand,
    minWidth: 120,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  inlineInput: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
    minWidth: 70,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
