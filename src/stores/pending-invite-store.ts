import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PendingInviteState {
  /** Code from an invite link opened before signing in. */
  code: string | null;
  setCode: (code: string | null) => void;
}

export const usePendingInviteStore = create<PendingInviteState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
    }),
    { name: 'wallit:pending-invite', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
