import { useLocalSearchParams } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { useState } from 'react';

import { PageHeader, Screen } from '@/components/layout';
import { EmptyState, LoadingState } from '@/components/ui';
import { AssistantChat } from '@/features/assistant/AssistantChat';
import { useAssistantAvailable } from '@/features/assistant/hooks';
import { useCurrentFamily } from '@/features/families/hooks';
import { useAssistantContextStore } from '@/stores/assistant-context-store';

const GENERAL_SUGGESTIONS = [
  'Quanto eu devo este mês?',
  'Qual foi a maior compra da última fatura?',
  'Quanto gastamos com mercado nos últimos 3 meses?',
  'Quem ainda não pagou a parte da fatura?',
];

const SIMULATION_SUGGESTIONS = [
  'Me explica essa simulação',
  'Qual mês fica mais pesado?',
  'Quanto muda no total?',
  'O que significa "Minha parte" e "Cartão inteiro"?',
];

/** Wally, the AI assistant. With `?about=simulation`, it explains the scenario open on "Simular". */
export default function AssistantScreen() {
  const { about } = useLocalSearchParams<{ about?: string }>();
  const { current, isLoading } = useCurrentFamily();
  const available = useAssistantAvailable();
  const storedSimulation = useAssistantContextStore((state) => state.simulation);
  // Frozen when the screen opens, so the conversation talks about one scenario.
  const [simulation] = useState(() => (about === 'simulation' ? { operations: storedSimulation ?? [] } : undefined));

  const title = simulation ? 'Wally · Simulação' : 'Wally';
  if (isLoading || available === undefined) {
    return (
      <>
        <PageHeader title={title} />
        <LoadingState />
      </>
    );
  }
  if (!current || !available) {
    return (
      <>
        <PageHeader title={title} />
        <Screen>
          <EmptyState
            icon={Bot}
            title="Wally indisponível"
            description={current ? 'O Wally ainda não foi ativado neste app.' : 'Entre numa família para conversar com o Wally.'}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} subtitle={current.family.name} />
      <AssistantChat
        familyId={current.family.id}
        simulation={simulation}
        intro={
          simulation
            ? 'Oi, eu sou o Wally! Pergunte o que quiser sobre a simulação que você montou. Eu vejo os mesmos números da tela.'
            : 'Oi, eu sou o Wally! Pergunte sobre suas faturas, compras, gastos e simulações. Eu só consulto, não mudo nada.'
        }
        suggestions={simulation ? SIMULATION_SUGGESTIONS : GENERAL_SUGGESTIONS}
      />
    </>
  );
}
