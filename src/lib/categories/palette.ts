/** Curated accent palette for categories (ТЗ §29). Keys are stored; hex used for rendering. */
export const CATEGORY_PALETTE = {
  blue: '#2f6fed',
  violet: '#7c5cff',
  orange: '#e8863b',
  green: '#1f9d63',
  graphite: '#5b6270',
  burgundy: '#a63d57',
  cyan: '#1f9fb2',
} as const;

export type CategoryColor = keyof typeof CATEGORY_PALETTE;

export const CATEGORY_COLORS = Object.keys(CATEGORY_PALETTE) as CategoryColor[];

export function colorHex(key: string): string {
  return CATEGORY_PALETTE[key as CategoryColor] ?? CATEGORY_PALETTE.graphite;
}
