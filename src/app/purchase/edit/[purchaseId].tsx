import { router, useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { errorMessage, type PurchaseDetails } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useMembers } from '@/features/families/hooks';
import { PurchaseForm } from '@/features/purchases/components/PurchaseForm';
import { usePurchase, useUpdatePurchase } from '@/features/purchases/hooks';
import { initialPurchaseForm, usePurchaseForm } from '@/features/purchases/use-purchase-form';

export default function EditPurchaseScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const purchase = usePurchase(purchaseId);
  const familyId = purchase.data?.purchase.familyId;
  const members = useMembers(familyId);
  const cards = useFamilyCards(familyId);
  const categories = useCategories(familyId);

  if (purchase.isLoading || members.isLoading || cards.isLoading || categories.isLoading) return <LoadingState />;
  if (!purchase.data || !members.data || !cards.data || !categories.data) return <ErrorState message={errorMessage(purchase.error)} />;
  if (!purchase.data.canEdit) return <ErrorState message="Esta compra está numa fatura fechada. Só a titular pode alterá-la." />;

  return <EditForm details={purchase.data} members={members.data} cards={cards.data} categories={categories.data} />;
}

function EditForm({
  details,
  members,
  cards,
  categories,
}: {
  details: PurchaseDetails;
  members: NonNullable<ReturnType<typeof useMembers>['data']>;
  cards: NonNullable<ReturnType<typeof useFamilyCards>['data']>;
  categories: NonNullable<ReturnType<typeof useCategories>['data']>;
}) {
  const update = useUpdatePurchase();
  const { purchase } = details;
  const form = usePurchaseForm(
    initialPurchaseForm({
      totalCents: purchase.totalCents,
      merchant: purchase.merchant,
      statementName: purchase.statementName ?? '',
      cardId: purchase.cardId,
      date: purchase.date,
      categoryId: purchase.categoryId,
      installmentCount: purchase.installmentCount,
      buyerId: purchase.buyerMemberId,
      shares: details.shares.map((s) => ({ memberId: s.member.id, amountCents: s.amountCents })),
      autoSplit: false,
      note: purchase.note ?? '',
    }),
  );

  return (
    <>
      <PageHeader title="Editar compra" subtitle={purchase.merchant} />
      <PurchaseForm
        form={form}
        familyId={purchase.familyId}
        members={members}
        cards={cards.filter((c) => c.card.id === purchase.cardId)}
        categories={categories}
        lockInstallments
        submitLabel="Salvar alterações"
        submitting={update.isPending}
        error={<FormError message={update.error ? errorMessage(update.error) : null} />}
        onSubmit={() => {
          const input = form.toInput(purchase.familyId);
          update.mutate(
            {
              purchaseId: purchase.id,
              changes: {
                merchant: input.merchant,
                statementName: input.statementName ?? '',
                totalCents: input.totalCents,
                date: input.date,
                categoryId: input.categoryId,
                buyerMemberId: input.buyerMemberId,
                shares: input.shares,
                note: input.note ?? '',
              },
            },
            { onSuccess: () => router.back() },
          );
        }}
      />
    </>
  );
}
