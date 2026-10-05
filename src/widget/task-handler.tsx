import type { WidgetTaskHandler } from 'react-native-android-widget';

import { BALANCE_WIDGET, balanceWidget } from './BalanceWidget';
import { cachedSnapshot, loadSnapshot } from './snapshot';

/** Runs in the background when Android adds, refreshes (every 30 min) or resizes the widget. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetInfo.widgetName !== BALANCE_WIDGET || widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const cached = await cachedSnapshot();
  if (cached) renderWidget(balanceWidget(cached));
  renderWidget(balanceWidget(await loadSnapshot()));
};
