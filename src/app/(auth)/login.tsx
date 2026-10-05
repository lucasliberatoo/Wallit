import { Link } from 'expo-router';
import { LogIn, Sparkles } from 'lucide-react-native';
import { Controller } from 'react-hook-form';
import { Platform, View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import { DEMO_ACCOUNT, errorMessage } from '@/data';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { usePendingInviteStore } from '@/stores/pending-invite-store';
import { FormError } from '@/features/auth/FormError';
import { useSignIn } from '@/features/auth/hooks';
import { signInSchema } from '@/features/auth/schemas';
import { useZodForm } from '@/lib/form';
import { fontFamily, makeStyles, spacing } from '@/theme';

export default function LoginScreen() {
  const styles = useStyles();
  const signIn = useSignIn();
  const hasInvite = Boolean(usePendingInviteStore((state) => state.code));
  const form = useZodForm(signInSchema, { defaultValues: { email: '', password: '' } });

  const submit = form.handleSubmit((values) => signIn.mutate(values));

  return (
    <AuthScaffold
      title="Bem-vindo de volta"
      subtitle={
        hasInvite
          ? 'Você recebeu um convite. Entre ou crie sua conta para entrar na família.'
          : 'Quem compra registra. Quem deve acompanha.'
      }
      footer={
        <View style={styles.footer}>
          <AppText variant="body" color="textSecondary">
            Ainda não tem conta?{' '}
            <Link href="/signup" style={styles.link}>
              Criar conta
            </Link>
          </AppText>
          {Platform.OS === 'web' ? (
            <Link href="/baixar" style={styles.link}>
              Baixar o app no celular
            </Link>
          ) : null}
        </View>
      }>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="Senha"
            placeholder="Sua senha"
            secureTextEntry
            autoComplete="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={submit}
            error={fieldState.error?.message}
          />
        )}
      />
      <Link href="/forgot-password" style={[styles.link, styles.forgot]}>
        Esqueci minha senha
      </Link>
      <FormError message={signIn.error ? errorMessage(signIn.error) : null} />
      <View style={styles.actions}>
        <Button label="Entrar" icon={LogIn} size="lg" onPress={submit} loading={signIn.isPending} />
        <Button
          label="Entrar com a conta de demonstração"
          icon={Sparkles}
          variant="ghost"
          onPress={() => signIn.mutate(DEMO_ACCOUNT)}
          disabled={signIn.isPending}
        />
      </View>
    </AuthScaffold>
  );
}

const useStyles = makeStyles((colors) => ({
  link: { color: colors.primary, fontFamily: fontFamily.semibold },
  forgot: { alignSelf: 'flex-end', fontSize: 13 },
  actions: { gap: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm },
}));
