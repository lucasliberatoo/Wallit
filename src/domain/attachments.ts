/** Receipts, screenshots and PDFs. Photos are converted to JPEG before upload. */
export const ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Fits a Vercel request (4.5 MB) with room to spare: about 2.2 MB of file. */
export const ATTACHMENT_MAX_DATA_URL_LENGTH = 3_000_000;

export const MAX_ATTACHMENTS_PER_PURCHASE = 10;

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Size in bytes of the file inside a base64 data URL. */
export function dataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
