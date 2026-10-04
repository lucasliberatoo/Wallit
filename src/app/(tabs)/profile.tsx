import { router } from 'expo-router';
import { Download, History, KeyRound, LogOut, RefreshCcw, Shapes, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { GradientHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, ListRow, Surface, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { useCurrentUser, useSignOut, useUpdateProfile } from '@/features/auth/hooks';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useRepositories } from '@/providers/RepositoriesProvider';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const user = useCurrentUser();
  const signOut = useSignOut();
  const update = useUpdateProfile();
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [pixKey, setPixKey] = useState(user?.pixKey ?? '');
  const dirty = name.trim() !== user?.name || pixKey.trim() !== (user?.pixKey ?? '');

  const resetDemo = async () => {
    const run = async () => {
      await repositories.reset?.();
      await queryClient.resetQueries();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Restaurar os dados de exemplo? Tudo que você criou será apagado.')) await run();
    } else {
      Alert.alert('Restaurar dados de exemplo?', 'Tudo que você criou será apagado.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', style: 'destructive', onPress: run },
      ]);
    }
  };

  return (
    <Screen
      withTabBar
      header={
        <GradientHeader>
          <View style={styles.header}>
            <ProfilePhoto user={user} />
            <View style={styles.flex}>
              <AppText variant="h2" color="brand">
                {user?.name}
              </AppText>
              <AppText variant="body" color="brand">
                {user?.email}
              </AppText>
            </View>
          </View>
        </GradientHeader>
      }>
      <Surface style={styles.form}>
        <AppText variant="h3">Seus dados</AppText>
        <TextField label="Nome" value={name} onChangeText={setName} maxLength={40} />
        <TextField
          label="Chave PIX (opcional)"
          placeholder="Email, celular, CPF ou chave aleatória"
          hint="Quando você for titular, a família vê essa chave para te pagar."
          value={pixKey}
          onChangeText={setPixKey}
          autoCapitalize="none"
        />
        {update.error ? (
          <AppText variant="caption" color="danger">
            {errorMessage(update.error)}
          </AppText>
        ) : null}
        <Button
          label="Salvar"
          disabled={!dirty || !name.trim()}
          loading={update.isPending}
          onPress={() => update.mutate({ name: name.trim(), pixKey: pixKey.trim() || undefined })}
        />
      </Surface>

      <Surface padded={false} style={styles.menu}>
        <ListRow
          title="Histórico"
          subtitle="Pesquise compras antigas"
          leading={<History size={20} color={colors.primary} />}
          onPress={() => router.push('/history')}
        />
        <Divider inset={spacing.lg + 32} />
        <ListRow title="Categorias" leading={<Shapes size={20} color={colors.primary} />} onPress={() => router.push('/categories')} />
        <Divider inset={spacing.lg + 32} />
        <ListRow
          title="Entrar em uma família"
          subtitle="Usar código de convite"
          leading={<KeyRound size={20} color={colors.primary} />}
          onPress={() => router.push('/family/join')}
        />
        {Platform.OS === 'web' ? (
          <>
            <Divider inset={spacing.lg + 32} />
            <ListRow
              title="Baixar o app"
              subtitle="Android ou tela inicial do iPhone"
              leading={<Download size={20} color={colors.primary} />}
              onPress={() => router.push('/baixar')}
            />
          </>
        ) : null}
        <Divider inset={spacing.lg + 32} />
        <ListRow
          title="Segurança"
          subtitle="O Wallit nunca guarda número, CVV ou senha de cartão"
          leading={<ShieldCheck size={20} color={colors.success} />}
          showChevron={false}
        />
      </Surface>

      <View style={styles.actions}>
        {repositories.reset ? (
          <Button label="Restaurar dados de exemplo" icon={RefreshCcw} variant="ghost" onPress={resetDemo} />
        ) : null}
        <Button
          label="Sair da conta"
          icon={LogOut}
          variant="danger"
          onPress={() => signOut.mutate(undefined)}
          loading={signOut.isPending}
        />
      </View>

      <View style={styles.brand}>
        <Logo size={40} />
        <AppText variant="small" color="textMuted">
          Wallit · versão de desenvolvimento
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  form: { gap: spacing.md },
  menu: { paddingHorizontal: spacing.lg },
  actions: { gap: spacing.sm },
  brand: { alignItems: 'center', gap: spacing.sm },
});
