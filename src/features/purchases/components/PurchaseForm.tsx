import { ChevronDown, ChevronUp, Save } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/finance';
import { Screen } from '@/components/layout';
import { AppText, Avatar, Button, Chip, MoneyInput, PressableScale, TextField } from '@/components/ui';
import type { CardSummary } from '@/data';
import { type Category, type FamilyMember, MAX_ATTACHMENTS_PER_PURCHASE, normalizeStatementName } from '@/domain';
import { useAliases } from '@/features/aliases/hooks';
import { AttachButtons } from '@/features/attachments/components/AttachButtons';
import { PickedFiles } from '@/features/attachments/components/PickedFiles';
import type { PickedFile } from '@/features/attachments/pick-attachment';
import { usePurchaseSearch } from '@/features/purchases/hooks';
import { cardThemes, radius, spacing, useTheme } from '@/theme';
import { addDaysISO, formatDate, parseBRDate, todayISO } from '@/utils/dates';
import type { usePurchaseForm } from '../use-purchase-form';
import { FieldBlock } from './FieldBlock';
import { InstallmentStepper } from './InstallmentStepper';
import { SplitEditor } from './SplitEditor';

export interface PurchaseFormProps {
  form: ReturnType<typeof usePurchaseForm>;
  familyId: string;
  members: FamilyMember[];
  cards: CardSummary[];
  categories: Category[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  error?: React.ReactNode;
  /** Installments cannot change after creation (they are already in invoices). */
  lockInstallments?: boolean;
  /** Files picked in the form, uploaded after saving. */
  files: PickedFile[];
  onFilesChange: (files: PickedFile[]) => void;
  /** Attachments the purchase already has (edit). */
  existingAttachments?: number;
  /** Shown above the amount (family choice in a new purchase). */
  top?: React.ReactNode;
}

export function PurchaseForm({
  form,
  familyId,
  members,
  cards,
  categories,
  submitLabel,
  submitting,
  onSubmit,
  error,
  lockInstallments,
  files,
  onFilesChange,
  existingAttachments = 0,
  top,
}: PurchaseFormProps) {
  const { colors } = useTheme();
  const { state, dispatch, split, canSave, missing, installmentValue } = form;
  const [showMore, setShowMore] = useState(Boolean(state.statementName || state.note || files.length));
  const aliases = useAliases(familyId);
  // Merchant name filled in from an alias; replaced again while the user doesn't type their own.
  const [aliasFill, setAliasFill] = useState<string | null>(null);

  const changeStatementName = (value: string) => {
    dispatch({ type: 'setField', field: 'statementName', value });
    const key = normalizeStatementName(value);
    const alias = key ? aliases.data?.find((a) => a.statementName === key) : undefined;
    const merchantIsMine = state.merchant.trim() !== '' && state.merchant !== aliasFill;
    if (merchantIsMine) return;
    if (alias) {
      dispatch({ type: 'setField', field: 'merchant', value: alias.merchant });
      setAliasFill(alias.merchant);
    } else if (aliasFill) {
      dispatch({ type: 'setField', field: 'merchant', value: '' });
      setAliasFill(null);
    }
  };
  const [customDate, setCustomDate] = useState('');
  const recent = usePurchaseSearch(familyId, {});

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return (recent.data ?? [])
      .filter((item) => {
        const key = item.purchase.merchant.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [recent.data]);

  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const isCustomDate = state.date !== today && state.date !== yesterday;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <View style={styles.footer}>
            {!canSave && missing.length > 0 ? (
              <AppText variant="small" color="textMuted" align="center">
                Falta: {missing.join(', ')}
              </AppText>
            ) : null}
            <Button
              label={submitLabel}
              icon={Save}
              size="lg"
              variant="accent"
              onPress={onSubmit}
              disabled={!canSave}
              loading={submitting}
            />
          </View>
        }>
        {top}
        <View style={styles.hero}>
          <AppText variant="caption" color="textSecondary">
            Valor da compra
          </AppText>
          <MoneyInput
            value={state.totalCents}
            onChangeValue={(value) => dispatch({ type: 'setTotal', value })}
            size="hero"
            label="Valor da compra"
            autoFocus={!state.merchant}
          />
        </View>

        <View style={styles.block}>
          <TextField
            label="Estabelecimento"
            placeholder="Ex.: Mercado Três Amigos"
            value={state.merchant}
            onChangeText={(value) => dispatch({ type: 'setField', field: 'merchant', value })}
            maxLength={60}
          />
          {!state.merchant && suggestions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
              keyboardShouldPersistTaps="handled">
              {suggestions.map((item) => (
                <Chip
                  key={item.purchase.id}
                  label={item.purchase.merchant}
                  leading={item.category ? <CategoryIcon icon={item.category.icon} color={item.category.color} size={20} /> : undefined}
                  onPress={() => {
                    dispatch({ type: 'setField', field: 'merchant', value: item.purchase.merchant });
                    if (item.purchase.statementName)
                      dispatch({ type: 'setField', field: 'statementName', value: item.purchase.statementName });
                    dispatch({ type: 'setCategory', value: item.purchase.categoryId });
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <FieldBlock label="Cartão">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {cards.map(({ card }) => (
              <Chip
                key={card.id}
                label={card.name}
                selected={state.cardId === card.id}
                onPress={() => dispatch({ type: 'setCard', value: card.id })}
                leading={<View style={[styles.cardDot, { backgroundColor: cardThemes[card.theme].colors[0] }]} />}
              />
            ))}
          </ScrollView>
        </FieldBlock>

        <FieldBlock label="Quem comprou">
          <View style={styles.wrap}>
            {members.map((member) => (
              <Chip
                key={member.id}
                label={member.displayName}
                selected={state.buyerId === member.id}
                onPress={() => dispatch({ type: 'setBuyer', value: member.id })}
                leading={<Avatar name={member.displayName} color={member.avatarColor} photo={member.photo} size={22} />}
              />
            ))}
          </View>
        </FieldBlock>

        <FieldBlock label="Quem paga">
          <SplitEditor
            members={members}
            shares={state.shares}
            validation={split}
            onTogglePayer={(memberId) => dispatch({ type: 'togglePayer', memberId })}
            onChangeAmount={(memberId, value) => dispatch({ type: 'setShareAmount', memberId, value })}
            onSplitEqually={() => dispatch({ type: 'splitEqually' })}
            onFillRemaining={(memberId) => dispatch({ type: 'fillRemaining', memberId })}
            installmentCount={state.installmentCount}
          />
        </FieldBlock>

        <FieldBlock label="Categoria">
          <View style={styles.wrap}>
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={state.categoryId === category.id}
                onPress={() => dispatch({ type: 'setCategory', value: category.id })}
                leading={
                  <CategoryIcon
                    icon={category.icon}
                    color={state.categoryId === category.id ? colors.onPrimary : category.color}
                    size={20}
                  />
                }
              />
            ))}
          </View>
        </FieldBlock>

        <FieldBlock label="Data">
          <View style={styles.wrap}>
            <Chip
              label="Hoje"
              selected={state.date === today}
              onPress={() => dispatch({ type: 'setField', field: 'date', value: today })}
            />
            <Chip
              label="Ontem"
              selected={state.date === yesterday}
              onPress={() => dispatch({ type: 'setField', field: 'date', value: yesterday })}
            />
            <Chip
              label={isCustomDate ? formatDate(state.date) : 'Outra data'}
              selected={isCustomDate}
              onPress={() => setCustomDate(isCustomDate ? formatDate(state.date) : '')}
            />
          </View>
          {customDate !== '' || isCustomDate ? (
            <TextField
              label="Data da compra"
              placeholder="DD/MM/AAAA"
              keyboardType="numbers-and-punctuation"
              value={customDate}
              onChangeText={(text) => {
                setCustomDate(text);
                const parsed = parseBRDate(text);
                if (parsed) dispatch({ type: 'setField', field: 'date', value: parsed });
              }}
              error={customDate.length >= 5 && !parseBRDate(customDate) ? 'Data inválida' : undefined}
              maxLength={10}
            />
          ) : null}
        </FieldBlock>

        <FieldBlock label="Parcelamento">
          {lockInstallments ? (
            <AppText variant="body" color="textSecondary">
              {state.installmentCount === 1 ? 'À vista' : `${state.installmentCount}x`} (não pode ser alterado depois de criado)
            </AppText>
          ) : (
            <InstallmentStepper
              count={state.installmentCount}
              installmentValue={installmentValue}
              onChange={(value) => dispatch({ type: 'setInstallments', value })}
            />
          )}
        </FieldBlock>

        <PressableScale onPress={() => setShowMore((v) => !v)} style={styles.more} accessibilityLabel="Mais detalhes">
          <AppText variant="caption" color="primary">
            {showMore
              ? 'Menos detalhes'
              : files.length > 0
                ? `Nome na fatura, observação e anexos (${files.length})`
                : 'Nome na fatura, observação e anexos'}
          </AppText>
          {showMore ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
        </PressableScale>
        {showMore ? (
          <View style={styles.block}>
            <TextField
              label="Nome que aparece na fatura"
              placeholder="Ex.: JANUARIO DA SILVEIRA"
              autoCapitalize="characters"
              hint={
                aliasFill && state.merchant === aliasFill
                  ? `Reconhecido como "${aliasFill}" pelos apelidos da família.`
                  : 'Ajuda todo mundo a reconhecer a compra na fatura do banco.'
              }
              value={state.statementName}
              onChangeText={changeStatementName}
              maxLength={60}
            />
            <TextField
              label="Observação"
              placeholder="Opcional"
              value={state.note}
              onChangeText={(value) => dispatch({ type: 'setField', field: 'note', value })}
              multiline
              maxLength={200}
            />
            <AppText variant="caption" color="textSecondary">
              Anexos: print da compra online, nota ou comprovante
            </AppText>
            <PickedFiles files={files} onRemove={(index) => onFilesChange(files.filter((_, i) => i !== index))} />
            {files.length + existingAttachments < MAX_ATTACHMENTS_PER_PURCHASE ? (
              <AttachButtons onPicked={(file) => onFilesChange([...files, file])} disabled={submitting} />
            ) : null}
          </View>
        ) : null}

        {error}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardDot: { width: 18, height: 12, borderRadius: 3 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    padding: spacing.sm,
    borderRadius: radius.pill,
  },
  footer: { gap: spacing.xs },
});
