import { SendHorizontal, Sparkles } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Chip, PressableScale } from '@/components/ui';
import { type AssistantMessage, errorMessage, type ScenarioOperation } from '@/data';
import { fontFamily, layout, makeStyles, radius, spacing, touchTarget, useTheme } from '@/theme';
import { useAskAssistant } from './hooks';

export interface AssistantChatProps {
  familyId: string;
  /** Scenario to explain (opened from the "Simular" screen). */
  simulation?: { operations: ScenarioOperation[] };
  intro: string;
  suggestions: string[];
}

/** Conversation with the AI assistant. The conversation lives only while the screen is open. */
export function AssistantChat({ familyId, simulation, intro, suggestions }: AssistantChatProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [text, setText] = useState('');
  const ask = useAskAssistant(familyId, simulation);
  const scroll = useRef<ScrollView>(null);

  const send = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    const next: AssistantMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(next);
    setText('');
    ask.mutate(next, {
      onSuccess: (reply) => setMessages((list) => [...list, { role: 'assistant', text: reply }]),
      // The question stays in the box so it can be sent again.
      onError: () => {
        setMessages((list) => list.slice(0, -1));
        setText(trimmed);
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Sparkles size={22} color={colors.primary} />
          </View>
          <AppText variant="body" color="textSecondary" align="center">
            {intro}
          </AppText>
        </View>
        {messages.length === 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} onPress={() => send(suggestion)} />
            ))}
          </View>
        ) : null}
        {messages.map((message, index) => (
          <View key={index} style={[styles.bubble, message.role === 'user' ? styles.mine : styles.theirs]}>
            <FormattedText text={message.text} color={message.role === 'user' ? 'onPrimary' : 'text'} />
          </View>
        ))}
        {ask.isPending ? (
          <View style={[styles.bubble, styles.theirs, styles.thinking]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText variant="caption" color="textSecondary">
              Wally está pensando...
            </AppText>
          </View>
        ) : null}
        {ask.error ? (
          <AppText variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
            {errorMessage(ask.error)}
          </AppText>
        ) : null}
        <AppText variant="small" color="textMuted" align="center">
          O Wally pode errar. Confira os valores no app antes de decidir.
        </AppText>
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Pergunte ao Wally..."
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Pergunta para o Wally"
          style={styles.input}
          multiline
          maxLength={2000}
          onSubmitEditing={() => send(text)}
          submitBehavior="submit"
          returnKeyType="send"
        />
        <PressableScale
          onPress={() => send(text)}
          disabled={!text.trim() || ask.isPending}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          style={[styles.send, (!text.trim() || ask.isPending) && styles.disabled]}>
          <SendHorizontal size={20} color={colors.onPrimary} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The bits of Markdown the AI uses: **bold** and bullet lines. */
function FormattedText({ text, color }: { text: string; color: 'text' | 'onPrimary' }) {
  const styles = useStyles();
  return (
    <View style={styles.paragraphs}>
      {text.split('\n').map((line, index) => {
        if (!line.trim()) return null;
        const bullet = /^\s*[*-]\s+/.test(line);
        const content = line.replace(/^\s*[*-]\s+/, '').replace(/^#+\s*/, '');
        return (
          <AppText key={index} variant="body" color={color}>
            {bullet ? '•  ' : ''}
            {content.split(/(\*\*[^*]+\*\*)/g).map((piece, i) =>
              piece.startsWith('**') && piece.endsWith('**') ? (
                <AppText key={i} variant="bodyStrong" color={color}>
                  {piece.slice(2, -2)}
                </AppText>
              ) : (
                piece
              ),
            )}
          </AppText>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  intro: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  bubble: { maxWidth: '88%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primaryFill, borderBottomRightRadius: radius.sm },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paragraphs: { gap: spacing.xs },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
}));
