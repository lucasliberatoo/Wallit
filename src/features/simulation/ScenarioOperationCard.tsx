import { router } from 'expo-router';
import { Banknote, FastForward, ShoppingCart, Trash2 } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Chip, IconButton, MoneyInput, Surface } from '@/components/ui';
import type { CardSummary, PurchaseListItem } from '@/data';
import { type FamilyMember, formatBRL, type InvoiceRef } from '@/domain';
import { AmountField } from '@/features/purchases/components/AmountField';
import { FieldBlock } from '@/features/purchases/components/FieldBlock';
import { InstallmentStepper } from '@/features/purchases/components/InstallmentStepper';
import { cardThemes, spacing, useTheme } from '@/theme';
import { MonthPicker } from './MonthPicker';
import { DRAFT_TITLES, purchaseTotal, type ScenarioDraft } from './scenario-draft';

const ICONS = { purchase: ShoppingCart, loan: Banknote, payoff: FastForward };

export interface ScenarioOperationCardProps {
  index: number;
  draft: ScenarioDraft;
  onChange: (draft: ScenarioDraft) => void;
  onRemove: () => void;
  familyId: string;
  meId: string;
  members: FamilyMember[];
  cards: CardSummary[];
  /** Purchases with installments, for paying one of them off. */
  installmentPurchases: PurchaseListItem[];
  /** First open invoice of each card. */
  openRef: (cardId: string) => InvoiceRef;
  /** Earliest open invoice of all cards (loans). */
  firstRef: InvoiceRef;
}

function CardChips({ cards, value, onChange }: { cards: CardSummary[]; value: string; onChange: (cardId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {cards.map(({ card }) => (
        <Chip
          key={card.id}
          label={card.name}
          selected={value === card.id}
          onPress={() => onChange(card.id)}
          leading={<View style={[styles.cardDot, { backgroundColor: cardThemes[card.theme].colors[0] }]} />}
        />
      ))}
    </ScrollView>
  );
}

/** One simulated operation, editable in place. */
export function ScenarioOperationCard(props: ScenarioOperationCardProps) {
  const { colors } = useTheme();
  const { index, draft, onRemove } = props;
  const Icon = ICONS[draft.kind];
  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <Icon size={20} color={colors.primary} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {index + 1}. {DRAFT_TITLES[draft.kind]}
        </AppText>
        <IconButton icon={Trash2} accessibilityLabel={`Remover simulação ${index + 1}`} onPress={onRemove} />
      </View>
      {draft.kind === 'purchase' ? (
        <PurchaseEditor {...props} draft={draft} />
      ) : draft.kind === 'loan' ? (
        <LoanEditor {...props} draft={draft} />
      ) : (
        <PayoffEditor {...props} draft={draft} />
      )}
    </Surface>
  );
}

function PurchaseEditor({
  draft,
  onChange,
  cards,
  members,
  meId,
  familyId,
  openRef,
}: ScenarioOperationCardProps & { draft: Extract<ScenarioDraft, { kind: 'purchase' }> }) {
  const total = purchaseTotal(draft);
  const set = (changes: Partial<typeof draft>) => onChange({ ...draft, ...changes });
  return (
    <View style={styles.body}>
      <AmountField
        mode={draft.mode}
        onModeChange={(mode) =>
          mode !== draft.mode &&
          set(mode === 'installment' ? { mode, installmentCents: Math.floor(draft.totalCents / draft.count) } : { mode, totalCents: total })
        }
        totalCents={total}
        installmentCents={draft.installmentCents}
        installmentCount={draft.count}
        onChangeTotal={(totalCents) => set({ totalCents })}
        onChangeInstallment={(installmentCents) => set({ installmentCents })}
      />
      <InstallmentStepper
        count={draft.count}
        installmentValue={total > 0 ? Math.floor(total / draft.count) : 0}
        onChange={(count) => set({ count: Math.max(1, count) })}
      />
      <FieldBlock label="Cartão">
        <CardChips cards={cards} value={draft.cardId} onChange={(cardId) => set({ cardId })} />
      </FieldBlock>
      <FieldBlock label="Primeira parcela na fatura de">
        <MonthPicker from={openRef(draft.cardId)} value={draft.startKey} onChange={(startKey) => set({ startKey })} />
      </FieldBlock>
      <FieldBlock label="Quem vai pagar (dividido igual)">
        <View style={styles.wrap}>
          {members.map((member) => (
            <Chip
              key={member.id}
              label={member.id === meId ? `${member.displayName} (você)` : member.displayName}
              selected={draft.payerIds.includes(member.id)}
              onPress={() =>
                set({
                  payerIds: draft.payerIds.includes(member.id)
                    ? draft.payerIds.filter((id) => id !== member.id)
                    : [...draft.payerIds, member.id],
                })
              }
              leading={<Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={22} />}
            />
          ))}
        </View>
      </FieldBlock>
      {total >= draft.count && total > 0 ? (
        <Button
          label="Registrar esta compra"
          icon={ShoppingCart}
          variant="ghost"
          onPress={() =>
            router.push(
              `/purchase/new?cardId=${draft.cardId}&familyId=${familyId}&mode=${draft.mode}&total=${total}&installments=${draft.count}`,
            )
          }
        />
      ) : null}
    </View>
  );
}

