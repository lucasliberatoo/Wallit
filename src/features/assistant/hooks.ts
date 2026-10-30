import { useMutation, useQuery } from '@tanstack/react-query';

import type { AssistantMessage, ScenarioOperation } from '@/data';
import { useRepositories } from '@/providers/RepositoriesProvider';

/**
 * Whether this backend has the AI assistant turned on (needs GEMINI_API_KEY on
 * the server). `undefined` while checking.
 */
export function useAssistantAvailable(): boolean | undefined {
  const { assistant } = useRepositories();
  const query = useQuery({ queryKey: ['assistant-available'], queryFn: () => assistant.available(), staleTime: Infinity });
  return query.data;
}

export function useAskAssistant(familyId: string | undefined, simulation?: { operations: ScenarioOperation[] }) {
  const { assistant } = useRepositories();
  return useMutation({
    mutationFn: (messages: AssistantMessage[]) => assistant.ask(familyId!, messages, simulation),
  });
}
