import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const PHOTO_SIZE = 256;

/**
 * Lets the user pick a photo and returns it as a small square JPEG data URL
 * (about 20 KB), small enough to keep with the profile. Null if cancelled.
 */
export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  // The web picker has no crop step: take the centered square.
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height && side > 0) {
    context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
  }
  context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}
