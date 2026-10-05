import { Link, router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, KeyRound } from 'lucide-react-native';
import { Controller } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { FormError } from '@/features/auth/FormError';
import { useResetPassword } from '@/features/auth/hooks';
import { newPasswordSchema } from '@/features/auth/schemas';
import { useZodForm } from '@/lib/form';
import { fontFamily, makeStyles, spacing, useTheme } from '@/theme';

/** Opened from the password reset email: `/redefinir-senha?token=…`. */
export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const reset = useResetPassword();
  const form = useZodForm(newPasswordSchema, { defaultValues: { password: '', confirm: '' } });
  const token = params.token;
  const submit = form.handleSubmit((values) => token && reset.mutate({ token, password: values.password }));
  const footer = (
    <Link href="/forgot-password" style={styles.link}>
      Pedir um novo link
    </Link>
  );

  if (!token || params.error) {
    return (
      <AuthScaffold title="Link inválido" subtitle="Este link expirou ou já foi usado." footer={footer}>
        <AppText variant="body" color="textSecondary" align="center">
          Peça um novo link em &quot;Esqueci minha senha&quot;. Ele vale por 1 hora.
        </AppText>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title="Nova senha" subtitle="Escolha uma senha nova para entrar no Wallit." footer={reset.isSuccess ? undefined : footer}>
      {reset.isSuccess ? (
        <View style={styles.success}>
          <CircleCheck size={32} color={colors.success} />
          <AppText variant="bodyStrong" align="center">
            Senha trocada! Agora é só entrar com a nova senha.
          </AppText>
          <Button label="Ir para o login" onPress={() => router.replace('/login')} />
        </View>
      ) : (
        <>
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField
                label="Nova senha"
                placeholder="Ao menos 6 caracteres"
                secureTextEntry
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="confirm"
            render={({ field, fieldState }) => (
              <TextField
                label="Repita a nova senha"
                secureTextEntry
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={submit}
                error={fieldState.error?.message}
              />
            )}
          />
          <FormError message={reset.error ? errorMessage(reset.error) : null} />
          <Button label="Salvar nova senha" icon={KeyRound} size="lg" onPress={submit} loading={reset.isPending} />
        </>
      )}
    </AuthScaffold>
  );
}

const useStyles = makeStyles((colors) => ({
  link: { color: colors.primary, fontFamily: fontFamily.semibold },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
}));
