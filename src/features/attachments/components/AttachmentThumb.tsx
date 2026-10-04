import { Image } from 'expo-image';
import { FileText, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { isImageMime } from '@/domain';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export interface AttachmentThumbProps {
  name: string;
  mimeType: string;
  /** Image contents, when already loaded. */
  dataUrl?: string;
  loading?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export const THUMB_SIZE = 84;

/** Square preview: the image itself, or a document icon with the file name. */
export function AttachmentThumb({ name, mimeType, dataUrl, loading, onPress, onRemove }: AttachmentThumbProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const image = isImageMime(mimeType);
  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onPress} style={styles.thumb} accessibilityRole="button" accessibilityLabel={`Abrir ${name}`}>
        {image && dataUrl ? (
          <Image source={{ uri: dataUrl }} style={styles.image} contentFit="cover" />
        ) : loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.doc}>
            <FileText size={24} color={colors.primary} />
            <AppText variant="small" color="textSecondary" numberOfLines={2} align="center">
              {name}
            </AppText>
          </View>
        )}
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} style={styles.remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${name}`}>
          <X size={12} color={colors.textOnDark} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { width: THUMB_SIZE, height: THUMB_SIZE },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  doc: { alignItems: 'center', gap: 4, padding: spacing.xs },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
}));
