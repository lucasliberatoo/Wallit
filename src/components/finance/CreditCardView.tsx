import { LinearGradient } from 'expo-linear-gradient';
import { Nfc } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { type Card, type Cents, formatBRL } from '@/domain';
import { cardThemes, radius, shadows, spacing } from '@/theme';

const BRAND_LABEL: Record<NonNullable<Card['brand']>, string> = {
  visa: 'VISA',
  mastercard: 'mastercard',
  elo: 'elo',
  amex: 'AMEX',
  hipercard: 'Hipercard',
  other: '',
};

export interface CreditCardViewProps {
  card: Pick<Card, 'name' | 'theme' | 'brand'>;
  holderName: string;
  amountCents?: Cents;
  amountLabel?: string;
  width?: number;
  onPress?: () => void;
}

/** Physical-card representation. Shows no card number, only a nickname. */
export function CreditCardView({ card, holderName, amountCents, amountLabel = 'Fatura atual', width = 280, onPress }: CreditCardViewProps) {
  const theme = cardThemes[card.theme];
  const height = width * 0.62;
  const body = (
    <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { width, height }]}>
      <View style={[styles.glow, { width: width * 0.9, height: width * 0.9, right: -width * 0.45, top: -width * 0.5 }]} />
      <View style={[styles.glow, styles.glowSmall, { width: width * 0.5, height: width * 0.5, left: -width * 0.2, bottom: -width * 0.3 }]} />
      <View style={styles.top}>
        <AppText variant="bodyStrong" color={theme.text} numberOfLines={1} style={styles.flex}>
          {card.name}
        </AppText>
        <Nfc size={20} color={theme.text} strokeWidth={2} />
      </View>
      <View style={styles.chip} />
      <View style={styles.bottom}>
        <View style={styles.flex}>
          {amountCents !== undefined ? (
            <>
              <AppText variant="small" color={theme.text} style={styles.dim}>
                {amountLabel}
              </AppText>
              <AppText variant="h2" color={theme.text}>
                {formatBRL(amountCents)}
              </AppText>
            </>
          ) : null}
          <AppText variant="small" color={theme.text} style={styles.dim} numberOfLines={1}>
            Titular: {holderName}
          </AppText>
        </View>
        {card.brand ? (
          <AppText variant="bodyStrong" color={theme.text} style={styles.brand}>
            {BRAND_LABEL[card.brand]}
          </AppText>
        ) : null}
      </View>
    </LinearGradient>
  );

  if (!onPress) return <View style={[styles.shadow, { borderRadius: radius.xl }]}>{body}</View>;
  return (
    <PressableScale onPress={onPress} style={[styles.shadow, { borderRadius: radius.xl }]} accessibilityLabel={`${card.name}, titular ${holderName}`}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: shadows.md,
  card: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', justifyContent: 'space-between' },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  glowSmall: { backgroundColor: 'rgba(255,255,255,0.06)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { width: 36, height: 26, borderRadius: 6, backgroundColor: 'rgba(255,214,0,0.85)' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
  dim: { opacity: 0.8 },
  brand: { fontStyle: 'italic', letterSpacing: 0.5 },
});
