import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { CATEGORY_ICON_NAMES, CategoryIcon } from '@/components/finance';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, IconButton, LoadingState, PressableScale, SectionHeader, Surface, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import type { Category } from '@/domain';
import { useCategories, useCreateCategory, useRemoveCategory, useReorderCategories, useUpdateCategory } from '@/features/categories/hooks';
import { useCurrentFamily } from '@/features/families/hooks';
import { identityColors, makeStyles, radius, spacing, useTheme } from '@/theme';

const COLORS = [...identityColors, '#E31B54', '#EE46BC', '#475467'];

export default function CategoriesScreen() {
  const styles = useStyles();
  const { current } = useCurrentFamily();
  const familyId = current?.family.id;
  const categories = useCategories(familyId);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useRemoveCategory();
  const reorder = useReorderCategories();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  if (categories.isLoading || !familyId) return <LoadingState />;
  const list = categories.data ?? [];

  const move = (index: number, delta: number) => {
    const ids = list.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ familyId, ids });
  };

  const confirmRemove = (category: Category) => {
    const run = () => remove.mutate(category.id);
    const message = 'Compras antigas continuam mostrando esta categoria.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir ${category.name}? ${message}`)) run();
    } else {
      Alert.alert(`Excluir ${category.name}?`, message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: run },
      ]);
    }
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle={current?.family.name}
        right={<IconButton icon={Plus} accessibilityLabel="Nova categoria" onPress={() => setEditing('new')} />}
      />
      <Screen>
        {editing ? (
          <CategoryEditor
            initial={editing === 'new' ? undefined : editing}
            saving={create.isPending || update.isPending}
            error={create.error || update.error ? errorMessage(create.error ?? update.error) : undefined}
            onCancel={() => setEditing(null)}
            onSave={(input) => {
              if (editing === 'new') create.mutate({ familyId, input }, { onSuccess: () => setEditing(null) });
              else update.mutate({ categoryId: editing.id, input }, { onSuccess: () => setEditing(null) });
            }}
          />
        ) : null}

        <Surface padded={false} style={styles.list}>
          {list.map((category, index) => (
            <View key={category.id}>
              {index > 0 && <Divider inset={56} />}
              <View style={styles.row}>
                <CategoryIcon icon={category.icon} color={category.color} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {category.name}
                </AppText>
                <IconButton icon={ArrowUp} size={16} accessibilityLabel={`Subir ${category.name}`} onPress={() => move(index, -1)} />
                <IconButton icon={ArrowDown} size={16} accessibilityLabel={`Descer ${category.name}`} onPress={() => move(index, 1)} />
                <IconButton icon={Pencil} size={16} accessibilityLabel={`Editar ${category.name}`} onPress={() => setEditing(category)} />
                <IconButton
                  icon={Trash2}
                  size={16}
                  accessibilityLabel={`Excluir ${category.name}`}
                  onPress={() => confirmRemove(category)}
                />
              </View>
            </View>
          ))}
        </Surface>
      </Screen>
    </>
  );
}

function CategoryEditor({
  initial,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial?: Category;
  saving: boolean;
  error?: string;
  onSave: (input: { name: string; icon: string; color: string }) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'shapes');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  return (
    <Surface style={styles.editor}>
      <SectionHeader title={initial ? 'Editar categoria' : 'Nova categoria'} />
      <View style={styles.preview}>
        <CategoryIcon icon={icon} color={color} size={56} />
        <View style={styles.flex}>
          <TextField label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Pet" maxLength={24} autoFocus />
        </View>
      </View>
      <AppText variant="overline" color="textSecondary">
        Ícone
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {CATEGORY_ICON_NAMES.map((iconName) => (
          <PressableScale
            key={iconName}
            onPress={() => setIcon(iconName)}
            accessibilityLabel={`Ícone ${iconName}`}
            accessibilityState={{ selected: icon === iconName }}
            style={[styles.option, icon === iconName && styles.optionSelected]}>
            <CategoryIcon icon={iconName} color={color} size={40} />
          </PressableScale>
        ))}
      </ScrollView>
      <AppText variant="overline" color="textSecondary">
        Cor
      </AppText>
      <View style={styles.colors}>
        {COLORS.map((option) => (
          <PressableScale
            key={option}
            onPress={() => setColor(option)}
            accessibilityLabel="Escolher cor"
            accessibilityState={{ selected: option === color }}
            style={[styles.swatch, { backgroundColor: option }]}>
            {option === color ? <Check size={16} color={colors.textOnDark} strokeWidth={3} /> : null}
          </PressableScale>
        ))}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label="Cancelar" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button label="Salvar" onPress={() => onSave({ name, icon, color })} disabled={!name.trim()} loading={saving} style={styles.flex} />
      </View>
    </Surface>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  flex: { flex: 1 },
  editor: { gap: spacing.md },
  preview: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  options: { gap: spacing.sm },
  option: { padding: 3, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  optionSelected: { borderColor: colors.primary },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
}));
