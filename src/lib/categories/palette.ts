/**
 * Category accent palette (ТЗ §29). Hues + order come from the validated data-viz
 * reference categorical theme, dark-surface steps (the app is dark since ADR-032;
 * adjacent pairlist against #0d0d0d: worst CVD ΔE 8.4, normal-vision 19.3, all ≥ 3:1).
 * Used both as micro-accent dots (name label always adjacent = secondary encoding) and as
 * chart segment fills. Keys are stored in the DB; order here is the assignment order.
 */
export const CATEGORY_PALETTE = {
  blue: '#3987e5',
  orange: '#d95926',
  cyan: '#199e70',
  graphite: '#c98500',
  burgundy: '#d55181',
  green: '#008300',
  violet: '#9085e9',
} as const;

export type CategoryColor = keyof typeof CATEGORY_PALETTE;

export const CATEGORY_COLORS = Object.keys(CATEGORY_PALETTE) as CategoryColor[];

export function colorHex(key: string): string {
  return CATEGORY_PALETTE[key as CategoryColor] ?? CATEGORY_PALETTE.blue;
}
