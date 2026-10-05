import { requestWidgetUpdate } from 'react-native-android-widget';

import type { HomeSummary } from '@/data';
import { BALANCE_WIDGET, balanceWidget } from './BalanceWidget';
import { saveSnapshot, snapshotFromHome, type WidgetSnapshot } from './snapshot';

/** Keeps the widget in step with what the app just loaded (or with signing out). */
export async function updateWidget(familyName: string | null, home: HomeSummary | null, hidden: boolean): Promise<void> {
  const snapshot: WidgetSnapshot = home && familyName ? snapshotFromHome(familyName, home, hidden) : { signedIn: false };
  await saveSnapshot(snapshot);
  await requestWidgetUpdate({ widgetName: BALANCE_WIDGET, renderWidget: () => balanceWidget(snapshot) }).catch(() => undefined);
}
