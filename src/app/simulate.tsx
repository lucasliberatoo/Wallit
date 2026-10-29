import { Banknote, CreditCard, FastForward, ShoppingCart } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, EmptyState, LoadingState, SectionHeader } from '@/components/ui';
import { errorMessage, type ScenarioInput, type ScenarioOperation } from '@/data';
import { addMonths, compareRefs, type InvoiceRef, invoiceRefForDate, refKey } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { usePurchaseSearch, useScenarioSimulation } from '@/features/purchases/hooks';
import { ScenarioOperationCard } from '@/features/simulation/ScenarioOperationCard';
import { ScenarioResultView, type ScenarioView } from '@/features/simulation/ScenarioResultView';
import { type DraftKind, type ScenarioDraft, toOperation } from '@/features/simulation/scenario-draft';
import { spacing } from '@/theme';
import { todayISO } from '@/utils/dates';

/** Waits until typing stops, so the simulation isn't recalculated on every digit. */
function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * "What if?": purchases, loans and early payoffs together, compared month by
 * month with how things are today. Nothing is saved.
 */
export default function SimulateScreen() {
  const { current, isLoading } = useCurrentFamily();
  const familyId = current?.family.id;
  const meId = current?.me.id;
  const cards = useFamilyCards(familyId);
  const members = useMembers(familyId);
  const installmentPurchases = usePurchaseSearch(familyId, { onlyInstallments: true });
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [view, setView] = useState<ScenarioView>('mine');
  const nextId = useRef(1);

  const operations = useMemo(
    () => drafts.map(toOperation).filter((operation): operation is ScenarioOperation => operation !== null),
    [drafts],
  );
  const input = useMemo<ScenarioInput | null>(() => (familyId ? { familyId, operations } : null), [familyId, operations]);
  const result = useScenarioSimulation(useDebounced(input));

  if (isLoading || cards.isLoading || members.isLoading) {
    return (
      <>
        <PageHeader title="Simular" />
        <LoadingState />
      </>
    );
  }

  if (!familyId || !meId || !cards.data?.length) {
    return (
      <>
        <PageHeader title="Simular" />
        <Screen>
          <EmptyState icon={CreditCard} title="Cadastre um cartão primeiro" description="A simulação usa as faturas do cartão." />
        </Screen>
      </>
    );
  }

  const cardList = cards.data;
  const openRef = (cardId: string): InvoiceRef => {
    const known = result.data?.openRefs.find((item) => item.cardId === cardId)?.ref;
    const card = cardList.find((item) => item.card.id === cardId)?.card;
    return known ?? invoiceRefForDate(todayISO(), card?.closingDay ?? 1);
  };
  const firstRef = cardList.map(({ card }) => openRef(card.id)).sort(compareRefs)[0];

  const add = (kind: DraftKind) => {
    const id = String(nextId.current++);
    const cardId = cardList[0].card.id;
    const draft: ScenarioDraft =
      kind === 'purchase'
        ? {
            id,
            kind,
            cardId,
            mode: 'total',
            totalCents: 0,
            installmentCents: 0,
            count: 1,
            startKey: refKey(openRef(cardId)),
            payerIds: [meId],
          }
        : kind === 'loan'
          ? {
              id,
              kind,
              receivedCents: 0,
              receivedKey: refKey(firstRef),
              installmentCents: 0,
              count: 10,
              startKey: refKey(addMonths(firstRef, 1)),
            }
          : { id, kind, cardId, targetKey: refKey(openRef(cardId)), purchaseId: null, count: null };
    setDrafts((list) => [...list, draft]);
  };

  return (
    <>
      <PageHeader title="Simular" subtitle={current?.family.name} />
      <Screen>
        <AppText variant="body" color="textSecondary">
          Junte compras, empréstimos e quitações e compare mês a mês com o que você paga hoje. Nada é salvo.
        </AppText>

        {drafts.map((draft, index) => (
          <ScenarioOperationCard
            key={draft.id}
            index={index}
            draft={draft}
            onChange={(next) => setDrafts((list) => list.map((item) => (item.id === draft.id ? next : item)))}
            onRemove={() => setDrafts((list) => list.filter((item) => item.id !== draft.id))}
            familyId={familyId}
            meId={meId}
            members={members.data ?? []}
            cards={cardList}
            installmentPurchases={installmentPurchases.data ?? []}
            openRef={openRef}
            firstRef={firstRef}
          />
        ))}

        <View style={styles.add}>
          <SectionHeader title={drafts.length ? 'Adicionar outra simulação' : 'O que você quer simular?'} />
          <Button label="Compra no cartão" icon={ShoppingCart} variant="secondary" onPress={() => add('purchase')} />
          <Button label="Empréstimo ou dívida" icon={Banknote} variant="secondary" onPress={() => add('loan')} />
          <Button label="Quitar ou antecipar parcelas" icon={FastForward} variant="secondary" onPress={() => add('payoff')} />
        </View>

        <SectionHeader title={operations.length ? 'Hoje × com a simulação' : 'Como estão suas próximas faturas'} />
        {result.data ? (
          <ScenarioResultView result={result.data} view={view} onViewChange={setView} hasOperations={operations.length > 0} />
        ) : result.isLoading ? (
          <LoadingState />
        ) : null}
        <FormError message={result.error ? errorMessage(result.error) : null} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  add: { gap: spacing.sm },
});
