import { ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText, Avatar, Chip, SectionHeader, Surface } from '@/components/ui';
import { type CardSummary, errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useFamily, useMembers } from '@/features/families/hooks';
import { makeStyles, spacing, useTheme } from '@/theme';
import { useSetModerators } from './hooks';

/**
 * Moderators: people the holder picks to manage the card with the same powers
 * (review and close invoices, confirm payments, answer disputes).
 */
export function ModeratorsSection({ summary }: { summary: CardSummary }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { card, holder } = summary;
  const family = useFamily(card.familyId);
  const members = useMembers(card.familyId);
  const save = useSetModerators(card.id);
  const me = family.data?.me;
  if (!me || !members.data) return null;

  const moderatorIds = save.isPending && save.variables ? save.variables : (card.moderatorMemberIds ?? []);
  const canChoose = me.id === holder.id || me.role === 'owner';
  const candidates = members.data.filter((m) => m.status === 'active' && m.id !== holder.id && m.role !== 'guest');
  const moderators = candidates.filter((m) => moderatorIds.includes(m.id));
  if (!canChoose && moderators.length === 0) return null;

  const toggle = (memberId: string) =>
    save.mutate(moderatorIds.includes(memberId) ? moderatorIds.filter((id) => id !== memberId) : [...moderatorIds, memberId]);

  return (
    <View>
      <SectionHeader title="Moderadores" />
      <Surface style={styles.box}>
        <View style={styles.row}>
          <ShieldCheck size={18} color={colors.primary} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            {canChoose
              ? `Quem você marcar pode fazer tudo o que ${me.id === holder.id ? 'você faz' : `${holder.displayName} faz`} neste cartão: conferir e fechar faturas, confirmar pagamentos e responder contestações.`
              : `Ajudam ${holder.displayName} a cuidar deste cartão, com os mesmos poderes.`}
          </AppText>
        </View>
        {canChoose ? (
          candidates.length ? (
            <View style={styles.chips}>
              {candidates.map((member) => (
                <Chip
                  key={member.id}
                  label={member.displayName}
                  selected={moderatorIds.includes(member.id)}
                  onPress={() => toggle(member.id)}
                  leading={<Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={22} />}
                />
              ))}
            </View>
          ) : (
            <AppText variant="caption" color="textMuted">
              Adicione pessoas à família para escolher moderadores.
            </AppText>
          )
        ) : (
          <View style={styles.chips}>
            {moderators.map((member) => (
              <Chip key={member.id} label={member.displayName} selected />
            ))}
          </View>
        )}
        <FormError message={save.error ? errorMessage(save.error) : null} />
      </Surface>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  box: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
