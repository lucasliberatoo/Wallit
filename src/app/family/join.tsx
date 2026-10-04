import { router } from 'expo-router';
import { useState } from 'react';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useJoinFamily } from '@/features/families/hooks';

export default function JoinFamilyScreen() {
  const [code, setCode] = useState('');
  const join = useJoinFamily();

  return (
    <>
      <PageHeader title="Entrar com convite" />
      <Screen
        footer={
          <Button
            label="Entrar na família"
            size="lg"
            disabled={code.trim().length < 4}
            loading={join.isPending}
            onPress={() => join.mutate(code, { onSuccess: (family) => router.replace(`/family/${family.id}`) })}
          />
        }>
        <AppText variant="body" color="textSecondary">
          Peça o código de convite para o dono da família e digite abaixo.
        </AppText>
        <TextField
          label="Código"
          placeholder="EX: A1B2C3"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          autoFocus
          maxLength={8}
        />
        <FormError message={join.error ? errorMessage(join.error) : null} />
      </Screen>
    </>
  );
}
