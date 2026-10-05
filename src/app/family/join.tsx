import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useJoinFamily } from '@/features/families/hooks';

export default function JoinFamilyScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code?.toUpperCase() ?? '');
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
          {params.code
            ? 'Confira o código do convite e toque em "Entrar na família".'
            : 'Peça o link ou o código de convite para o dono da família e digite abaixo.'}
        </AppText>
        <TextField
          label="Código"
          placeholder="EX: A1B2C3"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          autoFocus={!params.code}
          maxLength={8}
        />
        <FormError message={join.error ? errorMessage(join.error) : null} />
      </Screen>
    </>
  );
}
