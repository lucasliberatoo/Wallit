import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, PressableScale, TextField } from '@/components/ui';
import { errorMessage } from '@/data';
import { FormError } from '@/features/auth/FormError';
import { useCreateFamily } from '@/features/families/hooks';
import { colors, identityColors, radius, spacing } from '@/theme';

const SUGGESTIONS = ['Minha Casa', 'Amigos', 'Viagem', 'República'];

export default function NewFamilyScreen() {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(identityColors[0]);
  const create = useCreateFamily();

  const submit = () =>
    create.mutate({ name, color }, { onSuccess: (family) => router.replace(`/family/${family.id}`) });

  return (
    <>
      <PageHeader title="Nova família" />
      <Screen footer={<Button label="Criar família" size="lg" onPress={submit} disabled={!name.trim()} loading={create.isPending} />}>
        <AppText variant="body" color="textSecondary">
          Pode ser sua família, sua casa, os amigos da viagem… Você entra como dono e pode convidar as pessoas depois.
        </AppText>
        <TextField label="Nome" placeholder="Família Silva" value={name} onChangeText={setName} autoFocus maxLength={40} />
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((suggestion) => (
            <PressableScale key={suggestion} onPress={() => setName(suggestion)} style={styles.suggestion} accessibilityLabel={`Usar nome ${suggestion}`}>
              <AppText variant="caption">{suggestion}</AppText>
            </PressableScale>
          ))}
        </View>
        <View style={styles.colorSection}>
          <AppText variant="caption" color="textSecondary">
            Cor
          </AppText>
          <View style={styles.colors}>
            {identityColors.map((option) => (
              <PressableScale
                key={option}
                onPress={() => setColor(option)}
                accessibilityLabel="Escolher cor"
                accessibilityState={{ selected: option === color }}
                style={[styles.swatch, { backgroundColor: option }]}>
                {option === color ? <Check size={18} color={colors.textOnDark} strokeWidth={3} /> : null}
              </PressableScale>
            ))}
          </View>
        </View>
        <FormError message={create.error ? errorMessage(create.error) : null} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.md },
  suggestion: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  colorSection: { gap: spacing.sm },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
