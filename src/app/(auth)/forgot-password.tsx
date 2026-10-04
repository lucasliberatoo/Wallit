import { Link } from 'expo-router';
import { MailCheck, Send } from 'lucide-react-native';
import { Controller } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { FormError } from '@/features/auth/FormError';
import { useRequestPasswordReset } from '@/features/auth/hooks';
import { resetSchema } from '@/features/auth/schemas';
import { useZodForm } from '@/lib/form';
import { fontFamily, makeStyles, spacing, useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const reset = useRequestPasswordReset();
  const form = useZodForm(resetSchema, { defaultValues: { email: '' } });
  const submit = form.handleSubmit((values) => reset.mutate(values.email));

  return (
    <AuthScaffold
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={
        <Link href="/login" style={styles.link}>
          Voltar para o login
        </Link>
      }>
      {reset.isSuccess ? (
        <View style={styles.success}>
          <MailCheck size={32} color={colors.success} />
          <AppText variant="bodyStrong" align="center">
            Se existir uma conta com esse email, você vai receber o link em instantes.
          </AppText>
        </View>
      ) : (
        <>
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="Email"
                placeholder="voce@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={submit}
                error={fieldState.error?.message}
              />
            )}
          />
          <FormError message={reset.error ? errorMessage(reset.error) : null} />
          <Button label="Enviar link" icon={Send} size="lg" onPress={submit} loading={reset.isPending} />
        </>
      )}
    </AuthScaffold>
  );
}

const useStyles = makeStyles((colors) => ({
  link: { color: colors.primary, fontFamily: fontFamily.semibold },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
}));
