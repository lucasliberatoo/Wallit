import { Platform } from 'react-native';

import type { PushRepository } from '@/data';

const SERVICE_WORKER_URL = '/sw.js';

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

/**
 * Push on the web needs a service worker; on iPhone it only works once the
 * app was added to the home screen. The Android app (APK) shows in-app
 * notifications only for now.
 */
export function pushSupport(): PushSupport {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if ('PushManager' in window && 'Notification' in window) return 'supported';
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return isIOS ? 'needs-install' : 'unsupported';
}

function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)) ?? navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

export async function isPushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return Boolean(await existing?.pushManager.getSubscription());
}

export type EnablePushResult = 'enabled' | 'denied' | 'unavailable';

/** Asks permission (must follow a tap) and registers this device. */
export async function enablePush(push: PushRepository): Promise<EnablePushResult> {
  if (pushSupport() !== 'supported') return 'unavailable';
  const key = await push.publicKey();
  if (!key) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const sw = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await sw.pushManager.getSubscription()) ??
    (await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) }));
  const json = subscription.toJSON();
  await push.subscribe({ endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } });
  return 'enabled';
}

export async function disablePush(push: PushRepository): Promise<void> {
  if (pushSupport() !== 'supported') return;
  const sw = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = await sw?.pushManager.getSubscription();
  if (!subscription) return;
  await push.unsubscribe(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
