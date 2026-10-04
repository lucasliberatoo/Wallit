import { ChevronDown, ChevronUp, Save } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/finance';
import { Screen } from '@/components/layout';
import { AppText, Avatar, Button, Chip, MoneyInput, PressableScale, TextField } from '@/components/ui';
import type { CardSummary } from '@/data';
import type { Category, FamilyMember } from '@/domain';
import { usePurchaseSearch } from '@/features/purchases/hooks';
import { cardThemes, colors, radius, spacing } from '@/theme';
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
}

export function PurchaseForm({ form, familyId, members, cards, categories, submitLabel, submitting, onSubmit, error, lockInstallments }: PurchaseFormProps) {
  const { state, dispatch, split, canSave, missing, installmentValue } = form;
  const [showMore, setShowMore] = useState(Boolean(state.statementName || state.note));
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
            <Button label={submitLabel} icon={Save} size="lg" variant="accent" onPress={onSubmit} disabled={!canSave} loading={submitting} />
          </View>
        }>
        <View style={styles.hero}>
          <AppText variant="caption" color="textSecondary">
            Valor da compra
          </AppText>
          <MoneyInput value={state.totalCents} onChangeValue={(value) => dispatch({ type: 'setTotal', value })} size="hero" label="Valor da compra" autoFocus={!state.merchant} />
        </View>

        <View style={styles.block}>
          <TextField label="Estabelecimento" placeholder="Ex.: Mercado Três Amigos" value={state.merchant} onChangeText={(value) => dispatch({ type: 'setField', field: 'merchant', value })} maxLength={60} />
          {!state.merchant && suggestions.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
              {suggestions.map((item) => (
                <Chip
                  key={item.purchase.id}
                  label={item.purchase.merchant}
                  leading={item.category ? <CategoryIcon icon={item.category.icon} color={item.category.color} size={20} /> : undefined}
                  onPress={() => {
                    dispatch({ type: 'setField', field: 'merchant', value: item.purchase.merchant });
                    if (item.purchase.statementName) dispatch({ type: 'setField', field: 'statementName', value: item.purchase.statementName });
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
                leading={<Avatar name={member.displayName} color={member.avatarColor} size={22} />}
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
                leading={<CategoryIcon icon={category.icon} color={state.categoryId === category.id ? colors.textOnDark : category.color} size={20} />}
              />
            ))}
          </View>
        </FieldBlock>

        <FieldBlock label="Data">
          <View style={styles.wrap}>
            <Chip label="Hoje" selected={state.date === today} onPress={() => dispatch({ type: 'setField', field: 'date', value: today })} />
            <Chip label="Ontem" selected={state.date === yesterday} onPress={() => dispatch({ type: 'setField', field: 'date', value: yesterday })} />
            <Chip label={isCustomDate ? formatDate(state.date) : 'Outra data'} selected={isCustomDate} onPress={() => setCustomDate(isCustomDate ? formatDate(state.date) : '')} />
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
            <InstallmentStepper count={state.installmentCount} installmentValue={installmentValue} onChange={(value) => dispatch({ type: 'setInstallments', value })} />
          )}
        </FieldBlock>

        <PressableScale onPress={() => setShowMore((v) => !v)} style={styles.more} accessibilityLabel="Mais detalhes">
          <AppText variant="caption" color="primary">
            {showMore ? 'Menos detalhes' : 'Nome na fatura e observação'}
          </AppText>
          {showMore ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
        </PressableScale>
        {showMore ? (
          <View style={styles.block}>
            <TextField
              label="Nome que aparece na fatura"
              placeholder="Ex.: JANUARIO DA SILVEIRA"
              autoCapitalize="characters"
              hint="Ajuda todo mundo a reconhecer a compra na fatura do banco."
              value={state.statementName}
              onChangeText={(value) => dispatch({ type: 'setField', field: 'statementName', value })}
              maxLength={60}
            />
            <TextField label="Observação" placeholder="Opcional" value={state.note} onChangeText={(value) => dispatch({ type: 'setField', field: 'note', value })} multiline maxLength={200} />
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
  more: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', padding: spacing.sm, borderRadius: radius.pill },
  footer: { gap: spacing.xs },
});
