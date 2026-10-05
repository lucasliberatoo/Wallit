import { Platform } from 'react-native';

/** Public address of the web app; invite links open there (and in the installed web app). */
const DEFAULT_WEB_URL = 'https://wallit-seven.vercel.app';

export function webBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL;
}

export function inviteLink(code: string): string {
  return `${webBaseUrl()}/convite/${encodeURIComponent(code)}`;
}

export function inviteMessage(familyName: string, code: string): string {
  return `Entre na família "${familyName}" no Wallit para dividirmos o cartão: ${inviteLink(code)}\n\nSe preferir, use o código ${code}.`;
}
