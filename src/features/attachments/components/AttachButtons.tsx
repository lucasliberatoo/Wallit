import { Camera, FileText, ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui';
import { errorMessage } from '@/data';
import { makeStyles, spacing } from '@/theme';
import { showError } from '@/utils/confirm';
import { type PickedFile, pickDocument, pickPhoto } from '../pick-attachment';

export interface AttachButtonsProps {
  onPicked: (file: PickedFile) => void;
  disabled?: boolean;
}

/** Image first (screenshots, receipt photos); PDFs through "Arquivo". */
export function AttachButtons({ onPicked, disabled }: AttachButtonsProps) {
  const styles = useStyles();
  const [busy, setBusy] = useState<'library' | 'camera' | 'file' | null>(null);

  const run = async (kind: 'library' | 'camera' | 'file') => {
    setBusy(kind);
    try {
      const file = kind === 'file' ? await pickDocument() : await pickPhoto(kind);
      if (file) onPicked(file);
    } catch (error) {
      showError('Não foi possível anexar', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      <Button
        label={Platform.OS === 'web' ? 'Imagem' : 'Galeria'}
        icon={ImagePlus}
        variant="secondary"
        fullWidth={false}
        style={styles.button}
        loading={busy === 'library'}
        disabled={disabled || (busy !== null && busy !== 'library')}
        onPress={() => run('library')}
      />
      {Platform.OS !== 'web' ? (
        <Button
          label="Câmera"
          icon={Camera}
          variant="secondary"
          fullWidth={false}
          style={styles.button}
          loading={busy === 'camera'}
          disabled={disabled || (busy !== null && busy !== 'camera')}
          onPress={() => run('camera')}
        />
      ) : null}
      <Button
        label="Arquivo"
        icon={FileText}
        variant="secondary"
        fullWidth={false}
        style={styles.button}
        loading={busy === 'file'}
        disabled={disabled || (busy !== null && busy !== 'file')}
        onPress={() => run('file')}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, height: 40, paddingHorizontal: spacing.sm },
}));
