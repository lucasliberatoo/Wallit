import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Which purchases the home screen lists under "Últimas compras". */
export type HomePurchaseScope = 'all' | 'mine' | 'bought' | 'installments';

interface PreferencesState {
  homeScope: HomePurchaseScope;
  setHomeScope: (scope: HomePurchaseScope) => void;
  /** Amounts replaced by "R$ ••••" (eye icon), kept between visits. */
  hideValues: boolean;
  toggleHideValues: () => void;
}

/** Per-device display choices. */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      homeScope: 'all',
      setHomeScope: (homeScope) => set({ homeScope }),
      hideValues: false,
      toggleHideValues: () => set((state) => ({ hideValues: !state.hideValues })),
    }),
    { name: 'wallit:preferences', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
