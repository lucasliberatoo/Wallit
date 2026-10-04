import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SelectionState {
  /** Family whose data the app is showing. Wallet/card are navigation params, not global state. */
  familyId: string | null;
  setFamilyId: (familyId: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set) => ({
      familyId: null,
      setFamilyId: (familyId) => set({ familyId }),
    }),
    { name: 'wallit:selection', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
