import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand/Logo';
import { GradientHeader } from '@/components/layout';
import { AppText } from '@/components/ui';
import { colors, layout, radius, shadows, spacing } from '@/theme';

export interface AuthScaffoldProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared frame for login, sign-up and password recovery. */
export function AuthScaffold({ title, subtitle, children, footer }: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <GradientHeader>
          <View style={styles.brand}>
            <Logo size={64} variant="ocean" />
            <AppText variant="h1" color="brand">
              {title}
            </AppText>
            <AppText variant="body" color="brand" style={styles.subtitle}>
              {subtitle}
            </AppText>
          </View>
        </GradientHeader>
        <View style={styles.card}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  brand: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  subtitle: { opacity: 0.85 },
  card: {
    marginTop: -spacing.xxxl,
    marginHorizontal: layout.screenPadding,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    width: 'auto',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'stretch',
    ...shadows.md,
  },
  footer: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm, paddingHorizontal: layout.screenPadding },
});
