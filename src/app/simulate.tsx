import { CreditCard, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, EmptyState, LoadingState, PressableScale, SectionHeader, SegmentedControl } from '@/components/ui';
import { errorMessage, type ScenarioInput, type ScenarioOperation } from '@/data';
import { addMonths, compareRefs, type InvoiceRef, invoiceRefForDate, refKey } from '@/domain';
import { FormError } from '@/features/auth/FormError';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { useScenarioSimulation } from '@/features/purchases/hooks';
import { ICONS, ScenarioOperationCard } from '@/features/simulation/ScenarioOperationCard';
import { ScenarioResultView, type ScenarioView } from '@/features/simulation/ScenarioResultView';
import { type DraftKind, type ScenarioDraft, toOperation } from '@/features/simulation/scenario-draft';
import { radius, spacing, useTheme } from '@/theme';
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
  const { colors } = useTheme();
  const { current, isLoading } = useCurrentFamily();
  const familyId = current?.family.id;
  const meId = current?.me.id;
  const cards = useFamilyCards(familyId);
  const members = useMembers(familyId);
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [view, setView] = useState<ScenarioView>('mine');
  const [editingId, setEditingId] = useState<string | null>(null);
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
          : {
              id,
              kind,
              cardId,
              targetKey: refKey(openRef(cardId)),
              scope: 'card',
              purchaseId: null,
              purchaseLabel: null,
              purchaseInstallments: null,
              count: null,
              amountCents: 0,
            };
    setDrafts((list) => [...list, draft]);
    setEditingId(id);
  };

  return (
    <>
      <PageHeader title="Simular" subtitle={current?.family.name} />
      <Screen>
        <AppText variant="body" color="textSecondary">
          Monte um cenário e compare com o que você paga hoje. Por exemplo: pegar um empréstimo para quitar o cartão. Nada é salvo.
        </AppText>

        <SectionHeader title="1. Seu cenário" />
        {drafts.map((draft, index) => (
          <ScenarioOperationCard
            key={draft.id}
            index={index}
            draft={draft}
            expanded={editingId === draft.id}
            onToggle={() => setEditingId(editingId === draft.id ? null : draft.id)}
            onChange={(next) => setDrafts((list) => list.map((item) => (item.id === draft.id ? next : item)))}
            onRemove={() => setDrafts((list) => list.filter((item) => item.id !== draft.id))}
            familyId={familyId}
            meId={meId}
            members={members.data ?? []}
            cards={cardList}
            openRef={openRef}
            firstRef={firstRef}
          />
        ))}
        <View style={styles.add}>
          {(['purchase', 'loan', 'payoff'] as const).map((kind) => {
            const Icon = ICONS[kind];
            return (
              <PressableScale
                key={kind}
                onPress={() => add(kind)}
                accessibilityRole="button"
                accessibilityLabel={`Adicionar ${ADD_LABELS[kind]}`}
                style={[styles.addTile, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Plus size={14} color={colors.primary} style={styles.plus} />
                <Icon size={22} color={colors.primary} />
                <AppText variant="small" align="center">
                  {ADD_LABELS[kind]}
                </AppText>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.resultHeader}>
          <SectionHeader title={operations.length ? '2. Hoje × com a simulação' : '2. Como estão suas faturas hoje'} />
          <SegmentedControl<ScenarioView>
            options={[
              { value: 'mine', label: 'Minha parte' },
              { value: 'cards', label: 'Cartão inteiro' },
            ]}
            value={view}
            onChange={setView}
          />
        </View>
        {result.data ? (
          <ScenarioResultView result={result.data} view={view} hasOperations={operations.length > 0} />
        ) : result.isLoading ? (
          <LoadingState />
        ) : null}
        <FormError message={result.error ? errorMessage(result.error) : null} />
      </Screen>
    </>
  );
}

const ADD_LABELS: Record<DraftKind, string> = {
  purchase: 'Compra no cartão',
  loan: 'Empréstimo',
  payoff: 'Quitar parcelas',
};

const styles = StyleSheet.create({
  add: { flexDirection: 'row', gap: spacing.sm },
  addTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  plus: { position: 'absolute', top: 8, right: 8 },
  resultHeader: { gap: spacing.sm },
});
