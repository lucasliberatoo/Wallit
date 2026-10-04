import { ScrollView } from 'react-native';

import { makeStyles, spacing } from '@/theme';
import type { PickedFile } from '../pick-attachment';
import { AttachmentThumb } from './AttachmentThumb';

/** Files chosen in a form, uploaded when the form is saved. */
export function PickedFiles({ files, onRemove }: { files: PickedFile[]; onRemove: (index: number) => void }) {
  const styles = useStyles();
  if (files.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {files.map((file, index) => (
        <AttachmentThumb
          key={`${file.name}-${index}`}
          name={file.name}
          mimeType={file.mimeType}
          dataUrl={file.dataUrl}
          onRemove={() => onRemove(index)}
        />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  row: { gap: spacing.md, paddingTop: 6, paddingRight: 6 },
}));
