import { router } from 'expo-router';
import { Calculator, CreditCard, ShoppingCart } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Avatar, Button, Chip, EmptyState, LoadingState } from '@/components/ui';
import { errorMessage, type SimulatePurchaseInput } from '@/data';
import { splitEqually } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { AmountField } from '@/features/purchases/components/AmountField';
import { FieldBlock } from '@/features/purchases/components/FieldBlock';
import { InstallmentStepper } from '@/features/purchases/components/InstallmentStepper';
import { usePurchaseSimulation } from '@/features/purchases/hooks';
import type { AmountMode } from '@/features/purchases/use-purchase-form';
import { SimulationImpact } from '@/features/simulation/SimulationImpact';
import { cardThemes, spacing } from '@/theme';

/** Waits until typing stops, so the simulation isn't recalculated on every digit. */
function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** "Can I still buy this?": shows how a purchase would change the next invoices, without saving it. */
export default function SimulateScreen() {
  const { current, isLoading } = useCurrentFamily();
  const familyId = current?.family.id;
  const cards = useFamilyCards(familyId);
  const members = useMembers(familyId);
  const meId = current?.me.id;

  const [cardId, setCardId] = useState<string | null>(null);
  const [mode, setMode] = useState<AmountMode>('total');
  const [totalCents, setTotalCents] = useState(0);
  const [installmentCents, setInstallmentCents] = useState(0);
  const [count, setCount] = useState(1);
  const [payers, setPayers] = useState<string[] | null>(null);

  const chosenCard = cardId ?? cards.data?.[0]?.card.id ?? null;
  const payerIds = useMemo(() => payers ?? (meId ? [meId] : []), [payers, meId]);
  const total = mode === 'installment' ? installmentCents * count : totalCents;

  const input = useMemo<SimulatePurchaseInput | null>(() => {
    if (!familyId || !chosenCard || total < count || payerIds.length === 0) return null;
    return { familyId, cardId: chosenCard, totalCents: total, installmentCount: count, shares: splitEqually(total, payerIds) };
  }, [familyId, chosenCard, total, count, payerIds]);
  const simulation = usePurchaseSimulation(useDebounced(input));

  if (isLoading || cards.isLoading || members.isLoading) {
    return (
      <>
        <PageHeader title="Simular compra" />
        <LoadingState />
      </>
    );
  }

  if (!familyId || !cards.data?.length) {
    return (
      <>
        <PageHeader title="Simular compra" />
        <Screen>
          <EmptyState icon={CreditCard} title="Cadastre um cartão primeiro" description="A simulação usa as faturas do cartão." />
        </Screen>
      </>
    );
  }

  const changeMode = (next: AmountMode) => {
    if (next === mode) return;
    if (next === 'installment') setInstallmentCents(Math.floor(totalCents / count));
    else setTotalCents(total);
    setMode(next);
  };

  const togglePayer = (memberId: string) =>
    setPayers(payerIds.includes(memberId) ? payerIds.filter((id) => id !== memberId) : [...payerIds, memberId]);

  return (
    <>
      <PageHeader title="Simular compra" subtitle={current?.family.name} />
      <Screen
        footer={
          input ? (
            <Button
              label="Registrar esta compra"
              icon={ShoppingCart}
              size="lg"
              variant="secondary"
              onPress={() =>
                router.replace(`/purchase/new?cardId=${chosenCard}&familyId=${familyId}&mode=${mode}&total=${total}&installments=${count}`)
              }
            />
          ) : undefined
        }>
        <AppText variant="body" color="textSecondary">
          Veja como uma compra mudaria as próximas faturas antes de passar o cartão. Nada é salvo.
        </AppText>

        <AmountField
          mode={mode}
          onModeChange={changeMode}
          totalCents={total}
          installmentCents={installmentCents}
          installmentCount={count}
          onChangeTotal={setTotalCents}
          onChangeInstallment={setInstallmentCents}
          autoFocus
        />

        <FieldBlock label="Parcelamento">
          <InstallmentStepper
            count={count}
            installmentValue={total > 0 ? Math.floor(total / count) : 0}
            onChange={(value) => setCount(Math.max(1, value))}
          />
        </FieldBlock>

        <FieldBlock label="Cartão">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {cards.data.map(({ card }) => (
              <Chip
                key={card.id}
                label={card.name}
                selected={chosenCard === card.id}
                onPress={() => setCardId(card.id)}
                leading={<View style={[styles.cardDot, { backgroundColor: cardThemes[card.theme].colors[0] }]} />}
              />
            ))}
          </ScrollView>
        </FieldBlock>

        <FieldBlock label="Quem vai pagar (dividido igual)">
          <View style={styles.wrap}>
            {(members.data ?? []).map((member) => (
              <Chip
                key={member.id}
                label={member.id === meId ? `${member.displayName} (você)` : member.displayName}
                selected={payerIds.includes(member.id)}
                onPress={() => togglePayer(member.id)}
                leading={<Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={22} />}
              />
            ))}
          </View>
        </FieldBlock>

        {!input ? (
          <EmptyState
            icon={Calculator}
            title="Digite um valor"
            description={payerIds.length === 0 ? 'Escolha quem vai pagar.' : 'O resultado aparece aqui, mês a mês.'}
          />
        ) : simulation.data ? (
          <SimulationImpact simulation={simulation.data} />
        ) : simulation.isLoading ? (
          <LoadingState />
        ) : null}
        <FormError message={simulation.error ? errorMessage(simulation.error) : null} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardDot: { width: 18, height: 12, borderRadius: 3 },
});
