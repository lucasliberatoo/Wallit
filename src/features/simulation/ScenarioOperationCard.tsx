import { router } from 'expo-router';
import { Banknote, Check, ChevronUp, FastForward, Pencil, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Chip,
  IconButton,
  ListRow,
  MoneyInput,
  PressableScale,
  SegmentedControl,
  Surface,
  TextField,
} from '@/components/ui';
import type { CardSummary } from '@/data';
import { type FamilyMember, formatBRL, type InvoiceRef } from '@/domain';
import { usePurchaseSearch } from '@/features/purchases/hooks';
import { formatDate } from '@/utils/dates';
import { AmountField } from '@/features/purchases/components/AmountField';
import { FieldBlock } from '@/features/purchases/components/FieldBlock';
import { InstallmentStepper } from '@/features/purchases/components/InstallmentStepper';
import { cardThemes, spacing, useTheme } from '@/theme';
import { MonthPicker } from './MonthPicker';
import { DRAFT_TITLES, draftSummary, purchaseTotal, type ScenarioDraft } from './scenario-draft';

export const ICONS = { purchase: ShoppingCart, loan: Banknote, payoff: FastForward };

export interface ScenarioOperationCardProps {
  index: number;
  draft: ScenarioDraft;
  /** Only the simulation being edited is open; the others show one line. */
  expanded: boolean;
  onToggle: () => void;
  onChange: (draft: ScenarioDraft) => void;
  onRemove: () => void;
  familyId: string;
  meId: string;
  members: FamilyMember[];
  cards: CardSummary[];
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

/** One simulated operation: a one-line summary, or its form while being edited. */
export function ScenarioOperationCard(props: ScenarioOperationCardProps) {
  const { colors } = useTheme();
  const { index, draft, onRemove, expanded, onToggle, cards } = props;
  const Icon = ICONS[draft.kind];
  const cardName = (cardId: string) => cards.find((item) => item.card.id === cardId)?.card.name ?? 'cartão';
  return (
    <Surface style={styles.card}>
      <PressableScale onPress={onToggle} accessibilityRole="button" accessibilityLabel={expanded ? 'Fechar' : 'Editar'}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon size={18} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{DRAFT_TITLES[draft.kind]}</AppText>
            {!expanded ? (
              <AppText variant="caption" color="textSecondary">
                {draftSummary(draft, cardName)}
              </AppText>
            ) : null}
          </View>
          {expanded ? <ChevronUp size={18} color={colors.textMuted} /> : <Pencil size={16} color={colors.textMuted} />}
          <IconButton icon={Trash2} accessibilityLabel={`Remover simulação ${index + 1}`} onPress={onRemove} />
        </View>
      </PressableScale>
      {expanded ? (
        <>
          {draft.kind === 'purchase' ? (
            <PurchaseEditor {...props} draft={draft} />
          ) : draft.kind === 'loan' ? (
            <LoanEditor {...props} draft={draft} />
          ) : (
            <PayoffEditor {...props} draft={draft} />
          )}
          <Button label="Pronto" icon={Check} variant="secondary" onPress={onToggle} />
        </>
      ) : null}
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
  familyId,
  openRef,
}: ScenarioOperationCardProps & { draft: Extract<ScenarioDraft, { kind: 'payoff' }> }) {
  const set = (changes: Partial<typeof draft>) => onChange({ ...draft, ...changes });
  const [search, setSearch] = useState('');
  const found = usePurchaseSearch(familyId, { search: search.trim(), onlyInstallments: true, cardId: draft.cardId });
  const results = (found.data ?? []).filter((item) => item.purchase.installmentCount > 1).slice(0, 6);
  const clearPurchase = { purchaseId: null, purchaseLabel: null, purchaseInstallments: null, count: null };
  return (
    <View style={styles.body}>
      <AppText variant="caption" color="textSecondary">
        As parcelas futuras vão para a fatura escolhida e saem dos meses seguintes, como na antecipação do banco (as últimas primeiro).
      </AppText>
      <FieldBlock label="Cartão">
        <CardChips cards={cards} value={draft.cardId} onChange={(cardId) => set({ cardId, ...clearPurchase })} />
      </FieldBlock>
      <FieldBlock label="O que quitar">
        <SegmentedControl<typeof draft.scope>
          options={[
            { value: 'card', label: 'Tudo' },
            { value: 'purchase', label: 'Uma compra' },
            { value: 'amount', label: 'Um valor' },
          ]}
          value={draft.scope}
          onChange={(scope) => set({ scope })}
        />
      </FieldBlock>

      {draft.scope === 'card' ? (
        <AppText variant="caption" color="textSecondary">
          Todas as parcelas que faltam no {cards.find((item) => item.card.id === draft.cardId)?.card.name}.
        </AppText>
      ) : null}

      {draft.scope === 'amount' ? (
        <FieldBlock label="Quanto você vai pagar adiantado">
          <MoneyInput value={draft.amountCents} onChangeValue={(amountCents) => set({ amountCents })} label="Valor a quitar" />
          <AppText variant="small" color="textMuted">
            Quita primeiro as suas parcelas, das últimas para as primeiras. Se sobrar, cobre as de outras pessoas, e o valor todo conta como
            pago por você.
          </AppText>
        </FieldBlock>
      ) : null}

      {draft.scope === 'purchase' ? (
        draft.purchaseId ? (
          <View style={styles.body}>
            <ListRow
              title={draft.purchaseLabel ?? ''}
              subtitle={`${draft.purchaseInstallments}x`}
              trailing={<Button label="Trocar" variant="ghost" fullWidth={false} onPress={() => set(clearPurchase)} />}
            />
            <FieldBlock label="Quantas parcelas (as últimas primeiro)">
              <InstallmentStepper
                count={draft.count ?? draft.purchaseInstallments ?? 1}
                installmentValue={0}
                caption={draft.count === null ? 'todas as que faltam' : undefined}
                onChange={(count) => set({ count: Math.min(Math.max(1, count), draft.purchaseInstallments ?? 1) })}
              />
            </FieldBlock>
          </View>
        ) : (
          <View style={styles.body}>
            <TextField label="Buscar compra" placeholder="Ex.: geladeira" value={search} onChangeText={setSearch} />
            {results.length === 0 ? (
              <AppText variant="caption" color="textMuted">
                {found.isLoading ? 'Buscando…' : 'Nenhuma compra parcelada encontrada neste cartão.'}
              </AppText>
            ) : (
              results.map((item) => (
                <ListRow
                  key={item.purchase.id}
                  title={item.purchase.merchant}
                  subtitle={`${item.purchase.installmentCount}x de ${formatBRL(Math.floor(item.purchase.totalCents / item.purchase.installmentCount))} · ${formatDate(item.purchase.date)}`}
                  showChevron
                  onPress={() =>
                    set({
                      purchaseId: item.purchase.id,
                      purchaseLabel: item.purchase.merchant,
                      purchaseInstallments: item.purchase.installmentCount,
                      count: null,
                    })
                  }
                />
              ))
            )}
          </View>
        )
      ) : null}

      <FieldBlock label="Pagar na fatura de">
        <MonthPicker from={openRef(draft.cardId)} value={draft.targetKey} onChange={(targetKey) => set({ targetKey })} />
      </FieldBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  body: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardDot: { width: 18, height: 12, borderRadius: 3 },
});
