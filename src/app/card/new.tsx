import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CreditCardView } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Chip, MoneyInput, TextField, Button } from '@/components/ui';
import { errorMessage } from '@/data';
import type { CardBrand, CardTheme } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useCreateCard } from '@/features/cards/hooks';
import { useMembers } from '@/features/families/hooks';
import { useWallet } from '@/features/wallets/hooks';
import { cardThemes, spacing } from '@/theme';

const BRANDS: { value: CardBrand; label: string }[] = [
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'visa', label: 'Visa' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'Amex' },
  { value: 'hipercard', label: 'Hipercard' },
];

function parseDay(text: string): number {
  const value = Number(text.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 0;
}

export default function NewCardScreen() {
  const { walletId } = useLocalSearchParams<{ walletId: string }>();
  const wallet = useWallet(walletId);
  const familyId = wallet.data?.wallet.familyId;
  const members = useMembers(familyId);
  const create = useCreateCard();

  const [name, setName] = useState('');
  const [holderId, setHolderId] = useState<string | null>(null);
  const [theme, setTheme] = useState<CardTheme>('midnight');
  const [brand, setBrand] = useState<CardBrand | undefined>();
  const [limit, setLimit] = useState(0);
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');

  const holder = members.data?.find((m) => m.id === holderId);
  const closing = parseDay(closingDay);
  const due = parseDay(dueDay);
  const validDays = closing >= 1 && closing <= 31 && due >= 1 && due <= 31;
  const canSubmit = name.trim() && holderId && validDays;

  const submit = () =>
    create.mutate(
      { walletId, name, holderMemberId: holderId!, theme, brand, limitCents: limit || undefined, closingDay: closing, dueDay: due },
      { onSuccess: (card) => router.replace(`/card/${card.id}`) },
    );

  return (
    <>
      <PageHeader title="Novo cartão" subtitle={wallet.data?.wallet.name} />
      <Screen footer={<Button label="Salvar cartão" size="lg" onPress={submit} disabled={!canSubmit} loading={create.isPending} />}>
        <View style={styles.preview}>
          <CreditCardView
            card={{ name: name || 'Nome do cartão', theme, brand }}
            holderName={holder?.displayName ?? 'Escolha o titular'}
            width={300}
          />
        </View>

        <TextField
          label="Apelido do cartão"
          placeholder="Cartão da Vó, Nubank Principal…"
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        <View style={styles.group}>
          <AppText variant="caption" color="textSecondary">
            Titular (quem paga a fatura ao banco)
          </AppText>
          <View style={styles.wrap}>
            {members.data?.map((member) => (
              <Chip
                key={member.id}
                label={member.displayName}
                selected={member.id === holderId}
                onPress={() => setHolderId(member.id)}
                leading={<Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={22} />}
              />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Dia de fechamento"
              placeholder="25"
              keyboardType="number-pad"
              value={closingDay}
              onChangeText={setClosingDay}
              maxLength={2}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Dia de vencimento"
              placeholder="5"
              keyboardType="number-pad"
              value={dueDay}
              onChangeText={setDueDay}
              maxLength={2}
            />
          </View>
        </View>
        {closingDay && dueDay && !validDays ? (
          <AppText variant="caption" color="danger">
            Use dias entre 1 e 31.
          </AppText>
        ) : null}

        <View style={styles.group}>
          <AppText variant="caption" color="textSecondary">
            Cor
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrap}>
            {(Object.keys(cardThemes) as CardTheme[]).map((key) => (
              <Chip key={key} label={cardThemes[key].label} selected={theme === key} onPress={() => setTheme(key)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.group}>
          <AppText variant="caption" color="textSecondary">
            Bandeira (opcional)
          </AppText>
          <View style={styles.wrap}>
            {BRANDS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={brand === option.value}
                onPress={() => setBrand(brand === option.value ? undefined : option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <AppText variant="caption" color="textSecondary">
            Limite (opcional)
          </AppText>
          <MoneyInput value={limit} onChangeValue={setLimit} label="Limite do cartão" />
        </View>

        <FormError message={create.error ? errorMessage(create.error) : null} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
