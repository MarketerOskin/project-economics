/**
 * Category accent palette (ТЗ §29). Hues + order come from the validated data-viz
 * reference categorical theme (adjacent pairlist: worst CVD ΔE 9.1, normal-vision 19.6).
 * Used both as micro-accent dots (name label always adjacent = secondary encoding) and as
 * chart segment fills. Keys are stored in the DB; order here is the assignment order.
 */
export const CATEGORY_PALETTE = {
  blue: '#2a78d6',
  orange: '#eb6834',
  cyan: '#1baf7a',
  graphite: '#eda100',
  burgundy: '#e87ba4',
  green: '#008300',
  violet: '#4a3aa7',
} as const;

export type CategoryColor = keyof typeof CATEGORY_PALETTE;

export const CATEGORY_COLORS = Object.keys(CATEGORY_PALETTE) as CategoryColor[];

export function colorHex(key: string): string {
  return CATEGORY_PALETTE[key as CategoryColor] ?? CATEGORY_PALETTE.blue;
}
