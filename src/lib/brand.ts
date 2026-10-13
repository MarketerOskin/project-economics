/**
 * Report branding helpers (ADR-054): the colours a client-facing report is painted with,
 * derived from the portal's one accent colour so any brand colour stays readable.
 */

export const DEFAULT_ACCENT = '#1f2937';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rrggbb` in lower case, or null for anything that is not a hex colour. */
export function normalizeHex(v: string | null | undefined): string | null {
  const m = v?.trim().match(HEX);
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`;
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour that reads on the accent: near-black on light brands, white on dark ones. */
export function onAccent(hex: string): string {
  const L = luminance(hex);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#111111';
}

/** A very light tint of the accent for table headers and panels on white paper. */
export function tint(hex: string, amount = 0.9): string {
  const mix = channels(hex).map((c) => Math.round(c + (255 - c) * amount));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export interface ReportPalette {
  accent: string;
  onAccent: string;
  soft: string;
}

export function reportPalette(accent: string | null | undefined): ReportPalette {
  const a = normalizeHex(accent) ?? DEFAULT_ACCENT;
  return { accent: a, onAccent: onAccent(a), soft: tint(a, 0.9) };
}

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type LogoType = (typeof LOGO_TYPES)[number];
export const LOGO_MAX_BYTES = 512 * 1024;

/** Sniffs PNG / JPEG / WEBP by magic bytes so a renamed file cannot pass as an image. */
export function sniffLogo(bytes: Uint8Array): LogoType | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
