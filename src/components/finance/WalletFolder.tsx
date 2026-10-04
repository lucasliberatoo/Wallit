import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, WalletCards } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { type Card, type Cents, formatBRL } from '@/domain';
import { cardThemes, colors, radius, shadows, spacing } from '@/theme';

export interface WalletFolderProps {
  name: string;
  cards: Pick<Card, 'id' | 'name' | 'theme'>[];
  totalCents: Cents;
  onPress?: () => void;
}

/**
 * Wallet drawn as a folder with a tab, with its cards peeking out, inspired
 * by the original prototype.
 */
export function WalletFolder({ name, cards, totalCents, onPress }: WalletFolderProps) {
  const visible = cards.slice(0, 3);
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityLabel={`${name}, ${cards.length} cartões`}>
      <View style={styles.tab}>
        <WalletCards size={14} color={colors.brand} />
        <AppText variant="small" color="brand" numberOfLines={1}>
          {name}
        </AppText>
      </View>
      <View style={styles.folder}>
        <View style={styles.cards}>
          {visible.length === 0 ? (
            <View style={[styles.miniCard, styles.emptyCard]}>
              <AppText variant="small" color="textMuted">
                Sem cartões
              </AppText>
            </View>
          ) : (
            visible.map((card, index) => (
              <LinearGradient
                key={card.id}
                colors={cardThemes[card.theme].colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.miniCard,
                  { left: index * 22, top: index * 6, zIndex: 3 - index, transform: [{ rotate: `${-4 + index * 4}deg` }] },
                ]}>
                {index === 0 ? (
                  <AppText variant="small" color={cardThemes[card.theme].text} numberOfLines={1}>
                    {card.name}
                  </AppText>
                ) : null}
              </LinearGradient>
            ))
          )}
        </View>
        <View style={styles.info}>
          <AppText variant="caption" color="textSecondary">
            {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'}
          </AppText>
          <AppText variant="h3">{formatBRL(totalCents)}</AppText>
          <AppText variant="small" color="textMuted">
            nas faturas atuais
          </AppText>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.lg,
    maxWidth: '70%',
  },
  folder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderTopLeftRadius: 0,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  cards: { width: 140, height: 82 },
  miniCard: {
    position: 'absolute',
    width: 96,
    height: 62,
    borderRadius: radius.sm + 2,
    padding: spacing.sm,
    justifyContent: 'flex-end',
    ...shadows.sm,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  info: { flex: 1, gap: 2 },
});
