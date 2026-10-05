import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CreditCard, UsersRound } from 'lucide-react-native';

import { PageHeader, Screen } from '@/components/layout';
import { Chip, EmptyState, LoadingState } from '@/components/ui';
import { errorMessage } from '@/data';
import { useUploadPicked } from '@/features/attachments/hooks';
import type { PickedFile } from '@/features/attachments/pick-attachment';
import { FormError } from '@/features/auth/FormError';
import { spacing } from '@/theme';
import { showError } from '@/utils/confirm';
import { useFamilyCards } from '@/features/cards/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useCurrentFamily, useMembers } from '@/features/families/hooks';
import { FieldBlock } from '@/features/purchases/components/FieldBlock';
import { PurchaseForm } from '@/features/purchases/components/PurchaseForm';
import { useCreatePurchase } from '@/features/purchases/hooks';
import { initialPurchaseForm, usePurchaseForm } from '@/features/purchases/use-purchase-form';

export default function NewPurchaseScreen() {
  const params = useLocalSearchParams<{ cardId?: string; familyId?: string }>();
  const { current, families, isLoading } = useCurrentFamily();
  const [chosenId, setChosenId] = useState<string | undefined>(params.familyId);
  const chosen = families.find((item) => item.family.id === chosenId) ?? current;
  const familyId = chosen?.family.id;
  const members = useMembers(familyId);
  const cards = useFamilyCards(familyId);
  const categories = useCategories(familyId);

  const familyPicker =
    families.length > 1 ? (
      <FieldBlock label="Família">
        <View style={styles.chips}>
          {families.map((item) => (
            <Chip
              key={item.family.id}
              label={item.family.name}
              selected={item.family.id === familyId}
              onPress={() => setChosenId(item.family.id)}
              leading={<View style={[styles.familyDot, { backgroundColor: item.family.color }]} />}
            />
          ))}
        </View>
      </FieldBlock>
    ) : null;

  if (isLoading || members.isLoading || cards.isLoading || categories.isLoading) {
    return (
      <>
        <PageHeader title="Nova compra" />
        <LoadingState />
      </>
    );
  }

  if (!chosen || !familyId) {
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
          {familyPicker}
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

  const paramCard = cards.data.find((item) => item.card.id === params.cardId);
  return (
    <NewPurchaseForm
      // A different family has other people, cards and categories: start the form over.
      key={familyId}
      familyId={familyId}
      familyName={chosen.family.name}
      meId={chosen.me.id}
      defaultCardId={paramCard?.card.id ?? cards.data[0].card.id}
      members={members.data ?? []}
      cards={cards.data}
      categories={categories.data ?? []}
      familyPicker={familyPicker}
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
  familyPicker: ReactNode;
}) {
  const create = useCreatePurchase();
  const uploads = useUploadPicked();
  const [files, setFiles] = useState<PickedFile[]>([]);
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
        submitting={create.isPending || uploads.isPending}
        files={files}
        onFilesChange={setFiles}
        top={props.familyPicker}
        error={<FormError message={create.error ? errorMessage(create.error) : null} />}
        onSubmit={() =>
          create.mutate(form.toInput(props.familyId), {
            onSuccess: async (details) => {
              const failed = await uploads.upload(details.purchase.id, files);
              router.replace(`/purchase/${details.purchase.id}?created=1`);
              if (failed > 0) showError('Compra salva', 'Alguns anexos não foram enviados. Tente de novo pela tela da compra.');
            },
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  familyDot: { width: 10, height: 10, borderRadius: 5 },
});
