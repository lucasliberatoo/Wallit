import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ExternalLink, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, ErrorState, LoadingState, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { isImageMime } from '@/domain';
import { useAttachmentData } from '@/features/attachments/hooks';
import { openDocument } from '@/features/attachments/open-attachment';
import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { showError } from '@/utils/confirm';
import { formatDateTime } from '@/utils/dates';

export default function AttachmentScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { attachmentId } = useLocalSearchParams<{ attachmentId: string }>();
  const data = useAttachmentData(attachmentId);
  const [ratio, setRatio] = useState(3 / 4);

  if (data.isLoading) return <LoadingState />;
  if (data.error || !data.data) return <ErrorState message={errorMessage(data.error)} onRetry={() => data.refetch()} />;

  const { attachment, dataUrl } = data.data;
  const open = () =>
    openDocument(attachment.name, attachment.mimeType, dataUrl).catch((error) => showError('Não foi possível abrir', errorMessage(error)));

  return (
    <>
      <PageHeader title="Anexo" subtitle={attachment.name} />
      <Screen>
        {isImageMime(attachment.mimeType) ? (
          <View style={[styles.imageBox, { aspectRatio: ratio }]}>
            <Image
              source={{ uri: dataUrl }}
              style={styles.image}
              contentFit="contain"
              onLoad={(event) => setRatio(event.source.width / event.source.height || 3 / 4)}
              accessibilityLabel={attachment.name}
            />
          </View>
        ) : (
          <Surface style={styles.doc}>
            <FileText size={40} color={colors.primary} />
            <AppText variant="bodyStrong" align="center">
              {attachment.name}
            </AppText>
          </Surface>
        )}
        <AppText variant="caption" color="textSecondary" align="center">
          Enviado em {formatDateTime(attachment.createdAt)} · {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
        </AppText>
        <Button
          label={isImageMime(attachment.mimeType) ? 'Abrir ou salvar imagem' : 'Abrir PDF'}
          icon={ExternalLink}
          variant="secondary"
          onPress={open}
        />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  imageBox: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  image: { width: '100%', height: '100%' },
  doc: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
}));
