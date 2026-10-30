import { create } from 'zustand';

import type { ScenarioOperation } from '@/data';

interface AssistantContextState {
  /** Scenario open on the "Simular" screen, handed to the assistant to explain it. */
  simulation: ScenarioOperation[] | null;
  setSimulation: (operations: ScenarioOperation[] | null) => void;
}

export const useAssistantContextStore = create<AssistantContextState>()((set) => ({
  simulation: null,
  setSimulation: (simulation) => set({ simulation }),
}));
