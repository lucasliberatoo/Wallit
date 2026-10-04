import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useCreateWallet } from '@/features/wallets/hooks';

export default function NewWalletScreen() {
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const [name, setName] = useState('');
  const create = useCreateWallet();

  return (
    <>
      <PageHeader title="Nova carteira" />
      <Screen
        footer={
          <Button
            label="Criar carteira"
            size="lg"
            disabled={!name.trim()}
            loading={create.isPending}
            onPress={() => create.mutate({ familyId, name }, { onSuccess: (wallet) => router.replace(`/wallet/${wallet.id}`) })}
          />
        }>
        <AppText variant="body" color="textSecondary">
          Use carteiras para organizar conjuntos de cartões, como “Carteira da Família” ou “Cartões da Viagem”.
        </AppText>
        <TextField label="Nome" placeholder="Carteira da Família" value={name} onChangeText={setName} autoFocus maxLength={40} />
        <FormError message={create.error ? errorMessage(create.error) : null} />
      </Screen>
    </>
  );
}
