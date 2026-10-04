import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, PressableScale } from '@/components/ui';
import { errorMessage } from '@/data';
import type { User } from '@/domain';
import { useUpdateProfile } from '@/features/auth/hooks';
import { colors, palette, radius, spacing } from '@/theme';
import { pickProfilePhoto } from './pick-photo';

/** Avatar that opens the photo picker; the photo is shown to the whole family. */
export function ProfilePhoto({ user }: { user: User | null | undefined }) {
  const update = useUpdateProfile();
  const [pickError, setPickError] = useState<string | null>(null);

  const choose = async () => {
    setPickError(null);
    try {
      const photo = await pickProfilePhoto();
      if (photo) update.mutate({ photo });
    } catch {
      setPickError('Não foi possível abrir essa imagem.');
    }
  };

  const error = pickError ?? (update.error ? errorMessage(update.error) : null);

  return (
    <View style={styles.wrap}>
      <PressableScale onPress={choose} accessibilityLabel={user?.photo ? 'Trocar foto' : 'Adicionar foto'} disabled={update.isPending}>
        <Avatar name={user?.name ?? '?'} color={user?.avatarColor ?? colors.primary} photo={user?.photo} size={72} />
        <View style={styles.badge}>
          <Camera size={14} color={palette.white} />
        </View>
      </PressableScale>
      {user?.photo ? (
        <AppText variant="small" color="brand" onPress={() => update.mutate({ photo: '' })} accessibilityRole="button">
          Remover foto
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="small" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
