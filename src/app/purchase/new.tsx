import { router, useLocalSearchParams } from 'expo-router';
import { CreditCard, UsersRound } from 'lucide-react-native';

import { PageHeader, Screen } from '@/components/layout';
import { EmptyState, LoadingState } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { PurchaseForm } from '@/features/purchases/components/PurchaseForm';
import { useCreatePurchase } from '@/features/purchases/hooks';
import { initialPurchaseForm, usePurchaseForm } from '@/features/purchases/use-purchase-form';

export default function NewPurchaseScreen() {
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const { current, isLoading } = useCurrentFamily();
  const familyId = current?.family.id;
  const members = useMembers(familyId);
  const cards = useFamilyCards(familyId);
  const categories = useCategories(familyId);

  if (isLoading || members.isLoading || cards.isLoading || categories.isLoading) {
    return (
      <>
        <PageHeader title="Nova compra" />
        <LoadingState />
      </>
    );
  }

  if (!current || !familyId) {
    return (
      <>
        <PageHeader title="Nova compra" />
        <Screen>
          <EmptyState
            icon={UsersRound}
            title="Crie uma família primeiro"
            actionLabel="Criar família"
            onAction={() => router.replace('/family/new')}
          />
        </Screen>
      </>
    );
  }

  if (!cards.data?.length) {
    return (
      <>
        <PageHeader title="Nova compra" />
        <Screen>
          <EmptyState
            icon={CreditCard}
            title="Cadastre um cartão primeiro"
            description="As compras são registradas no cartão compartilhado."
            actionLabel="Ver carteiras"
            onAction={() => router.replace(`/family/${familyId}`)}
          />
        </Screen>
      </>
    );
  }

  return (
    <NewPurchaseForm
      familyId={familyId}
      familyName={current.family.name}
      meId={current.me.id}
      defaultCardId={cardId ?? cards.data[0].card.id}
      members={members.data ?? []}
      cards={cards.data}
      categories={categories.data ?? []}
    />
  );
}

function NewPurchaseForm(props: {
  familyId: string;
  familyName: string;
  meId: string;
  defaultCardId: string;
  members: NonNullable<ReturnType<typeof useMembers>['data']>;
  cards: NonNullable<ReturnType<typeof useFamilyCards>['data']>;
  categories: NonNullable<ReturnType<typeof useCategories>['data']>;
}) {
  const create = useCreatePurchase();
  const form = usePurchaseForm(
    initialPurchaseForm({ cardId: props.defaultCardId, buyerId: props.meId, shares: [{ memberId: props.meId, amountCents: 0 }] }),
  );
  return (
    <>
      <PageHeader title="Nova compra" subtitle={props.familyName} />
      <PurchaseForm
        form={form}
        familyId={props.familyId}
        members={props.members}
        cards={props.cards}
        categories={props.categories}
        submitLabel="Salvar compra"
        submitting={create.isPending}
        error={<FormError message={create.error ? errorMessage(create.error) : null} />}
        onSubmit={() =>
          create.mutate(form.toInput(props.familyId), {
            onSuccess: (details) => router.replace(`/purchase/${details.purchase.id}?created=1`),
          })
        }
      />
    </>
  );
}
