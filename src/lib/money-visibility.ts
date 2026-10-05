import { useCallback } from 'react';

import { type Cents, formatBRL } from '@/domain';
import { usePreferencesStore } from '@/stores/preferences-store';

export const HIDDEN_MONEY = 'R$ ••••';

/** `formatBRL`, unless the user hid the amounts with the eye icon. */
export function useMoneyFormatter(): (cents: Cents) => string {
  const hidden = usePreferencesStore((state) => state.hideValues);
  return useCallback((cents: Cents) => (hidden ? HIDDEN_MONEY : formatBRL(cents)), [hidden]);
}
