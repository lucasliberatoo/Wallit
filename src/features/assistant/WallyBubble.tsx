import { LinearGradient } from 'expo-linear-gradient';
import { RotateCcw, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, PressableScale } from '@/components/ui';
import { useCurrentFamily } from '@/features/families/hooks';
import { useAssistantContextStore } from '@/stores/assistant-context-store';
import { layout, makeStyles, radius, spacing, useTheme } from '@/theme';
import { AssistantChat } from './AssistantChat';
import { GENERAL_INTRO, GENERAL_SUGGESTIONS } from './copy';
import { useAssistantAvailable } from './hooks';

const BUBBLE_SIZE = 56;

/**
 * Wally's floating bubble, above the tab bar on the right. It opens the chat
 * in a panel; closing keeps the conversation until the app is closed.
 */
export function WallyBubble() {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const available = useAssistantAvailable();
  const { current } = useCurrentFamily();
  const familyId = current?.family.id;
  const messages = useAssistantContextStore((state) => state.messages);
  const setMessages = useAssistantContextStore((state) => state.setMessages);
  const [open, setOpen] = useState(false);

  // A conversation belongs to one family.
  useEffect(() => {
    setMessages([]);
  }, [familyId, setMessages]);

  if (!available || !familyId) return null;

  const bottom = layout.tabBarHeight + Math.max(insets.bottom, spacing.sm) + spacing.xxl;
  const panelWidth = Math.min(width - spacing.md * 2, 440);
  const panelHeight = Math.min(height - insets.top - spacing.md - spacing.xl, 640);

  return (
    <>
      <View style={[styles.anchor, { bottom }]} pointerEvents="box-none">
        <PressableScale
          haptic
          scaleTo={0.9}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Conversar com o Wally"
          style={styles.shadow}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
            <Sparkles size={26} color={colors.textOnAccent} strokeWidth={2.2} />
          </LinearGradient>
        </PressableScale>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
          <Pressable style={styles.fill} onPress={() => setOpen(false)} accessibilityLabel="Fechar o Wally" />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[styles.panel, { width: panelWidth, height: panelHeight, bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm }]}>
          <View style={styles.header}>
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Sparkles size={18} color={colors.textOnAccent} />
            </LinearGradient>
            <View style={styles.titles}>
              <AppText variant="bodyStrong">Wally</AppText>
              <AppText variant="small" color="textSecondary" numberOfLines={1}>
                Assistente · {current.family.name}
              </AppText>
            </View>
            {messages.length ? (
              <IconButton icon={RotateCcw} size={18} accessibilityLabel="Nova conversa" onPress={() => setMessages([])} />
            ) : null}
            <IconButton icon={X} accessibilityLabel="Fechar" onPress={() => setOpen(false)} />
          </View>
          <AssistantChat
            familyId={familyId}
            intro={GENERAL_INTRO}
            suggestions={GENERAL_SUGGESTIONS}
            conversation={[messages, setMessages]}
            embedded
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors, { shadows }) => ({
  anchor: { position: 'absolute', right: spacing.lg },
  shadow: { borderRadius: radius.pill, ...shadows.lg },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { ...absoluteFill, backgroundColor: 'rgba(8, 15, 40, 0.45)' },
  fill: { flex: 1 },
  panel: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1 },
}));

const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
