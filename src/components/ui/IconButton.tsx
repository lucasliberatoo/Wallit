import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { radius, type ThemeColors, touchTarget, useTheme } from '@/theme';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'light' | 'dark' | 'glass';
  size?: number;
}

type Tone = NonNullable<IconButtonProps['tone']>;

function toneStyle(tone: Tone, colors: ThemeColors): { background: string; icon: string } {
  switch (tone) {
    case 'light':
      return { background: colors.surface, icon: colors.brand };
    case 'dark':
      return { background: colors.primaryFill, icon: colors.onPrimary };
    case 'glass':
      return { background: colors.headerGlass, icon: colors.headerText };
  }
}

export function IconButton({ icon: Icon, onPress, accessibilityLabel, tone = 'light', size = 20 }: IconButtonProps) {
  const { colors } = useTheme();
  const palette = toneStyle(tone, colors);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      scaleTo={0.9}
      style={[styles.button, { backgroundColor: palette.background }]}>
      <Icon size={size} color={palette.icon} strokeWidth={2.2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
