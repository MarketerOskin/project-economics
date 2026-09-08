import type { Decimal } from '@/domain/finance/money';

export const NBSP = ' ';
export const MINUS = '−';
export const DASH = '—';

const ruNumber = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Replace the ASCII hyphen-minus ICU emits with a real minus sign. */
export function normalizeMinus(s: string): string {
  return s.replace(/^-/, MINUS);
}

/**
 * Group a Decimal ru-style: "1 250 000", "1 000,5". No unit.
 *
 * `toNumber()` here is display-only and lossless for every realistic value: even in kopecks,
 * project money stays far below Number.MAX_SAFE_INTEGER (~9×10^15). Finance *math* never
 * goes through this module — it stays in Decimal (ТЗ §17).
 */
export function formatNumber(value: Decimal): string {
  return normalizeMinus(ruNumber.format(value.toNumber()));
}
