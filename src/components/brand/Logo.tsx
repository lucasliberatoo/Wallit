import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { fontFamily, gradients, palette, radius } from '@/theme';

export interface LogoProps {
  size?: number;
  variant?: 'sunrise' | 'ocean';
}

/**
 * Provisional logo based on the prototype: "Wallit" wordmark on a rounded
 * gradient square, with a card stripe crossing the "t".
 */
export function Logo({ size = 72, variant = 'sunrise' }: LogoProps) {
  const textColor = palette.white;
  return (
    <LinearGradient
      accessible
      accessibilityLabel="Wallit"
      colors={variant === 'sunrise' ? gradients.sunrise : gradients.ocean}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.26 }]}>
      <View style={[styles.stripe, { top: size * 0.43, right: size * 0.08, width: size * 0.3, height: Math.max(2, size * 0.04) }]} />
      <AppText
        style={{
          fontFamily: fontFamily.extrabold,
          fontSize: size * 0.27,
          lineHeight: size * 0.34,
          letterSpacing: -size * 0.01,
          color: textColor,
        }}>
        Wallit
      </AppText>
    </LinearGradient>
  );
}

export function Wordmark({ color = palette.navy800, size = 28 }: { color?: string; size?: number }) {
  return (
    <AppText style={{ fontFamily: fontFamily.extrabold, fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03, color }}>
      Wallit
    </AppText>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.lg },
  stripe: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
});
