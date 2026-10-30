import { create } from 'zustand';

import type { AssistantMessage, ScenarioOperation } from '@/data';

interface AssistantContextState {
  /** The bubble's conversation, kept while the app is open so closing the bubble doesn't lose it. */
  messages: AssistantMessage[];
  setMessages: (next: AssistantMessage[] | ((list: AssistantMessage[]) => AssistantMessage[])) => void;
  /** Scenario open on the "Simular" screen, handed to the assistant to explain it. */
  simulation: ScenarioOperation[] | null;
  setSimulation: (operations: ScenarioOperation[] | null) => void;
}

export const useAssistantContextStore = create<AssistantContextState>()((set) => ({
  messages: [],
  setMessages: (next) => set((state) => ({ messages: typeof next === 'function' ? next(state.messages) : next })),
  simulation: null,
  setSimulation: (simulation) => set({ simulation }),
}));
