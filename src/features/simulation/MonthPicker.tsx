import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { addMonths, type InvoiceRef, refKey } from '@/domain';
import { spacing } from '@/theme';
import { shortRef } from './scenario-draft';

/** The next months (invoices), starting at `from`. */
export function MonthPicker({
  from,
  value,
  onChange,
  months = 18,
}: {
  from: InvoiceRef;
  value: string;
  onChange: (key: string) => void;
  months?: number;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {Array.from({ length: months }, (_, index) => addMonths(from, index)).map((ref) => (
        <Chip key={refKey(ref)} label={shortRef(ref)} selected={value === refKey(ref)} onPress={() => onChange(refKey(ref))} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.lg },
});
