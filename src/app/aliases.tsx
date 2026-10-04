import { Plus, Tags, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import {
  AppText,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  SectionHeader,
  Surface,
  TextField,
} from '@/components/ui';
import { errorMessage, type MerchantAlias } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useAliases, useRemoveAlias, useSaveAlias } from '@/features/aliases/hooks';
import { useCurrentFamily } from '@/features/families/hooks';
import { makeStyles, spacing } from '@/theme';
import { confirmAction, showError } from '@/utils/confirm';

export default function AliasesScreen() {
  const styles = useStyles();
  const { current } = useCurrentFamily();
  const familyId = current?.family.id;
  const aliases = useAliases(familyId);
  const save = useSaveAlias();
  const remove = useRemoveAlias();
  const [statementName, setStatementName] = useState('');
  const [merchant, setMerchant] = useState('');

  const add = () => {
    if (!familyId) return;
    save.mutate(
      { familyId, statementName: statementName.trim(), merchant: merchant.trim() },
      {
        onSuccess: () => {
          setStatementName('');
          setMerchant('');
        },
      },
    );
  };

  const confirmRemove = async (alias: MerchantAlias) => {
    const ok = await confirmAction({
      title: 'Apagar apelido?',
      message: `"${alias.statementName}" deixa de ser reconhecido como ${alias.merchant}. As compras já registradas não mudam.`,
      confirmLabel: 'Apagar',
      destructive: true,
    });
    if (ok) remove.mutate(alias.id, { onError: (error) => showError('Não foi possível apagar', errorMessage(error)) });
  };

  return (
    <>
      <PageHeader title="Apelidos" subtitle={current?.family.name} />
      <Screen refreshing={aliases.isRefetching} onRefresh={() => aliases.refetch()}>
        <AppText variant="caption" color="textSecondary">
          Quando o nome na fatura for estranho (ex.: &quot;PAG*JOSEDASILVA&quot;), diga ao Wallit qual é o estabelecimento. Nas próximas
          compras ele preenche sozinho. Os apelidos também são aprendidos quando alguém salva uma compra com nome na fatura.
        </AppText>

        <Surface style={styles.form}>
          <TextField
            label="Nome que aparece na fatura"
            placeholder="Ex.: PAG*JOSEDASILVA"
            autoCapitalize="characters"
            value={statementName}
            onChangeText={setStatementName}
            maxLength={60}
          />
          <TextField label="Estabelecimento" placeholder="Ex.: Feira do José" value={merchant} onChangeText={setMerchant} maxLength={60} />
          <FormError message={save.error ? errorMessage(save.error) : null} />
          <Button
            label="Salvar apelido"
            icon={Plus}
            variant="secondary"
            disabled={!statementName.trim() || !merchant.trim()}
            loading={save.isPending}
            onPress={add}
          />
        </Surface>

        <View>
          <SectionHeader title="Apelidos da família" />
          {aliases.isLoading ? (
            <LoadingState />
          ) : aliases.error ? (
            <ErrorState message={errorMessage(aliases.error)} onRetry={() => aliases.refetch()} />
          ) : !aliases.data?.length ? (
            <Surface>
              <EmptyState icon={Tags} title="Nenhum apelido ainda" />
            </Surface>
          ) : (
            <Surface padded={false} style={styles.list}>
              {aliases.data.map((alias, index) => (
                <View key={alias.id}>
                  {index > 0 && <Divider />}
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{alias.merchant}</AppText>
                      <AppText variant="caption" color="textMuted">
                        Na fatura: {alias.statementName}
                      </AppText>
                    </View>
                    <IconButton
                      icon={Trash2}
                      accessibilityLabel={`Apagar apelido ${alias.statementName}`}
                      onPress={() => confirmRemove(alias)}
                    />
                  </View>
                </View>
              ))}
            </Surface>
          )}
        </View>
      </Screen>
    </>
  );
}

const useStyles = makeStyles(() => ({
  form: { gap: spacing.md },
  list: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1, gap: 2 },
}));
