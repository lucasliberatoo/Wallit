import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, radius, touchTarget } from '@/theme';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'light' | 'dark' | 'glass';
  size?: number;
}

const tones = {
  light: { background: colors.surface, icon: colors.brand },
  dark: { background: colors.brand, icon: colors.textOnDark },
  glass: { background: 'rgba(255,255,255,0.28)', icon: colors.brand },
} as const;

export function IconButton({ icon: Icon, onPress, accessibilityLabel, tone = 'light', size = 20 }: IconButtonProps) {
  const palette = tones[tone];
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