function LoanEditor({ draft, onChange, firstRef }: ScenarioOperationCardProps & { draft: Extract<ScenarioDraft, { kind: 'loan' }> }) {
  const set = (changes: Partial<typeof draft>) => onChange({ ...draft, ...changes });
  const totalPaid = draft.installmentCents * draft.count;
  return (
    <View style={styles.body}>
      <FieldBlock label="Valor que você recebe">
        <MoneyInput value={draft.receivedCents} onChangeValue={(receivedCents) => set({ receivedCents })} label="Valor recebido" />
      </FieldBlock>
      <FieldBlock label="Recebido no mês de">
        <MonthPicker from={firstRef} value={draft.receivedKey} onChange={(receivedKey) => set({ receivedKey })} />
      </FieldBlock>
      <FieldBlock label="Valor de cada parcela">
        <MoneyInput
          value={draft.installmentCents}
          onChangeValue={(installmentCents) => set({ installmentCents })}
          label="Parcela do empréstimo"
        />
      </FieldBlock>
      <InstallmentStepper
        count={draft.count}
        installmentValue={draft.installmentCents}
        caption={draft.count > 1 && totalPaid > 0 ? `total de ${formatBRL(totalPaid)}` : undefined}
        onChange={(count) => set({ count: Math.min(Math.max(1, count), 120) })}
      />
      <FieldBlock label="Primeira parcela no mês de">
        <MonthPicker from={firstRef} value={draft.startKey} onChange={(startKey) => set({ startKey })} />
      </FieldBlock>
      {draft.receivedCents > 0 && totalPaid > draft.receivedCents ? (
        <AppText variant="caption" color="textSecondary">
          Você paga {formatBRL(totalPaid - draft.receivedCents)} a mais do que recebe (juros e taxas).
        </AppText>
      ) : null}
    </View>
  );
}

function PayoffEditor({
  draft,
  onChange,
  cards,
  installmentPurchases,
  openRef,
}: ScenarioOperationCardProps & { draft: Extract<ScenarioDraft, { kind: 'payoff' }> }) {
  const set = (changes: Partial<typeof draft>) => onChange({ ...draft, ...changes });
  const purchases = installmentPurchases.filter((item) => item.card.id === draft.cardId);
  const chosen = purchases.find((item) => item.purchase.id === draft.purchaseId);
  return (
    <View style={styles.body}>
      <AppText variant="caption" color="textSecondary">
        As parcelas futuras passam para a fatura escolhida, como na antecipação do banco.
      </AppText>
      <FieldBlock label="Cartão">
        <CardChips cards={cards} value={draft.cardId} onChange={(cardId) => set({ cardId, purchaseId: null, count: null })} />
      </FieldBlock>
      <FieldBlock label="O que quitar">
        <View style={styles.wrap}>
          <Chip label="Todo o saldo do cartão" selected={!draft.purchaseId} onPress={() => set({ purchaseId: null, count: null })} />
          {purchases.map((item) => (
            <Chip
              key={item.purchase.id}
              label={`${item.purchase.merchant} (${item.purchase.installmentCount}x)`}
              selected={draft.purchaseId === item.purchase.id}
              onPress={() => set({ purchaseId: item.purchase.id, count: null })}
            />
          ))}
        </View>
      </FieldBlock>
      {chosen ? (
        <FieldBlock label="Quantas parcelas (as últimas primeiro)">
          <InstallmentStepper
            count={draft.count ?? chosen.purchase.installmentCount}
            installmentValue={0}
            caption={draft.count === null ? 'todas as que faltam' : undefined}
            onChange={(count) => set({ count: Math.min(Math.max(1, count), chosen.purchase.installmentCount) })}
          />
        </FieldBlock>
      ) : null}
      <FieldBlock label="Pagar tudo na fatura de">
        <MonthPicker from={openRef(draft.cardId)} value={draft.targetKey} onChange={(targetKey) => set({ targetKey })} />
      </FieldBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  body: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardDot: { width: 18, height: 12, borderRadius: 3 },
});
