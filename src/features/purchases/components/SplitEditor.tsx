import { CircleAlert, CircleCheck, Divide } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppText, Avatar, Button, MoneyInput, PressableScale } from '@/components/ui';
import { describeSplit, type FamilyMember, type ShareInput, type SplitValidation } from '@/domain';
import { colors, radius, spacing } from '@/theme';

export interface SplitEditorProps {
  members: FamilyMember[];
  shares: ShareInput[];
  validation: SplitValidation;
  onTogglePayer: (memberId: string) => void;
  onChangeAmount: (memberId: string, value: number) => void;
  onSplitEqually: () => void;
  onFillRemaining: (memberId: string) => void;
}

/**
 * "Quem paga": pick one or more people and set each amount. The save button
 * stays disabled until the shares add up exactly to the purchase total.
 */
export function SplitEditor({
  members,
  shares,
  validation,
  onTogglePayer,
  onChangeAmount,
  onSplitEqually,
  onFillRemaining,
}: SplitEditorProps) {
  const selectedIds = new Set(shares.map((s) => s.memberId));
  const complete = validation.status === 'complete';
  const showStatus = validation.total > 0 && shares.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.people}>
        {members.map((member) => {
          const selected = selectedIds.has(member.id);
          return (
            <PressableScale
              key={member.id}
              haptic
              onPress={() => onTogglePayer(member.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${member.displayName} paga`}
              style={[styles.person, selected && styles.personSelected]}>
              <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={28} />
              <AppText variant="caption" color={selected ? 'brand' : 'textSecondary'}>
                {member.displayName}
              </AppText>
              {selected ? <CircleCheck size={16} color={colors.primary} /> : null}
            </PressableScale>
          );
        })}
      </View>

      {shares.length > 1 ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.amounts}>
          {shares.map((share) => {
            const member = members.find((m) => m.id === share.memberId);
            if (!member) return null;
            return (
              <Animated.View key={share.memberId} layout={LinearTransition} style={styles.amountRow}>
                <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={32} />
                <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {member.displayName}
                </AppText>
                {validation.difference > 0 ? (
                  <PressableScale
                    onPress={() => onFillRemaining(member.id)}
                    accessibilityLabel={`Completar com ${member.displayName}`}
                    hitSlop={6}>
                    <AppText variant="small" color="primary">
                      completar
                    </AppText>
                  </PressableScale>
                ) : null}
                <MoneyInput
                  value={share.amountCents}
                  onChangeValue={(value) => onChangeAmount(member.id, value)}
                  label={`Valor de ${member.displayName}`}
                />
              </Animated.View>
            );
          })}
          <Button label="Dividir igualmente" icon={Divide} variant="ghost" onPress={onSplitEqually} />
        </Animated.View>
      ) : null}

      {showStatus ? (
        <Animated.View
          key={validation.status}
          entering={FadeIn.duration(180)}
          style={[styles.status, complete ? styles.statusOk : styles.statusWarn]}
          accessibilityLiveRegion="polite">
          {complete ? <CircleCheck size={18} color={colors.success} /> : <CircleAlert size={18} color={colors.warning} />}
          <AppText variant="caption" color={complete ? 'success' : 'warning'} style={styles.flex}>
            {describeSplit(validation)}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  personSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  amounts: { gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  statusOk: { backgroundColor: colors.successSoft },
  statusWarn: { backgroundColor: colors.warningSoft },
});
