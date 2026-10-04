import {
  Baby,
  BookOpen,
  Bus,
  Car,
  Coffee,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  PartyPopper,
  Pill,
  Plane,
  Repeat,
  Shapes,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Utensils,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { mixHex, radius, useTheme } from '@/theme';

/** On dark surfaces, category colors are lifted toward white so dim ones (gray, navy) stay visible. */
const DARK_LIFT = 0.35;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  pill: Pill,
  utensils: Utensils,
  bus: Bus,
  fuel: Fuel,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  'party-popper': PartyPopper,
  shirt: Shirt,
  house: House,
  repeat: Repeat,
  laptop: Laptop,
  shapes: Shapes,
  car: Car,
  coffee: Coffee,
  dog: Dog,
  dumbbell: Dumbbell,
  'gamepad-2': Gamepad2,
  gift: Gift,
  plane: Plane,
  baby: Baby,
  'book-open': BookOpen,
  smartphone: Smartphone,
  store: Store,
  sparkles: Sparkles,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export interface CategoryIconProps {
  icon?: string;
  color?: string;
  size?: number;
}

/** Category glyph inside a soft tinted circle. */
export function CategoryIcon({ icon = 'shapes', color = '#6B7487', size = 44 }: CategoryIconProps) {
  const { scheme, colors } = useTheme();
  const Icon = CATEGORY_ICONS[icon] ?? Shapes;
  const glyph = scheme === 'dark' ? mixHex(color, colors.text, DARK_LIFT) : color;
  return (
    <View style={[styles.wrap, { width: size, height: size, backgroundColor: `${glyph}1A` }]}>
      <Icon size={size * 0.46} color={glyph} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
