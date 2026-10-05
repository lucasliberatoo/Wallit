import { useLocalSearchParams } from 'expo-router';
import { Copy, KeyRound, Trash2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Chip,
  Divider,
  ErrorState,
  IconButton,
  LoadingState,
  SectionHeader,
  Surface,
  TextField,
} from '@/components/ui';
import { errorMessage } from '@/data';
import { can, ROLE_LABEL, type Role } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { InviteShare } from '@/features/families/InviteShare';
import { useAddMember, useCreateInvite, useFamily, useMembers, useRemoveMember, useUpdateMemberRole } from '@/features/families/hooks';
import { makeStyles, spacing, useTheme } from '@/theme';

const ROLES: Role[] = ['owner', 'titular', 'member', 'guest'];
const ROLE_HINT: Record<Role, string> = {
  owner: 'Gerencia a família, membros e carteiras',
  titular: 'Administra os cartões que possui',
  member: 'Registra e acompanha compras',
  guest: 'Acesso limitado, só visualiza',
};

export default function MembersScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const family = useFamily(familyId);
  const members = useMembers(familyId);
  const addMember = useAddMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const invite = useCreateInvite();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');

  if (family.isLoading || members.isLoading) return <LoadingState />;
  if (!family.data) return <ErrorState message={errorMessage(family.error)} />;
  const canManage = can(family.data.me.role, 'member.manage');

  const submit = () =>
    addMember.mutate(
      { familyId, displayName: name, role },
      {
        onSuccess: () => {
          setName('');
          setRole('member');
        },
      },
    );

  const confirmRemove = (memberId: string, memberName: string) => {
    const run = () => removeMember.mutate(memberId);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${memberName}? O histórico de compras é mantido.`)) run();
    } else {
      Alert.alert(`Remover ${memberName}?`, 'O histórico de compras é mantido.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: run },
      ]);
    }
  };

  return (
    <>
      <PageHeader title="Membros" subtitle={family.data.family.name} />
      <Screen>
        <Surface padded={false} style={styles.list}>
          {members.data?.map((member, index) => (
            <View key={member.id}>
              {index > 0 && <Divider inset={56} />}
              <View style={styles.row}>
                <Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={44} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">
                    {member.displayName}
                    {member.id === family.data.me.id ? ' (você)' : ''}
                  </AppText>
                  <View style={styles.badges}>
                    <Badge label={ROLE_LABEL[member.role]} color={colors.brand} background={colors.brandSoft} />
                    {!member.userId ? <Badge label="Sem conta" color={colors.textSecondary} background={colors.surfaceMuted} /> : null}
                  </View>
                </View>
                {canManage && member.id !== family.data.me.id ? (
                  <IconButton
                    icon={Trash2}
                    accessibilityLabel={`Remover ${member.displayName}`}
                    onPress={() => confirmRemove(member.id, member.displayName)}
                  />
                ) : null}
              </View>
              {canManage && member.id !== family.data.me.id ? (
                <View style={styles.roles}>
                  {ROLES.map((option) => (
                    <Chip
                      key={option}
                      label={ROLE_LABEL[option]}
                      selected={member.role === option}
                      onPress={() => updateRole.mutate({ memberId: member.id, role: option })}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </Surface>

        {canManage ? (
          <>
            <View style={styles.section}>
              <SectionHeader title="Adicionar pessoa" />
              <AppText variant="caption" color="textSecondary">
                Adicione quem não usa o app (como a avó) só pelo nome. Depois essa pessoa pode ser vinculada a uma conta.
              </AppText>
              <TextField label="Nome" placeholder="Ex.: João" value={name} onChangeText={setName} maxLength={30} />
              <View style={styles.roles}>
                {ROLES.map((option) => (
                  <Chip key={option} label={ROLE_LABEL[option]} selected={role === option} onPress={() => setRole(option)} />
                ))}
              </View>
              <AppText variant="small" color="textMuted">
                {ROLE_HINT[role]}
              </AppText>
              <FormError message={addMember.error ? errorMessage(addMember.error) : null} />
              <Button label="Adicionar" icon={UserPlus} onPress={submit} disabled={!name.trim()} loading={addMember.isPending} />
            </View>

            <Surface style={styles.section}>
              <View style={styles.inviteHeader}>
                <KeyRound size={20} color={colors.accent} />
                <AppText variant="h3">Convidar por link ou código</AppText>
              </View>
              <AppText variant="caption" color="textSecondary">
                Envie o link pelo WhatsApp. Quem abrir entra na família depois de entrar ou criar a conta. O código também funciona.
              </AppText>
              {invite.data ? (
                <View style={styles.code}>
                  <AppText variant="h1" color="brand" selectable style={styles.codeText}>
                    {invite.data.code}
                  </AppText>
                  <Copy size={18} color={colors.textMuted} />
                </View>
              ) : null}
              {invite.data ? <InviteShare familyName={family.data.family.name} code={invite.data.code} /> : null}
              <Button
                label={invite.data ? 'Gerar outro convite' : 'Gerar convite'}
                variant="secondary"
                onPress={() => invite.mutate(familyId)}
                loading={invite.isPending}
              />
            </Surface>
          </>
        ) : null}
      </Screen>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  flex: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: spacing.xs },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingBottom: spacing.md },
  section: { gap: spacing.md },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  codeText: { letterSpacing: 4 },
}));
