import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { AppError } from '@/data';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.slice(5, header.indexOf(';'));
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Opens a PDF outside the app: a new tab on the web, the system viewer
 * (share sheet) on the phone. Images are shown inside the app instead.
 */
export async function openDocument(name: string, mimeType: string, dataUrl: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
    const opened = window.open(url, '_blank');
    if (!opened) window.location.assign(url);
    return;
  }
  const file = new File(Paths.cache, name.replace(/[^\w.-]+/g, '_') || 'anexo.pdf');
  if (file.exists) file.delete();
  file.create();
  file.write(dataUrl.slice(dataUrl.indexOf(',') + 1), { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new AppError('validation', 'Não há app para abrir este arquivo.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
