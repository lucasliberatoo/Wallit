import { Link } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { Controller } from 'react-hook-form';

import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { FormError } from '@/features/auth/FormError';
import { useSignUp } from '@/features/auth/hooks';
import { signUpSchema } from '@/features/auth/schemas';
import { useZodForm } from '@/lib/form';
import { fontFamily, makeStyles } from '@/theme';

export default function SignUpScreen() {
  const styles = useStyles();
  const signUp = useSignUp();
  const form = useZodForm(signUpSchema, { defaultValues: { name: '', email: '', password: '' } });
  const submit = form.handleSubmit((values) => signUp.mutate(values));

  return (
    <AuthScaffold
      title="Criar conta"
      subtitle="Organize o cartão compartilhado em poucos toques."
      footer={
        <AppText variant="body" color="textSecondary">
          Já tem conta?{' '}
          <Link href="/login" style={styles.link}>
            Entrar
          </Link>
        </AppText>
      }>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label="Nome"
            placeholder="Como te chamam"
            autoComplete="name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            placeholder="voce@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
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
            placeholder="Mínimo de 6 caracteres"
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
      <FormError message={signUp.error ? errorMessage(signUp.error) : null} />
      <Button label="Criar conta" icon={UserPlus} size="lg" onPress={submit} loading={signUp.isPending} />
    </AuthScaffold>
  );
}

const useStyles = makeStyles((colors) => ({
  link: { color: colors.primary, fontFamily: fontFamily.semibold },
}));
