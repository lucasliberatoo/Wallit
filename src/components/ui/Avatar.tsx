import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { AppText } from './AppText';

export interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  /** Colored ring around the avatar (e.g. payment status). */
  ringColor?: string;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, color, size = 40, ringColor }: AvatarProps) {
  const ring = ringColor ? 3 : 0;
  const inner = size - ring * 2 - (ringColor ? 4 : 0);
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[styles.outer, { width: size, height: size }, ringColor && { borderWidth: ring, borderColor: ringColor, padding: 2 }]}>
      <View style={[styles.inner, { width: inner, height: inner, backgroundColor: color }]}>
        <AppText
          variant="bodyStrong"
          color="textOnDark"
          style={{ fontSize: Math.max(11, inner * 0.38), lineHeight: Math.max(14, inner * 0.46) }}>
          {initials(name)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  inner: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
