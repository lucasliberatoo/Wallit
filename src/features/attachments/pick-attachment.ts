import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { ATTACHMENT_MAX_DATA_URL_LENGTH } from '@/domain';
import { AppError } from '@/data';

export interface PickedFile {
  name: string;
  mimeType: string;
  dataUrl: string;
}

/** Long side of attached photos: readable receipts at a few hundred KB. */
const PHOTO_MAX_SIDE = 1600;

async function compressImage(uri: string): Promise<string> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(original.width, original.height) > PHOTO_MAX_SIDE) {
    context.resize(original.width >= original.height ? { width: PHOTO_MAX_SIDE } : { height: PHOTO_MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!saved.base64) throw new AppError('validation', 'Não foi possível ler a imagem.');
  return `data:image/jpeg;base64,${saved.base64}`;
}

function checkSize(dataUrl: string): void {
  if (dataUrl.length > ATTACHMENT_MAX_DATA_URL_LENGTH) throw new AppError('validation', 'Arquivo grande demais. O limite é de 2 MB.');
}

/** A photo from the gallery or camera, converted to a compact JPEG. */
export async function pickPhoto(source: 'library' | 'camera'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AppError('validation', 'Permita o uso da câmera para fotografar o comprovante.');
  }
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const dataUrl = await compressImage(asset.uri);
  checkSize(dataUrl);
  const base = asset.fileName?.replace(/\.[^.]+$/, '') || 'foto';
  return { name: `${base}.jpg`, mimeType: 'image/jpeg', dataUrl };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AppError('validation', 'Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

/** A PDF or image from the device's files. Images are compressed like photos. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const mimeType = (asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')).toLowerCase();

  if (mimeType.startsWith('image/')) {
    const dataUrl = await compressImage(asset.uri);
    checkSize(dataUrl);
    return { name: asset.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType: 'image/jpeg', dataUrl };
  }

  if (mimeType !== 'application/pdf') throw new AppError('validation', 'Envie uma imagem ou um PDF.');
  const dataUrl =
    Platform.OS === 'web' && asset.file
      ? await readAsDataUrl(asset.file)
      : `data:application/pdf;base64,${await new File(asset.uri).base64()}`;
  checkSize(dataUrl);
  return { name: asset.name, mimeType, dataUrl: dataUrl.replace(/^data:[^;]*;/, 'data:application/pdf;') };
}
