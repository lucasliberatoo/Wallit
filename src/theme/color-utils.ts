/** Mixes two `#RRGGBB` colors; `amount` 0 returns `from`, 1 returns `to`. Other formats pass through. */
export function mixHex(from: string, to: string, amount: number): string {
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(from) || !hex.test(to)) return from;
  const channel = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
