import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRepositories, type HomeSummary } from '@/data';

/** What the home screen widget shows. Kept on the device so it renders even offline. */
export interface WidgetSnapshot {
  signedIn: boolean;
  familyName?: string;
  owedCents?: number;
  toReceiveCents?: number;
  nextDue?: { date: string; cardName: string } | null;
  toReviewCount?: number;
  /** The eye icon in the app is closed: amounts stay hidden on the home screen too. */
  hidden?: boolean;
  updatedAt?: string;
}

const SNAPSHOT_KEY = 'wallit:widget';

export function snapshotFromHome(familyName: string, home: HomeSummary, hidden: boolean): WidgetSnapshot {
  return {
    signedIn: true,
    familyName,
    owedCents: home.owedCents,
    toReceiveCents: home.toReceiveCents,
    nextDue: home.nextDue ? { date: home.nextDue.date, cardName: home.nextDue.cardName } : null,
    toReviewCount: home.toReview.count,
    hidden,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => undefined);
}

export async function cachedSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** Reads a zustand-persisted value without loading the store (the widget runs without the app UI). */
async function persisted<T>(key: string): Promise<Partial<T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as { state?: Partial<T> }).state ?? {}) : {};
  } catch {
    return {};
  }
}

/** Fresh data from the server (or the offline demo); falls back to the last snapshot. */
export async function loadSnapshot(): Promise<WidgetSnapshot> {
  try {
    const repos = createRepositories();
    const session = await repos.auth.getSession();
    if (!session) {
      const signedOut = { signedIn: false };
      await saveSnapshot(signedOut);
      return signedOut;
    }
    const [selection, preferences] = await Promise.all([
      persisted<{ familyId: string | null }>('wallit:selection'),
      persisted<{ hideValues: boolean }>('wallit:preferences'),
    ]);
    const families = await repos.families.listMine();
    const family = families.find((f) => f.family.id === selection.familyId) ?? families[0];
    if (!family) return { signedIn: true };
    const home = await repos.dashboard.home(family.family.id);
    const snapshot = snapshotFromHome(family.family.name, home, Boolean(preferences.hideValues));
    await saveSnapshot(snapshot);
    return snapshot;
  } catch {
    return (await cachedSnapshot()) ?? { signedIn: true };
  }
}
